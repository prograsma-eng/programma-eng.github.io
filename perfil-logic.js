import { db, collection, query, where, onSnapshot, orderBy, doc, getDoc, conectarContadorSeguidores } from './js/firebase-config.js';
import{compartirSistemaIndividual,toggleModoEditor,toggleArchivo} from './js/modules/posts-logic.js'
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

    // 1. Escuchar los datos del dueño del perfil (para el nombre, foto y contador)
    const usuarioRef = doc(db, "usuarios", idPerfil);
    onSnapshot(usuarioRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const dataUser = docSnap.data();
        
        // Renderizamos el esqueleto una sola vez
        if (!document.getElementById('perfil-card-main')) {
            header.innerHTML = `
                <div class="perfil-header-card" id="perfil-card-main">
                    <div style="display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px;">
                        <button class="btn-volver" onclick="window.location.href='index.html'">← Volver</button>
                        <div style="display: flex; gap: 10px;">
                            <div id="contenedor-boton-seguir"></div>
                        </div>
                    </div>
                    <img src="${dataUser.foto || 'default-avatar.png'}" class="avatar-perfil-grande">
                    <h1 class="nombre-perfil">${dataUser.nombre || 'Usuario'}</h1>
                    <div class="perfil-stats">
                        <div class="stat-item">
                            <span id="count-seguidores" class="stat-valor">${dataUser.seguidoresCount || 0}</span>
                            <span class="stat-label">Seguidores</span>
                        </div>
                    </div>
                </div>`;
        } else {
            // Si ya existe, solo actualizamos el contador por si alguien más le da follow
            document.getElementById('count-seguidores').innerText = dataUser.seguidoresCount || 0;
        }

        // 2. UNA VEZ QUE EL HEADER EXISTE, escuchamos AL USUARIO LOGUEADO
        if (window.currentUser) {
            const miUserRef = doc(db, "usuarios", window.currentUser.id);
            onSnapshot(miUserRef, (miSnap) => {
                if (miSnap.exists()) {
                    const misSiguiendo = miSnap.data().siguiendo || [];
                    const loSigo = misSiguiendo.includes(idPerfil);
                    const esMio = window.currentUser.id === idPerfil;
                    
                    if (!esMio) {
                        renderizarBotonSeguir(loSigo);
                    }
                }
            });
        }
    });
}

// Función global para que toggleSeguir también pueda llamarla si es necesario
window.renderizarBotonSeguir = function(loSigo) {
    const contenedor = document.getElementById('contenedor-boton-seguir');
    if (!contenedor) return;

    contenedor.innerHTML = `
        <button onclick="toggleSeguir('${idPerfil}')" 
            class="btn-seguir ${loSigo ? 'siguiendo' : 'no-siguiendo'}"
            style="padding: 8px 16px; border-radius: 20px; font-weight: bold; border: none; cursor: pointer;
            background-color: ${loSigo ? '#f0f0f0' : '#000'}; 
            color: ${loSigo ? '#555' : '#fff'};">
            ${loSigo ? '❌ Dejar de seguir' : '🔔 Seguir'}
        </button>
    `;
};

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