// 1. Importaciones (Mantén tus importaciones actuales)
import { 
    db, collection, query, where, onSnapshot, doc, getDoc, orderBy,
    updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp,
    auth, onAuthStateChanged, conectarContadorSeguidores 
} from './firebase-config.js';

// 2. Variables Globales
// 2. Variables Globales
let listaPublicaciones = [];
let listaFavoritos = [];
window.misFavoritosGlobal = []; // Asegúrate de que exista
window.misSiguiendoGlobal = [];  // Asegúrate de que exista
window.editandoId = null; 
let tabActual = 'publicaciones';
let textoBusqueda = "";

// --- NUEVA FUNCIÓN DE ESCUCHA (Colócala aquí para que esté definida) ---
// --- ESCUCHA DE DATOS DEL USUARIO (Seguidores y Favoritos) ---
const escucharDatosStudio = (userId) => {
    const usuarioRef = doc(db, "usuarios", userId);

    onSnapshot(usuarioRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // BUSCAMOS TU ID EXACTO DEL HTML: stat-favs
            const elSeguidores = document.getElementById('stat-favs');
            if (elSeguidores) {
                elSeguidores.innerText = data.seguidoresCount || 0;
            }

            // Guardamos globales para el resto del sistema
            window.misSiguiendoGlobal = data.siguiendo || [];
            window.misFavoritosGlobal = data.favoritos || [];
            
            if (window.misFavoritosGlobal.length > 0) {
                cargarSistemasFavoritos(window.misFavoritosGlobal);
            }
            
            renderizarSegunTab();
        }
    });
};

// --- CARGA DE PUBLICACIONES (Likes y Conteo de Posts) ---
function cargarPublicacionesStudio(userId) {
    const qPub = query(collection(db, "sistemas"), where("creadorId", "==", userId), orderBy("fecha", "desc"));
    
    onSnapshot(qPub, (snap) => {
        listaPublicaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 1. Calculamos los totales reales de tu lista de Firebase
        const totalLikes = listaPublicaciones.reduce((acc, sys) => acc + (sys.likes || 0), 0);
        const totalPubs = listaPublicaciones.length;

        // 2. USAMOS TUS IDS EXACTOS: stat-likes y stat-posts
        const elLikes = document.getElementById('stat-likes');
        const elPubs = document.getElementById('stat-posts');

        if (elLikes) elLikes.innerText = totalLikes;
        if (elPubs) elPubs.innerText = totalPubs;

        renderizarSegunTab();
    });
}
// --- CONFIGURACIÓN DE CLERK ---
const inicializarClerkEnStudio = () => {
    const scriptClerk = document.createElement('script');
    scriptClerk.setAttribute('data-clerk-publishable-key', 'pk_test_Z3VpZGVkLWNvbGxpZS0yOC5jbGVyay5hY2NvdW50cy5kZXYk');
    scriptClerk.async = true;
    scriptClerk.src = 'https://allowed-moth-84.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';

    scriptClerk.onload = async () => {
        await Clerk.load();

        const configurarInterfazUsuario = async (user) => {
            window.currentUser = user;
            
            // 1. Montar botón de usuario
            const userButtonDiv = document.getElementById('user-button');
            if (userButtonDiv) {
                await Clerk.mountUserButton(userButtonDiv, {
                    afterSignOutUrl: "index.html",
                });
            }

            // 2. ACTIVAR ESCUCHA DE DATOS (Aquí es donde se activa)
            escucharDatosStudio(user.id);
            
            // 3. Cargar las publicaciones del usuario
            cargarPublicacionesStudio(user.id);
        };

        if (Clerk.user) {
            await configurarInterfazUsuario(Clerk.user);
        } else {
            setTimeout(async () => {
                if (Clerk.user) await configurarInterfazUsuario(Clerk.user);
                else window.location.href = "index.html";
            }, 1500); 
        }
    };
    document.head.appendChild(scriptClerk);
};

// Iniciar proceso
inicializarClerkEnStudio();
// ... (Resto de tus funciones: cambiarTab, renderizarSegunTab, etc.)

// --- BUSCADOR EN TIEMPO REAL ---
document.getElementById('input-busqueda')?.addEventListener('input', (e) => {
    textoBusqueda = e.target.value.toLowerCase();
    renderizarSegunTab();
})
// --- NAVEGACIÓN ---
window.cambiarTab = (tab) => {
    tabActual = tab;
    const items = {
        'publicaciones': { id: 'tab-pub', title: 'Contenido del canal' },
        'favoritos': { id: 'tab-fav', title: 'Tus Favoritos Guardados' },
        'estadisticas': { id: 'tab-est', title: 'Estadísticas del canal' }
    };

    // Actualizar clases UI
    Object.values(items).forEach(item => {
        document.getElementById(item.id)?.classList.remove('active');
    });
    
    document.getElementById(items[tab].id)?.classList.add('active');
    document.getElementById('titulo-studio').innerText = items[tab].title;
    
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        searchContainer.style.display = (tab === 'estadisticas') ? "none" : "block";
    }

    renderizarSegunTab();
};

// --- RENDERIZADO ---
function renderizarSegunTab() {
    const contenedor = document.getElementById('contenedor-estudio');
    if (!contenedor) return;

    if (tabActual === 'estadisticas') {
        renderizarEstadisticas(contenedor);
        return;
    }

    // Esperar a que la lógica UI esté lista
    if (typeof window.generarHTMLSistemas !== 'function') {
        setTimeout(renderizarSegunTab, 200);
        return;
    }

    let datos = tabActual === 'publicaciones' ? listaPublicaciones : listaFavoritos;
    const datosFiltrados = datos.filter(sys => (sys.titulo || "").toLowerCase().includes(textoBusqueda));

    if (datosFiltrados.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; padding:50px; color:gray;">No hay contenido disponible.</p>`;
        return;
    }

    let htmlExtra = "";
    if (tabActual === 'publicaciones' && !textoBusqueda && datos[0]) {
        const ultima = datos[0];
        htmlExtra = `
            <div class="highlight-last">
                <span style="color: var(--accent); font-size: 0.8rem; font-weight: bold;">ÚLTIMA PUBLICACIÓN</span>
                <h4 style="margin: 10px 0; font-size: 1.4rem;">${ultima.titulo || "Sin título"}</h4>
                <div style="display: flex; gap: 20px; color: var(--text-gray); font-size: 0.9rem;">
                    <span>❤️ ${ultima.likes || 0} Likes</span>
                    <span>⭐ ${ultima.favsCount || 0} Favs</span>
                </div>
            </div>`;
    }

    contenedor.innerHTML = htmlExtra + window.generarHTMLSistemas(
    datosFiltrados, 
    window.misSiguiendoGlobal || [], 
    window.misFavoritosGlobal || [], 
    true
    )
    if (window.Prism) Prism.highlightAll();
    // Al final de la función renderizarSegunTab, después de contenedor.innerHTML = ...
datosFiltrados.forEach(sys => {
    if (typeof conectarContadorSeguidores === 'function') {
        conectarContadorSeguidores(sys.creadorId);
    }
});
}

// --- GRÁFICOS ---
function renderizarEstadisticas(contenedor) {
    const totalLikes = listaPublicaciones.reduce((acc, sys) => acc + (sys.likes || 0), 0);
    const totalPubs = listaPublicaciones.length;
    const userId = window.currentUser?.id;

    contenedor.innerHTML = `
        <div class="stats-container">
            <div class="stats-grid">
                <div class="stat-card">
                    <p>Seguidores Totales</p>
                    <h2 id="count-seguidores-${userId}">${document.getElementById('seguidores-estudio-main')?.innerText || 0}</h2>
                </div>
                <div class="stat-card">
                    <p>Publicaciones</p>
                    <h2>${totalPubs}</h2>
                </div>
                <div class="stat-card">
                    <p>Likes Totales</p>
                    <h2 style="color: #ff4e4e;">${totalLikes}</h2>
                </div>
            </div>
            <div class="chart-wrapper" style="margin-top:20px; background:#111; padding:20px; border-radius:12px;">
                <canvas id="graficaCanal"></canvas>
            </div>
        </div>
    `;

    if (userId) conectarContadorSeguidores(userId);
    setTimeout(crearGraficaEfectiva, 150);
}
function crearGraficaEfectiva() {
    const ctx = document.getElementById('graficaCanal');
    if (!ctx) return;

    // Destruir si ya existe para evitar errores
    if (window.miChart) window.miChart.destroy();

    window.miChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Interacciones (Likes/Favs)',
                data: [5, 10, 8, 15, 20, 18, 25], // Datos de ejemplo
                borderColor: '#00a2ff',
                backgroundColor: 'rgba(0, 162, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

window.toggleModoEditor = function(id) {
    // Si ya estamos editando este sistema, lo cerramos
    if (window.editandoId === id) {
        window.editandoId = null;
    } else {
        // Si no, activamos el modo edición para este ID
        window.editandoId = id;
    }
    
    // IMPORTANTE: Volvemos a dibujar para que el HTML sepa 
    // que ahora el 'contenteditable' debe ser true
    renderizarSegunTab();
};
window.guardarTitulo = async (id) => {
    const el = document.getElementById(`title-${id}`);
    if (!el) return;
    const nuevoTitulo = el.innerText;
    try {
        await updateDoc(doc(db, "sistemas", id), { titulo: nuevoTitulo });
    } catch (e) {
        console.error("Error al actualizar título", e);
    }
};

window.guardarEdicion = async (sysId, arcIndex) => {
    const el = document.getElementById(`edit-${sysId}-${arcIndex}`);
    if (!el) return;
    
    const nuevoCodigo = el.textContent; // Usamos textContent para código limpio
    
    // Buscamos el sistema en las listas que sí existen en tu Studio
    const sistema = listaPublicaciones.find(s => s.id === sysId) || listaFavoritos.find(s => s.id === sysId);
    
    if (!sistema) return alert("No se encontró el sistema.");
    
    const nuevosArchivos = [...sistema.archivos];
    nuevosArchivos[arcIndex].codigo = nuevoCodigo;
    
    try {
        await updateDoc(doc(db, "sistemas", sysId), { archivos: nuevosArchivos });
        alert("✅ Cambios guardados en la nube.");
    } catch (error) {
        console.error(error);
        alert("❌ Error al guardar.");
    }
};

window.eliminarScript = async (sysId, indiceScript) => {
    if (!confirm("¿Estás seguro de eliminar este script?")) return;

    try {
        const sistemaRef = doc(db, "sistemas", sysId);
        const docSnap = await getDoc(sistemaRef);

        if (!docSnap.exists()) {
            console.error("No se encontró el sistema");
            return;
        }

        const data = docSnap.data();
        let archivosActuales = data.archivos || [];

        // Eliminamos el script usando su índice en el array
        archivosActuales.splice(indiceScript, 1);

        // Actualizamos el documento en Firebase
        await updateDoc(sistemaRef, { 
            archivos: archivosActuales 
        });

        console.log("✅ Script eliminado correctamente");

        // Refrescar el editor o la UI
        if (typeof window.cargarEditor === "function") {
            window.cargarEditor(sysId);
        } else if (typeof window.renderizar === "function") {
            window.renderizar();
        }

    } catch (error) {
        console.error("Error al eliminar script:", error);
        alert("No se pudo eliminar el script.");
    }
};
window.nuevoScriptEnSistema = async (sysId) => {
    // 1. Pedir datos al usuario
    const nombre = prompt("Nombre del archivo:");
    if (!nombre) return;

    const seleccion = prompt("Elige el tipo: \n1. script\n2. modulescript\n3. localscript").toLowerCase().trim();
    
    let tipoFinal = "";
    if (seleccion === "1" || seleccion === "script") tipoFinal = "script";
    else if (seleccion === "2" || seleccion === "modulescript") tipoFinal = "modulescript";
    else if (seleccion === "3" || seleccion === "localscript") tipoFinal = "localscript";
    else return alert("Tipo no válido.");

    const sistemaRef = doc(db, "sistemas", sysId);

    try {
        // 2. Obtener la versión más reciente del sistema directamente de Firebase
        const docSnap = await getDoc(sistemaRef);
        
        if (!docSnap.exists()) {
            console.error("❌ El sistema no existe en la base de datos:", sysId);
            return alert("Error: El sistema no existe.");
        }

        const data = docSnap.data();
        const archivosActuales = data.archivos || [];

        // 3. Crear el nuevo archivo
        const nuevoArchivo = { 
            nombre: nombre, 
            tipo: tipoFinal, 
            codigo: tipoFinal === "modulescript" ? "local module = {}\n\nreturn module" : "-- Nuevo código"
        };

        // 4. Actualizar Firebase usando arrayUnion (es más seguro que reescribir todo el array)
        await updateDoc(sistemaRef, { 
            archivos: arrayUnion(nuevoArchivo) 
        });
        
        console.log(`✅ Archivo ${nombre} (${tipoFinal}) añadido correctamente.`);
        
        // Opcional: Recargar la página o el editor para ver los cambios
        if (typeof window.cargarEditor === "function") window.cargarEditor(sysId);

    } catch (error) {
        console.error("Error al crear script:", error);
        if (error.code === 'permission-denied') {
            alert("No tienes permiso para editar este sistema.");
        } else {
            alert("Hubo un error al guardar el archivo.");
        }
    }
};
// --- FUNCIÓN DAR LIKE (Cumpliendo tus reglas) ---
window.darLike = async (id) => {
    if (!window.currentUser) return;

    // Buscamos el sistema para verificar el creador
    const sistema = listaPublicaciones.find(s => s.id === id) || listaFavoritos.find(s => s.id === id);
    
    // Regla: El creador no puede dar like a su propio sistema
    if (sistema && sistema.creadorId === window.currentUser.id) {
        alert("¡No puedes darte likes a ti mismo! 😅");
        return;
    }

    const docRef = doc(db, "sistemas", id);
    try {
        await updateDoc(docRef, { likes: increment(1) });
        // No hace falta llamar a renderizar porque onSnapshot lo hará solo
    } catch (e) {
        console.error("Error al dar like:", e);
    }
};
// --- FUNCIÓN COMENTAR ---
window.enviarComentario = async (event, sistemaId) => {
    event.preventDefault();
    const input = event.target.querySelector('input');
    const texto = input.value.trim();

    if (!texto || !window.currentUser) return;

    try {
        await addDoc(collection(db, `sistemas/${sistemaId}/comentarios`), {
            texto: texto,
            autor: window.currentUser.fullName,
            foto: window.currentUser.imageUrl,
            usuarioId: window.currentUser.id,
            fecha: serverTimestamp()
        });
        input.value = "";
    } catch (e) {
        console.error("Error al comentar:", e);
    }
};
const cargarSistemasFavoritos = async (listaIds) => {
    if (!listaIds || listaIds.length === 0) {
        listaFavoritos = [];
        renderizarSegunTab();
        return;
    }

    try {
        // Consultamos la colección 'sistemas' buscando solo los IDs que tenemos en favoritos
        const q = query(collection(db, "sistemas"), where("__name__", "in", listaIds));
        
        onSnapshot(q, (snap) => {
            listaFavoritos = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Si estamos en la pestaña de favoritos, redibujamos
            if (tabActual === 'favoritos') {
                renderizarSegunTab();
            }
        });
    } catch (error) {
        console.error("Error cargando detalles de favoritos:", error);
    }
};