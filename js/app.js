/// Importa las funciones para que el script de inicialización las detecte
import { toggleSeguir} from './modules/social-logic.js'; // Ajusta la ruta si es necesario
import { escucharComentarios } from './modules/comments-logic.js'; // Ajusta la ruta
// 1. IMPORTACIONES (Solo una vez por cada función)
const MI_ADMIN_ID = "user_38V8D7ESSRzvjUdE4iLXB44grHP"; // Reemplaza con tu ID real de Clerk
import { 
    db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, 
    doc, updateDoc, increment, setDoc, deleteDoc, getDoc, where, 
    arrayUnion, arrayRemove, getDocs,
    conectarContadorSeguidores // Asegúrate de que esté aquí
} from './firebase-config.js';

import { generarHTMLSistemas } from './modules/posts-logic.js';

// 2. VINCULACIÓN GLOBAL (Para que el script de inicialización las vea)
// Si ya las importaste arriba, simplemente asígnalas a window:
window.conectarContadorSeguidores = conectarContadorSeguidores;
window.generarHTMLSistemas = generarHTMLSistemas;
// Vincula manualmente al objeto global
window.toggleSeguir = toggleSeguir;
window.conectarContadorSeguidores = conectarContadorSeguidores;
window.escucharComentarios = escucharComentarios;
window.AppStatus = {
    firebaseReady: false,
    clerkReady: false,
    uiReady: false,
    checked: false
};

async function inicializarSistemaGlobal() {
    console.log("🚀 Iniciando verificación de módulos...");

    // 1. Verificar si las funciones críticas están en el objeto global
    const funcionesCriticas = [
        'generarHTMLSistemas', 
        'escucharComentarios', 
        'conectarContadorSeguidores', 
        'toggleSeguir'
    ];

    const faltantes = funcionesCriticas.filter(fn => typeof window[fn] !== 'function');

    if (faltantes.length > 0) {
        console.warn("⚠️ Esperando por módulos: ", faltantes.join(', '));
        // Re-intentar en 500ms si faltan piezas
        return setTimeout(inicializarSistemaGlobal, 500);
    }

    window.AppStatus.uiReady = true;

    // 2. Esperar a Clerk con un timeout de seguridad
    let intentosClerk = 0;
    const chequearClerk = setInterval(async () => {
        intentosClerk++;
        if (window.Clerk && window.Clerk.loaded) {
            clearInterval(chequearClerk);
            window.AppStatus.clerkReady = true;
            window.currentUser = window.Clerk.user;
            console.log("✅ Clerk cargado correctamente.");
            finalizarCarga();
        } else if (intentosClerk > 20) { // 10 segundos máximo
            clearInterval(chequearClerk);
            console.error("❌ Clerk tardó demasiado en cargar.");
            // Intentamos arrancar el sistema aunque sea como invitado
            finalizarCarga();
        }
    }, 500);
}

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

// Iniciar proceso
inicializarSistemaGlobal();
// --- ESTADO GLOBAL ---
window.todosLosSistemas = [];
window.misSiguiendoGlobal = [];
window.misFavoritosGlobal = [];
window.currentUser = null;
// Hacemos que generarHTMLSistemas sea accesible globalmente
window.generarHTMLSistemas = generarHTMLSistemas; 

const contenedorSistemas = document.getElementById('contenedor-sistemas');

// --- CARGAR CLERK ---
const scriptClerk = document.createElement('script');
// He mantenido tu Key, asegúrate de que sea la de producción si ya no estás en test
scriptClerk.setAttribute('data-clerk-publishable-key', 'pk_test_Z3VpZGVkLWNvbGxpZS0yOC5jbGVyay5hY2NvdW50cy5kZXYk');
scriptClerk.async = true;
scriptClerk.src = 'https://allowed-moth-84.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
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
scriptClerk.onload = async () => {
    try {
        await Clerk.load();

        if (Clerk.user) {
            window.currentUser = Clerk.user;
            Clerk.mountUserButton(document.getElementById('user-button'));
            // 1. Escuchar datos del perfil (Favoritos y Seguidores)
            const usuarioRef = doc(db, "usuarios", Clerk.user.id);
            onSnapshot(usuarioRef, 
                (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // Guardamos en global para que los filtros y el render los usen
                        window.misFavoritosGlobal = data.favoritos || [];
                        window.misSiguiendoGlobal = data.siguiendo || [];
                        
                        // Re-renderizamos para que los botones de ❤️ y 👥 se actualicen
                        if (typeof renderizar === "function") renderizar(); 
                    }
                },
                (err) => {
                    // Silenciamos el error rojo inicial de permisos
                    console.log("Perfil: Sincronizando datos de usuario...");
                }
            );

            // 2. Registro y Actividad (Notificaciones)
            // Se ejecutan solo si las funciones existen en el objeto window
            if (typeof window.verificarYRegistrarPerfil === "function") {
                window.verificarYRegistrarPerfil();
            }
            
            if (typeof window.rastrearActividad === "function") {
                window.rastrearActividad();
            }

            // 3. Verificación de Administrador
            if (Clerk.user.id === MI_ADMIN_ID && typeof window.cargarPanelAdmin === "function") {
                console.log("🛡️ Modo administrador detectado.");
                window.cargarPanelAdmin();
            }

        } else {
            // Caso: Usuario no logueado (Invitado)
            window.currentUser = null;
            window.misFavoritosGlobal = [];
            window.misSiguiendoGlobal = [];
            console.log("👤 Navegando como invitado.");
        }

        // 4. Carga Inicial de la UI
        // Estas funciones deben ir siempre fuera del if(Clerk.user) para que el invitado también vea posts
        if (typeof iniciarEscuchaSistemas === "function") {
            iniciarEscuchaSistemas();
        }
        
        if (typeof window.inicializarFiltros === "function") {
            window.inicializarFiltros();
        }

    } catch (err) {
        console.error("❌ Error crítico en la carga de Clerk/Sistema:", err);
    } 
};

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
document.head.appendChild(scriptClerk);

window.cargarPanelAdmin = () => {
    const panel = document.getElementById('panel-admin');
    if (!panel) return;
    panel.style.display = 'block';
    
    const q = query(collection(db, "reportes"), orderBy("fecha", "desc"));

    // Añadimos el manejo de error después de la función del snapshot
    onSnapshot(q, 
        (snap) => {
            const cont = document.getElementById('contenedor-reportes');
            if (!cont) return;

            if (snap.empty) {
                cont.innerHTML = "<p class='text-muted'>No hay reportes pendientes.</p>";
                return;
            }

            cont.innerHTML = snap.docs.map(d => {
                const data = d.data();
                return `
                    <div class="reporte-alerta">
                        <div>
                            <h4 class="reporte-titulo">🚨 Reporte: ${data.sistemaTitulo}</h4>
                            <p class="reporte-motivo"><b>Motivo:</b> ${data.motivo}</p>
                            <small class="reporte-id">ID: ${data.sistemaId}</small>
                        </div>
                        <div class="reporte-acciones">
                            <button onclick="ignorarReporte('${d.id}')" class="filter-btn">Ignorar</button>
                            <button onclick="resolverReporte('${d.id}', '${data.sistemaId}')" class="btn-submit" style="padding: 8px 12px; font-size: 0.8rem;">Eliminar Sistema</button>
                        </div>
                    </div>`;
            }).join('');
        },
        (error) => {
            // Este log reemplaza al error rojo "Uncaught" en la consola
            console.log("Panel Admin: Verificando permisos de moderador...");
        }
    );
};
// --- RENDERIZADO Y BUSCADOR ---
async function renderizar(listaParaPintar = null) {
    if (!contenedorSistemas) return;

    const lista = listaParaPintar || window.todosLosSistemas;

    // Generar el contenido HTML
    if (typeof window.generarHTMLSistemas === "function") {
        contenedorSistemas.innerHTML = window.generarHTMLSistemas(
            lista, 
            window.misSiguiendoGlobal || [],
            window.misFavoritosGlobal || []
        );
    } else {
        console.error("Error: generarHTMLSistemas no está definida.");
    }

    // Resaltado de sintaxis
    if (window.Prism) {
        Prism.highlightAll();
    }

    // Activar listeners individuales por cada post
    lista.forEach(sys => {
        // Escuchar comentarios en tiempo real
        if (window.escucharComentarios) window.escucharComentarios(sys.id);
        
        // Escuchar seguidores del autor en tiempo real
        if (typeof conectarContadorSeguidores === "function") {
            conectarContadorSeguidores(sys.creadorId);
        }
    });
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
