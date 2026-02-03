setInterval(() => {
   console.clear();
   console.log("%c¡ALTO!", "color: red; font-size: 50px; font-weight: bold; -webkit-text-stroke: 1px black;");
   console.log("%cSi alguien te dijo que pegues algo aquí para hackear, te están robando la cuenta.", "font-size: 20px;");
}, 1000);
import { toggleSeguir} from './modules/social-logic.js';
import { escucharComentarios } from './modules/comments-logic.js';

const MI_ADMIN_ID = "user_38lpub6nAzQUEUYMSBDzTcnVNdr"; 
import { 
    db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, 
    doc, updateDoc, increment, setDoc, deleteDoc, getDoc, where, 
    arrayUnion, arrayRemove, getDocs,
    conectarContadorSeguidores
} from './firebase-config.js';

import { generarHTMLSistemas } from './modules/posts-logic.js';

window.generarHTMLSistemas = generarHTMLSistemas;

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
scriptClerk.setAttribute('data-clerk-publishable-key', 'pk_test_Z3VpZGVkLWNvbGxpZS0yOC5jbGVyay5hY2NvdW50cy5kZXYk');
scriptClerk.async = true;
scriptClerk.src = 'https://allowed-moth-84.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';
document.head.appendChild(scriptClerk);

async function inicializarSistemaGlobal() {
    if (window.AppStatus.checked) return;

    try {
        if (!window.Clerk) {
            return setTimeout(inicializarSistemaGlobal, 100);
        }
        await window.Clerk.load();
        const Clerk = window.Clerk;
        
        if (Clerk.user) {
            window.currentUser = Clerk.user;
            window.AppStatus.clerkReady = true;
            mostrarToast("Bienvenido De Vuelta", "success");
            try {
                const token = await Clerk.session.getToken({ template: 'firebase', skipCache: true });
                
                if (token) {
                    const { getAuth, signInWithCustomToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
                    const auth = getAuth();

                    await signInWithCustomToken(auth, token)
                        .then((userCredential) => {
                        })
                        .catch((error) => {
                            window.firebaseUser = {
                                uid: Clerk.user.id,
                                email: Clerk.user.primaryEmailAddress?.emailAddress,
                                isBypass: true
                            };
                        });
                }
            } catch (err) {
            }

            const userBtnDiv = document.getElementById('user-button');
            if (userBtnDiv) {
                Clerk.mountUserButton(userBtnDiv, { 
                    afterSignOutUrl: window.location.origin 
                });
            }
            const usuarioRef = doc(db, "usuarios", Clerk.user.id);
            onSnapshot(usuarioRef, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        window.misFavoritosGlobal = data.favoritos || [];
        window.misSiguiendoGlobal = data.siguiendo || [];
        finalizarCarga()
        if (window.AppStatus.uiReady) {
            renderizar();
            const spansContadores = document.querySelectorAll('[id^="count-seguidores-"]');
            
            spansContadores.forEach(span => {
                const autorId = span.id.replace('count-seguidores-', '');
                if (typeof conectarContadorSeguidores === "function") {
                    conectarContadorSeguidores(autorId);
                }
            });
        }
    }
});
            if (Clerk.user.id===MI_ADMIN_ID) {
                if (window.cargarPanelAdmin) window.cargarPanelAdmin();
            }

        } else {
mostrarToast("Modo Invitado", "success");
const userBtnDiv = document.getElementById('user-button');
        if (userBtnDiv) {
            userBtnDiv.innerHTML = `<button class="js-login-btn btn-publish">Iniciar Sesión</button>`;
        }
        }
        
        if (typeof iniciarEscuchaSistemas === "function") iniciarEscuchaSistemas();
        if (window.inicializarFiltros) window.inicializarFiltros();
        
        const loader = document.getElementById('loader-global');
        if (loader) loader.style.display = 'none';
        window.AppStatus.uiReady = true; 

    } catch (err) {
    }
}
window.addEventListener('load', inicializarSistemaGlobal);

function iniciarEscuchaSistemas() {
    if (!contenedorSistemas) return;
    
    const q = query(collection(db, "sistemas"), orderBy("likes", "desc"));
    
    onSnapshot(q, 
        (snap) => {
            window.todosLosSistemas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderizar();
            if (window.location.hash && window.aplicarEnfoqueSistema) {
                setTimeout(window.aplicarEnfoqueSistema, 500);
            }
        },
        (error) => {
        }
    );
}
window.inicializarFiltros = () => {
    const botones = document.querySelectorAll('.filter-btn');
    if (!botones.length) return;

    botones.forEach(btn => {
        btn.addEventListener('click', () => {
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
                listaFiltrada = todos.filter(sys => (window.misFavoritosGlobal || []).includes(sys.id));
            }
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

        cont.innerHTML = "";

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const reporteId = docSnap.id;
            const sistemaId = data.sistemaId;

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

window.ignorarReporte = async (reporteId) => {
    try {
        await deleteDoc(doc(db, "reportes", reporteId));
    } catch (e) {
        alert("Error al borrar reporte: " + e.message);
    }
};

window.resolverReporte = async (reporteId, sistemaId) => {
    if (!confirm("¿ESTÁS SEGURO? Se eliminará el sistema y se notificará al usuario.")) return;
    
    try {
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const sistemaSnap = await getDoc(sistemaRef);

        if (sistemaSnap.exists()) {
            const sistemaData = sistemaSnap.data();
            const creadorId = sistemaData.creadorId;
            const tituloSistema = sistemaData.titulo;

            await addDoc(collection(db, "notificaciones"), {
                usuarioId: creadorId, 
                titulo: "Sistema Eliminado ⚠️",
                mensaje: `Tu sistema "${tituloSistema}" ha sido eliminado por reportes de la comunidad.`,
                tipo: "alerta",
                fecha: serverTimestamp(),
                leido: false
            });

            await deleteDoc(sistemaRef);
            
            await deleteDoc(doc(db, "reportes", reporteId));

            alert("Sistema eliminado y usuario notificado correctamente.");
        } else {
            await deleteDoc(doc(db, "reportes", reporteId));
            alert("El sistema ya no existe, se limpió el reporte.");
        }
    } catch (e) {
        alert("Hubo un error al procesar la solicitud.");
    }
};
function finalizarCarga() {
    if (window.AppStatus.checked) return;
    window.AppStatus.checked = true;

    if (window.currentUser) {
        if (window.verificarYRegistrarPerfil) window.verificarYRegistrarPerfil();
        if (window.rastrearActividad) window.rastrearActividad();
    }

    if (typeof window.iniciarEscuchaSistemas === "function") {
        window.iniciarEscuchaSistemas();
    } else {
        if (window.renderizar) window.renderizar();
    }
    const loader = document.getElementById('loader-global');
    if (loader) loader.style.display = 'none';
}


async function renderizar(listaParaPintar = null) {
    if (!contenedorSistemas) return;

    const lista = listaParaPintar || window.todosLosSistemas;
    if (typeof window.generarHTMLSistemas === "function") {
        contenedorSistemas.innerHTML = window.generarHTMLSistemas(
            lista, 
            window.misSiguiendoGlobal || [],
            window.misFavoritosGlobal || []
        );
    }
    if (typeof escuchandoComentarios !== 'undefined') escuchandoComentarios.clear();
    if (typeof escuchandoSeguidores !== 'undefined') escuchandoSeguidores.clear();

    if (window.Prism) {
        Prism.highlightAll();
    }

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

    if (typeof aplicarEnfoqueSistema === "function") {
        aplicarEnfoqueSistema();
    }
}

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

window.renderizar = renderizar;
window.iniciarSesionPersonalizada = () => {
    if (window.Clerk) {
        const pathActual = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        
        Clerk.openSignIn({
            afterSignInUrl: pathActual + 'gracias.html', 
            afterSignUpUrl: pathActual + 'gracias.html'
        });
    }
};
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
document.addEventListener('DOMContentLoaded', () => {
    const inputPersona = document.getElementById('input-persona');
    
    if (inputPersona) {
        inputPersona.addEventListener('input', () => {
            window.buscarPersonasApartado();
        });
    }
});
document.getElementById('noti-btn')?.addEventListener('click', () => {
    window.toggleNotificaciones()
});
