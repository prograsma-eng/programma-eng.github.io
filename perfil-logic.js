import { db, collection, query, where, onSnapshot, orderBy, doc, getDoc, conectarContadorSeguidores } from './js/firebase-config.js';
import{compartirSistemaIndividual,toggleModoEditor,toggleArchivo} from './js/modules/posts-logic.js'
import{toggleSeguir} from './js/modules/social-logic.js'
// 1. PRIMERO: Obtener el ID de la URL
const params = new URLSearchParams(window.location.search);
const idPerfil = params.get("id");

// 2. Referencias al DOM
const contenedor = document.getElementById('contenedor-sistemas');
const header = document.getElementById('perfil-header');

// 3. Validación de ID
if (!idPerfil) {
    window.location.href = 'index.html';
} else {
    ejecutarCargaPerfil();
}

// ... tus imports actuales ...

async function ejecutarCargaPerfil() {
    if (!idPerfil) return;

    const usuarioRef = doc(db, "usuarios", idPerfil);
    
    onSnapshot(usuarioRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const dataUser = docSnap.data();
        const seguidoresActuales = dataUser.seguidoresCount || 0;
        
        // 1. Si el header no existe, lo creamos
        if (!document.getElementById('perfil-card-main')) {
            header.innerHTML = `
                <div class="perfil-header-card" id="perfil-card-main">
                    <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
                        <button class="btn-volver" onclick="window.location.href='index.html'">← Volver</button>
                        <div id="contenedor-boton-seguir"></div>
                    </div>
                    <img src="${dataUser.foto || 'default-avatar.png'}" class="avatar-perfil-grande">
                    <h1 class="nombre-perfil">${dataUser.nombre || 'Usuario'}</h1>
                    <div class="perfil-stats">
                        <div class="stat-item">
                            <span id="count-seguidores-perfil" class="stat-valor">${seguidoresActuales}</span>
                            <span class="stat-label">Seguidores</span>
                        </div>
                    </div>
                </div>`;
            
            verificarEstadoSeguimiento();
        } else {
            // 2. 🔥 SI YA EXISTE, actualizamos SOLO el número
            const spanContador = document.getElementById('count-seguidores-perfil');
            if (spanContador) {
                spanContador.innerText = seguidoresActuales;
            }
        }
    });
}
// Nueva función para manejar la lógica del botón por separado
async function verificarEstadoSeguimiento() {
    // Esperamos un momento a que Clerk cargue si es que no está listo
    const user = window.Clerk?.user;
    
    if (user) {
        const miUserRef = doc(db, "usuarios", user.id);
        onSnapshot(miUserRef, (miSnap) => {
            if (miSnap.exists()) {
                const misSiguiendo = miSnap.data().siguiendo || [];
                const loSigo = misSiguiendo.includes(idPerfil);
                const esMio = user.id === idPerfil;
                
                if (!esMio) {
                    renderizarBotonSeguir(loSigo);
                } else {
                    // Si es mi propio perfil, podemos poner un botón de "Editar" o nada
                    const contenedor = document.getElementById('contenedor-boton-seguir');
                    if(contenedor) contenedor.innerHTML = ''; 
                }
            }
        });
    } else {
        // Si no hay usuario, podemos mostrar el botón pero que pida login al hacer clic
        console.warn("Clerk no detectó usuario, reintentando en 1s...");
        setTimeout(verificarEstadoSeguimiento, 1000);
    }
}
// Función global para que toggleSeguir también pueda llamarla si es necesario
window.renderizarBotonSeguir = function(loSigo) {
    const contenedor = document.getElementById('contenedor-boton-seguir');
    if (!contenedor) return;

    contenedor.innerHTML = `
        <button class="js-seguirt ${loSigo ? 'siguiendo' : 'no-siguiendo'}" 
            data-user="${idPerfil}"
            style="padding: 8px 16px; border-radius: 20px; font-weight: bold; border: none; cursor: pointer;
            background-color: ${loSigo ? '#f0f0f0' : '#000'}; 
            color: ${loSigo ? '#555' : '#fff'};">
            ${loSigo ? '❌ Dejar de seguir' : '🔔 Seguir'}
        </button>
    `;
};
document.addEventListener('click', async (e) => {
    const target = e.target;
    const btnSeguir = target.closest('.js-seguirt');
    
    if (btnSeguir) {
        // Evitamos que el clic se propague a otros elementos
        e.preventDefault();
        e.stopImmediatePropagation(); 
        
        // Desactivamos el botón un segundo para evitar doble clic accidental
        btnSeguir.style.pointerEvents = 'none';
        btnSeguir.style.opacity = '0.5';
        
        await toggleSeguir(btnSeguir.dataset.user);
        
        // Lo reactivamos (opcional, el onSnapshot lo hará al re-renderizar el botón)
        btnSeguir.style.pointerEvents = 'auto';
        btnSeguir.style.opacity = '1';
    }
});

// Esta función ya no necesita el bucle forEach porque los quitamos de las tarjetas
function escucharSeguidores(creadorId) {
    if (!creadorId) return;
    conectarContadorSeguidores(creadorId);
}
window.compartirPerfil = function() {
    // Obtenemos la URL actual del perfil
    const urlPerfil = window.location.href;

    navigator.clipboard.writeText(urlPerfil).then(() => {
        // Buscamos el botón para dar feedback visual
        const btn = document.querySelector('.btn-compartir');
        const textoOriginal = btn.innerHTML;
        
        btn.innerHTML = "✅ ¡Copiado!";
        
        // Lo devolvemos a la normalidad después de 2 segundos
        setTimeout(() => {
            btn.innerHTML = textoOriginal;
        }, 2000);
    }).catch(err => {
        alert("No se pudo copiar el enlace. Cópialo manualmente de la barra de direcciones.");
    });
};