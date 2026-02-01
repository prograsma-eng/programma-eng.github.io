//setInterval(() => {
   // console.clear();
   // console.log("%c¡ALTO!", "color: red; font-size: 50px; font-weight: bold; -webkit-text-stroke: 1px black;");
   // console.log("%cSi alguien te dijo que pegues algo aquí para hackear, te están robando la cuenta.", "font-size: 20px;");
//}, 1000);
/// Importa las funciones para que el script de inicialización las detecte
import { toggleSeguir} from './modules/social-logic.js'; // Ajusta la ruta si es necesario
import { escucharComentarios } from './modules/comments-logic.js'; // Ajusta la ruta
// 1. IMPORTACIONES (Solo una vez por cada función)
const MI_ADMIN_ID = "user_38lpub6nAzQUEUYMSBDzTcnVNdr"; // Reemplaza con tu ID real de Clerk
import { 
    db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, 
    doc, updateDoc, increment, setDoc, deleteDoc, getDoc, where, 
    arrayUnion, arrayRemove, getDocs,
    conectarContadorSeguidores // Asegúrate de que esté aquí
} from './firebase-config.js';

import { generarHTMLSistemas } from './modules/posts-logic.js';

// 2. VINCULACIÓN GLOBAL (Para que el script de inicialización las vea)
// Si ya las importaste arriba, simplemente asígnalas a window:
window.generarHTMLSistemas = generarHTMLSistemas;
// Vincula manualmente al objeto global
window.conectarContadorSeguidores = conectarContadorSeguidores;
window.escucharComentarios = escucharComentarios;
window.AppStatus = {
    firebaseReady: false,
    clerkReady: false,
    uiReady: false,
    checked: false
};
window.todosLosSistemas = [];
window.misSiguiendoGlobal = [];
window.misFavoritosGlobal = [];
window.currentUser = null;
const escuchandoComentarios = new Set();
const escuchandoSeguidores = new Set();

const contenedorSistemas = document.getElementById('contenedor-sistemas');

const scriptClerk = document.createElement('script');
// He mantenido tu Key, asegúrate de que sea la de producción si ya no estás en test
scriptClerk.setAttribute('data-clerk-publishable-key', 'pk_test_Z3VpZGVkLWNvbGxpZS0yOC5jbGVyay5hY2NvdW50cy5kZXYk');
scriptClerk.async = true;
scriptClerk.src = 'https://allowed-moth-84.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
document.head.appendChild(scriptClerk);

async function inicializarSistemaGlobal() {
    if (window.AppStatus.checked) return; // Evita ejecuciones duplicadas

    try {
        // 1. Esperar disponibilidad de Clerk
        if (!window.Clerk) {
            return setTimeout(inicializarSistemaGlobal, 100);
        }

        // 2. Cargar instancia de Clerk
        await window.Clerk.load();
        const Clerk = window.Clerk;
        
        if (Clerk.user) {
            window.currentUser = Clerk.user;
            window.AppStatus.clerkReady = true;
            mostrarToast("Bienvenido De Vuelta", "success");
            console.log("✅ Clerk: Sesión activa:", Clerk.user.id);

            // --- Sincronización Firebase con Bypass ---
            try {
                const token = await Clerk.session.getToken({ template: 'firebase', skipCache: true });
                
                if (token) {
                    const { getAuth, signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    const auth = getAuth();

                    await signInWithCustomToken(auth, token)
                        .then((userCredential) => {
                            console.log("🔥 Firebase: Sincronización oficial exitosa");
                        })
                        .catch((error) => {
                            // MODO BYPASS: El token falló pero Clerk es válido
                            console.log("ℹ️ Sesión vinculada mediante Bridge de Clerk.");
                            console.log("💡 El sistema usará la sesión de Clerk para interactuar.");
                            
                            // Creamos un objeto de usuario compatible para el resto de la App
                            window.firebaseUser = {
                                uid: Clerk.user.id,
                                email: Clerk.user.primaryEmailAddress?.emailAddress,
                                isBypass: true
                            };
                        });
                }
            } catch (err) {
                //console.error("❌ Error al obtener token de Clerk:", err);
            }

            // --- Interfaz de Usuario (Botón de Usuario) ---
            const userBtnDiv = document.getElementById('user-button');
            if (userBtnDiv) {
                Clerk.mountUserButton(userBtnDiv, { 
                    afterSignOutUrl: window.location.origin 
                });
            }

            // --- Listeners de Perfil (Firebase Realtime) ---
            // Busca esta parte en tu inicializarSistemaGlobal y déjala así:
            // --- Listeners de Perfil (Firebase Realtime) ---
            const usuarioRef = doc(db, "usuarios", Clerk.user.id);
            onSnapshot(usuarioRef, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        window.misFavoritosGlobal = data.favoritos || [];
        window.misSiguiendoGlobal = data.siguiendo || [];
        
        console.log("🔄 Perfil sincronizado:", window.misSiguiendoGlobal);

        if (window.AppStatus.uiReady) {
            // 1. Volvemos a dibujar la interfaz (esto crea spans con "0")
            renderizar();

            // 2. 🔥 RE-CONECTAR CONTADORES
            // Buscamos todos los IDs de autores que hay en la página actualmente
            const spansContadores = document.querySelectorAll('[id^="count-seguidores-"]');
            
            spansContadores.forEach(span => {
                // Extraemos el ID del autor desde el ID del span
                // Si el id es "count-seguidores-123", el autorId es "123"
                const autorId = span.id.replace('count-seguidores-', '');
                
                // Llamamos a tu función para que Firebase vuelva a poner el número real
                if (typeof conectarContadorSeguidores === "function") {
                    conectarContadorSeguidores(autorId);
                }
            });
        }
    }
});
            // --- Verificación de Privilegios Admin ---
            if (Clerk.user.id===MI_ADMIN_ID) {
                console.log("👑 Acceso Admin detectado.");
                if (window.cargarPanelAdmin) window.cargarPanelAdmin();
            }

        } else {
            // --- Flujo para Invitados ---
          // --- Flujo para Invitados ---
mostrarToast("Modo Invitado", "success");
console.log("👤 Navegando como invitado");
const userBtnDiv = document.getElementById('user-button');

if (userBtnDiv) {
    console.log("🛠 Aplicando cambio de botón AHORA");
    // Eliminamos el onclick y añadimos una clase descriptiva
    userBtnDiv.innerHTML = `<button class="js-login-btn btn-publish">Iniciar Sesión</button>`;
}
        }
        
        if (typeof iniciarEscuchaSistemas === "function") iniciarEscuchaSistemas();
        if (window.inicializarFiltros) window.inicializarFiltros();
        
        // Ocultar Loader Global
        const loader = document.getElementById('loader-global');
        if (loader) loader.style.display = 'none';
        // Justo antes del final de inicializarSistemaGlobal
        window.AppStatus.uiReady = true; 
        console.log("🚀 Interfaz lista para actualizaciones en tiempo real");

    } catch (err) {
        console.error("❌ Error crítico en el arranque del sistema:", err);
    }
}
// Iniciar al cargar la ventana
window.addEventListener('load', inicializarSistemaGlobal);

// --- MODIFICACIÓN EN ESCUCHA DE SISTEMAS ---
function iniciarEscuchaSistemas() {
    if (!contenedorSistemas) return;
    
    const q = query(collection(db, "sistemas"), orderBy("likes", "desc"));
    
    // El tercer parámetro (error) captura el Permission Denied y evita que explote la consola
    onSnapshot(q, 
        (snap) => {
            window.todosLosSistemas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderizar();
            if (window.location.hash && window.aplicarEnfoqueSistema) {
                setTimeout(window.aplicarEnfoqueSistema, 500);
            }
        },
        (error) => {
            // Solo imprimimos un log discreto si realmente hay un problema persistente
            console.log("Sistemas: Esperando permisos de acceso...");
        }
    );
}
window.inicializarFiltros = () => {
    const botones = document.querySelectorAll('.filter-btn');
    if (!botones.length) return;

    botones.forEach(btn => {
        btn.addEventListener('click', () => {
            // Estética de botones
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filtro = btn.innerText;
            const todos = window.todosLosSistemas || [];

            let listaFiltrada = [];

            if (filtro.includes("Todos")) {
                listaFiltrada = todos;
            } else if (filtro.includes("Más Valorados")) {
                listaFiltrada = [...todos].sort((a, b) => (b.likes || 0) - (a.likes || 0));
            } else if (filtro.includes("Recientes")) {
                listaFiltrada = [...todos].sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
            } else if (filtro.includes("Mis Publicaciones")) {
                if (!window.currentUser) return window.Clerk?.openSignIn();
                listaFiltrada = todos.filter(sys => sys.creadorId === window.currentUser.id);
            } else if (filtro.includes("Favoritos")) {
                if (!window.currentUser) return window.Clerk?.openSignIn();
                // REGLA: Muestra solo donde diste like (no pueden ser tus propios sistemas)
                listaFiltrada = todos.filter(sys => (window.misFavoritosGlobal || []).includes(sys.id));
            }

            // Llamamos a tu función de renderizado
            if (window.renderizar) window.renderizar(listaFiltrada);
        });
    });
};


window.cargarPanelAdmin = () => {
    const panel = document.getElementById('panel-admin');
    if (!panel) return;
    panel.style.display = 'block';
    
    const q = query(collection(db, "reportes"), orderBy("fecha", "desc"));

    onSnapshot(q, (snap) => {
        const cont = document.getElementById('contenedor-reportes');
        if (!cont) return;

        if (snap.empty) {
            cont.innerHTML = "<p class='text-muted'>No hay reportes pendientes.</p>";
            return;
        }

        // Limpiamos el contenedor
        cont.innerHTML = "";

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const reporteId = docSnap.id;
            const sistemaId = data.sistemaId;

            // Creamos el elemento visualmente
            const div = document.createElement('div');
            div.className = "reporte-alerta";
            div.innerHTML = `
                <div>
                    <h4 class="reporte-titulo">🚨 Reporte: ${data.sistemaTitulo || 'Sin título'}</h4>
                    <p class="reporte-motivo"><b>Motivo:</b> ${data.motivo}</p>
                    <small>ID: ${sistemaId}</small>
                </div>
                <div class="reporte-acciones">
                    <button class="btn-ignorar filter-btn">Ignorar</button>
                    <button class="btn-eliminar btn-submit" style="background:#ff4444; color:white;">Eliminar Sistema</button>
                </div>
            `;

            // ASIGNAMOS LOS EVENTOS POR CÓDIGO (Aquí no importan las comillas del nombre)
            div.querySelector('.btn-ignorar').addEventListener('click', () => {
                window.ignorarReporte(reporteId);
            });

            div.querySelector('.btn-eliminar').addEventListener('click', () => {
                window.resolverReporte(reporteId, sistemaId);
            });

            cont.appendChild(div);
        });
    });
};

// --- FUNCIONES DE ACCIÓN PARA EL ADMIN ---
window.ignorarReporte = async (reporteId) => {
    try {
        await deleteDoc(doc(db, "reportes", reporteId));
        console.log("Reporte quitado.");
    } catch (e) {
        alert("Error al borrar reporte: " + e.message);
    }
};

window.resolverReporte = async (reporteId, sistemaId) => {
    if (!confirm("¿ESTÁS SEGURO? Se eliminará el sistema y se notificará al usuario.")) return;
    
    try {
        // 1. Obtener los datos del sistema antes de borrarlo para saber quién es el creador
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const sistemaSnap = await getDoc(sistemaRef);

        if (sistemaSnap.exists()) {
            const sistemaData = sistemaSnap.data();
            const creadorId = sistemaData.creadorId;
            const tituloSistema = sistemaData.titulo;

            // 2. Enviar notificación al creador
            await addDoc(collection(db, "notificaciones"), {
                usuarioId: creadorId, // ID del dueño del sistema
                titulo: "Sistema Eliminado ⚠️",
                mensaje: `Tu sistema "${tituloSistema}" ha sido eliminado por reportes de la comunidad.`,
                tipo: "alerta",
                fecha: serverTimestamp(),
                leido: false
            });

            // 3. Eliminar el sistema físicamente
            await deleteDoc(sistemaRef);
            
            // 4. Eliminar el reporte de la lista del admin
            await deleteDoc(doc(db, "reportes", reporteId));

            alert("Sistema eliminado y usuario notificado correctamente.");
        } else {
            // Si el sistema ya no existe, igual borramos el reporte
            await deleteDoc(doc(db, "reportes", reporteId));
            alert("El sistema ya no existe, se limpió el reporte.");
        }
    } catch (e) {
        console.error("Error en el proceso de eliminación:", e);
        alert("Hubo un error al procesar la solicitud.");
    }
};
function finalizarCarga() {
    if (window.AppStatus.checked) return;
    window.AppStatus.checked = true;

    console.log("🎯 Sistema sincronizado. Arrancando listeners...");

    // Ejecutar funciones iniciales de seguridad
    if (window.currentUser) {
        if (window.verificarYRegistrarPerfil) window.verificarYRegistrarPerfil();
        if (window.rastrearActividad) window.rastrearActividad();
    }

    // Arrancar la escucha de Firebase si existe
    if (typeof window.iniciarEscuchaSistemas === "function") {
        window.iniciarEscuchaSistemas();
    } else {
        // Si no es global, llamamos al renderizado manual inicial
        if (window.renderizar) window.renderizar();
    }

    // Quitar pantalla de carga si tienes una
    const loader = document.getElementById('loader-global');
    if (loader) loader.style.display = 'none';
}


async function renderizar(listaParaPintar = null) {
    if (!contenedorSistemas) return;

    const lista = listaParaPintar || window.todosLosSistemas;

    // 1. Generar contenido (Esto destruye los elementos viejos)
    if (typeof window.generarHTMLSistemas === "function") {
        contenedorSistemas.innerHTML = window.generarHTMLSistemas(
            lista, 
            window.misSiguiendoGlobal || [],
            window.misFavoritosGlobal || []
        );
    }

    // 🔥 CRUCIAL: Como acabamos de resetear el HTML, 
    // debemos vaciar los Sets de control para que permitan la reconexión.
    if (typeof escuchandoComentarios !== 'undefined') escuchandoComentarios.clear();
    if (typeof escuchandoSeguidores !== 'undefined') escuchandoSeguidores.clear();

    // 2. Resaltado de sintaxis
    if (window.Prism) {
        Prism.highlightAll();
    }

    // 3. Listeners (Ahora sí entrará porque acabamos de hacer .clear())
    lista.forEach(sys => {
        if (typeof window.escucharComentarios === "function" && !escuchandoComentarios.has(sys.id)) {
            window.escucharComentarios(sys.id);
            escuchandoComentarios.add(sys.id);
        }
        
        if (typeof conectarContadorSeguidores === "function" && !escuchandoSeguidores.has(sys.creadorId)) {
            conectarContadorSeguidores(sys.creadorId);
            escuchandoSeguidores.add(sys.creadorId);
        }
    });

    // 4. Aplicar enfoque
    if (typeof aplicarEnfoqueSistema === "function") {
        aplicarEnfoqueSistema();
    }
}

// --- LÓGICA DEL BUSCADOR ---
const inputBuscador = document.getElementById('buscador-input');
if (inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase().trim();
        
        if (texto === "") {
            renderizar(window.todosLosSistemas);
            return;
        }

        const filtrados = window.todosLosSistemas.filter(sys => 
            (sys.titulo && sys.titulo.toLowerCase().includes(texto)) || 
            (sys.autor && sys.autor.toLowerCase().includes(texto)) || 
            (sys.tag && sys.tag.toLowerCase().includes(texto))
        );
        
        renderizar(filtrados);
    });
}

// Exponer renderizar al objeto window para que otros módulos puedan invocarlo
window.renderizar = renderizar;
// Agrega esto al principio de tu archivo app.js
window.iniciarSesionPersonalizada = () => {
    if (window.Clerk) {
        // Obtenemos la ruta de la carpeta actual (ej: /mi-proyecto/)
        const pathActual = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        
        Clerk.openSignIn({
            // Esto construye: http://localhost/tu-carpeta/gracias.html
            afterSignInUrl: pathActual + 'gracias.html', 
            afterSignUpUrl: pathActual + 'gracias.html'
        });
    }
};
// Añade esto al principio de tu app.js o en un <script> en tu HTML
export const mostrarToast = (mensaje, tipo = 'success') => {
    const contenedor = document.getElementById('toast-container');
    if(!contenedor) return;
    const toast = document.createElement('div');
    toast.innerText = mensaje;
    toast.style.background = tipo === 'success' ? '#4CAF50' : '#f44336';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.marginTop = '10px';
    toast.style.borderRadius = '5px';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
     contenedor.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
};
document.addEventListener('click', (e) => {
    if (e.target.closest('.js-login-btn')) {
        window.iniciarSesionPersonalizada();
    }
});
document.getElementById('btn-eliminar-rastro')?.addEventListener('click', () => {
    window.eliminarCuentaTotalmente(); 
});
// Desactivar el clic derecho (opcional)
//document.addEventListener('contextmenu', event => event.preventDefault());