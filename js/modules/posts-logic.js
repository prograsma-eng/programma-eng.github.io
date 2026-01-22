import { 
    db, 
    doc, 
    updateDoc, 
    increment, 
    arrayUnion,
    arrayRemove,
    getDoc, 
    addDoc, 
    collection, 
    deleteDoc,
    serverTimestamp, 
    setDoc,
} from '../firebase-config.js';

import {enviarComentario,toggleSeccionComentarios} from './comments-logic.js'
const LIMITE_PALABRAS = 50;
// --- ARREGLO DE REFERENCIAS GLOBALES ---
// Esto asegura que si todosLosSistemas no está definido aquí, lo busque en el objeto global
const obtenerSistemas = () => window.todosLosSistemas || [];

export const toggleModoEditor = (id) => {
    window.editandoId = (window.editandoId === id) ? null : id;
    if (typeof window.renderizar === "function") window.renderizar();
};

const guardarTitulo = async (id) => {
    const el = document.getElementById(`title-${id}`);
    if (!el) return;
    const nuevoTitulo = el.innerText.trim();

    if (!nuevoTitulo) return alert("El título no puede estar vacío");

    try {
        const sistemaRef = doc(db, "sistemas", id);
        await updateDoc(sistemaRef, { titulo: nuevoTitulo });
        el.style.color = "#4CAF50"; 
        setTimeout(() => el.style.color = "", 1000);
    } catch (e) {
        console.error(e);
        alert("Error al guardar.");
    }
};
export const toggleArchivo = (id) => {
    const wrap = document.getElementById(`wrap-${id}`);
    if (!wrap) return;

    if (wrap.style.display === "none" || !wrap.style.maxHeight || wrap.style.maxHeight === "0px") {
        wrap.style.display = "block";
        setTimeout(() => {
            wrap.style.maxHeight = "1000px"; // Aumentado para códigos largos
            wrap.style.opacity = "1";
        }, 10);
    } else {
        wrap.style.maxHeight = "0px";
        wrap.style.opacity = "0";
        setTimeout(() => {
            wrap.style.display = "none";
        }, 300);
    }
};

const agregarCampoArchivo = () => {
    const container = document.getElementById('archivos-input-container');
    if (!container) return;
    const div = document.createElement('div');
    div.className = "archivo-input-item";
    div.innerHTML = `
        <div class="archivo-input-header">
            <input type="text" class="arc-nombre" placeholder="Nombre (ej: Loader)" required style="flex:2;">
            <select class="arc-tipo" style="flex:1;">
                <option value="Script">📜 Script</option>
                <option value="LocalScript">💻 LocalScript</option>
                <option value="ModuleScript">📦 ModuleScript</option>
            </select>
            <button type="button" class="btn-remove-script" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
        <textarea class="arc-codigo" placeholder="Código aquí..."></textarea>
    `;
    container.appendChild(div);
};
// Variable para evitar el spam de clics
// Variable fuera de la función para controlar el spam de clics

let bloqueadoLike = false;
export const darLike = async (sistemaId, creadorId) => {
    const user = window.Clerk?.user;
    if (!user) return alert("Inicia sesión para votar");
    if (user.id === creadorId) return alert("No puedes dar like a tu propio sistema.");
    if (bloqueadoLike) return;

    bloqueadoLike = true; 
    try {
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const usuarioRef = doc(db, "usuarios", user.id);
        if (!window.misLikesGlobal) window.misLikesGlobal = [];
        const yaDioLike = window.misLikesGlobal.includes(sistemaId);

        if (yaDioLike) {
            await updateDoc(sistemaRef, { likes: increment(-1), usuariosQueDieronLike: arrayRemove(user.id) });
            await updateDoc(usuarioRef, { likesDados: arrayRemove(sistemaId) });
            window.misLikesGlobal = window.misLikesGlobal.filter(id => id !== sistemaId);
        } else {
            await updateDoc(sistemaRef, { likes: increment(1), usuariosQueDieronLike: arrayUnion(user.id) });
            await updateDoc(usuarioRef, { likesDados: arrayUnion(sistemaId) });
            window.misLikesGlobal.push(sistemaId);
        }
        if (typeof window.renderizar === "function") window.renderizar();
    } catch (error) {
        console.error(error);
    } finally {
        bloqueadoLike = false;
    }
};

const eliminarSistema = async (sysId) => {
    if (!confirm("¿Estás seguro de eliminar este sistema?")) return;

    try {
        await deleteDoc(doc(db, "sistemas", sysId));
        console.log("✅ Sistema eliminado");
        // Refrescar la lista
        if (typeof window.renderizar === "function") window.renderizar();
    } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No tienes permisos para eliminar este sistema.");
    }
};

const toggleFavorito = async (sistemaId) => {
    const user = window.Clerk?.user;
    if (!user) return window.Clerk?.openSignIn();

    const userRef = doc(db, "usuarios", user.id);
    const sistemaRef = doc(db, "sistemas", sistemaId);
    
    try {
        const userSnap = await getDoc(userRef);
        const sistemaSnap = await getDoc(sistemaRef);
        
        if (!sistemaSnap.exists()) return;
        const datosSistema = sistemaSnap.data();

        // REGLA: No puedes dar favorito a lo tuyo
        if (datosSistema.creadorId === user.id) {
            return alert("❌ No puedes marcar como favorito tus propios sistemas.");
        }

        let favoritos = userSnap.exists() ? (userSnap.data().favoritos || []) : [];
        const yaEsFavorito = favoritos.includes(sistemaId);

        if (yaEsFavorito) {
            // QUITAR DE FAVORITOS
            await updateDoc(userRef, { favoritos: arrayRemove(sistemaId) });
            await updateDoc(sistemaRef, { favsCount: increment(-1) });
            window.misFavoritosGlobal = window.misFavoritosGlobal.filter(id => id !== sistemaId);
        } else {
            // AÑADIR A FAVORITOS
            await updateDoc(userRef, { favoritos: arrayUnion(sistemaId) });
            await updateDoc(sistemaRef, { favsCount: increment(1) });
            if (!window.misFavoritosGlobal) window.misFavoritosGlobal = [];
            window.misFavoritosGlobal.push(sistemaId);
        }
        
        if (typeof window.renderizar === "function") window.renderizar();
    } catch (error) {
        console.error("Error en favorito:", error);
    }
};

export const compartirSistemaIndividual = async (sistemaId, creadorId) => {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const urlCompartir = `${baseUrl}/perfil.html?id=${creadorId}#sistema-${sistemaId}`;

    navigator.clipboard.writeText(urlCompartir).then(() => {
        alert("¡Enlace al sistema copiado al portapapeles!");
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
};
const aplicarEnfoqueSistema = function() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#sistema-')) {
        const elemento = document.querySelector(hash);
        if (elemento) {
            elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
            elemento.classList.add('resaltar-sistema');
            setTimeout(() => {
                elemento.classList.remove('resaltar-sistema');
            }, 3000);
        }
    }
};
const escaparHTML = (str) => {
    if (!str) return "";
    // Bloqueo directo si detecta etiquetas maliciosas
    if (/[<>]/.test(str)) return "Contenido bloqueado";
    return str.replace(/[&"']/g, m => ({
        '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[m]));
};
// --- FUNCIÓN DE GENERACIÓN DE HTML ---
export function generarHTMLSistemas(lista, misSiguiendo = [], misFavoritos = [], mostrarSeguidores = true) {
    if (!lista || lista.length === 0) return `<p class='text-center text-muted'>No se encontraron sistemas.</p>`;
    const params = new URLSearchParams(window.location.search);
    const idPerfilUrl = params.get("id");

    const htmlFinal = lista.map(sys => {
        if (idPerfilUrl && sys.creadorId !== idPerfilUrl) return '';
        const tituloSeguro = sys.titulo.replace(/'/g, "\\'");
        const esDueno = window.currentUser &&
                        String(sys.creadorId).trim() === String(window.currentUser.id).trim();
        const yaLoSigo = misSiguiendo.includes(sys.creadorId);
        const esFavorito = window.currentUser && misFavoritos.includes(sys.id);

        const htmlArchivos = sys.archivos.map((arc, i) => {
            const tipoClase = `type-${arc.tipo.toLowerCase().replace(/\s+/g, '')}`;
            return `
            <div class="archivo-item">
                <div class="archivo-header js-toggle-archivo" data-id="${sys.id}-${i}">
                 <span>
                        <span class="tag-badge ${tipoClase}">
                            ${arc.tipo === 'Script' ? '🟩' : arc.tipo === 'LocalScript' ? '🟦' : '🟪'} ${escaparHTML(arc.tipo)}
                        </span>
                        <b class="font-code">${escaparHTML(arc.nombre)}.lua</b>
                    </span>
                    <div class="flex-row">
                        <button class="btn-copy" onclick="event.stopPropagation(); window.copiarCodigo('${escaparHTML(sys.id)}-${i}')">📋</button>
                        ${window.editandoId === sys.id ? `
                            <button onclick="event.stopPropagation(); window.guardarEdicion('${escaparHTML(sys.id)}', ${i})">💾</button>
                            <button onclick="event.stopPropagation(); window.eliminarScript('${escaparHTML(sys.id)}', ${i})" class="text-danger">✕</button>
                        ` : ''}
                    </div>
                </div>
                <div class="codigo-wrapper" id="wrap-${sys.id}-${i}" style="display: none;">
                    <pre class="language-lua"><code id="edit-${sys.id}-${i}" contenteditable="${window.editandoId === sys.id}">${escaparHTML(arc.codigo)}</code></pre>
                </div>
            </div>`;
        }).join('');
        return `
        <div class="sistema-container ${window.editandoId === sys.id ? 'editando' : ''}" id="sistema-${sys.id}">
            <div class="sistema-header">
                <div class="autor-box">
                    <img src="${escaparHTML(sys.foto)}" class="comentario-avatar"
                         onclick="window.location.href='perfil.html?id=${escaparHTML(sys.creadorId)}'"
                         style="cursor:pointer;">
                    <div>
                        <div class="flex-row">
                            <h2
                            id="title-${sys.id}"
                            contenteditable="${window.editandoId === sys.id}"
                            onblur="window.guardarTitulo('${sys.id}')"
                            onkeydown="if(event.key === 'Enter') { event.preventDefault(); this.blur(); }">
                            ${escaparHTML(sys.titulo)}
                        </h2>
                            <span class="tag-badge">#${escaparHTML(sys.tag)}</span>
                        </div>
                        <div class="flex-row">
                            <p class="text-dim">Por
                                <span class="text-accent" onclick="window.location.href='perfil.html?id=${escaparHTML(sys.creadorId)}'" style="cursor:pointer; font-weight:bold;">
                                    ${escaparHTML(sys.autor)}
                                </span>
                                ${mostrarSeguidores ? `
                                    <span class="seguidores-badge">
                                        👤 <span id="count-seguidores-${escaparHTML(sys.creadorId)}">0</span>
                                    </span>
                                ` : ''}
                                ${(!esDueno && mostrarSeguidores) ? `
                                    <button onclick="window.toggleSeguir('${escaparHTML(sys.creadorId)}')"
                                        class="btn-seguir ${yaLoSigo ? 'siguiendo' : 'no-siguiendo'}">
                                        ${yaLoSigo ? '❌ Dejar de seguir' : '🔔 Seguir'}
                                    </button>
                                ` : ''}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="acciones-box">
                    ${esDueno ? `<button onclick="window.toggleModoEditor('${sys.id}')">${window.editandoId === sys.id ? '✅' : '✏️'}</button>` : ''}
                    <button class="js-compartir" data-id="${sys.id}" data-creador="${sys.creadorId}" title="Copiar enlace">🔗</button>
                    <button onclick="window.reportarSistema('${sys.id}', '${escaparHTML(tituloSeguro)}')">🚩</button>
                   ${esDueno ? `<button onclick="window.eliminarSistema('${sys.id}')">🗑️</button>` : ''}
                    <button class="js-like ${esDueno ? 'disabled' : ''}" data-id="${sys.id}" data-creador="${sys.creadorId}">❤️ ${sys.likes || 0}</button>
                    <button class="js-fav ${esFavorito ? 'activo' : ''}" data-id="${sys.id}">${esFavorito ? '⭐' : '☆'}</button>
                    <button onclick="window.descargarSistema('${sys.id}')" title="Descargar ZIP">📥 Descargar</button>
                </div>
            </div>
            <div class="lista-archivos-container">${htmlArchivos}</div>
            ${window.editandoId === sys.id ? `
                <div style="padding: 10px;">
                    <button onclick="window.nuevoScriptEnSistema('${sys.id}')" class="btn-nuevo-script">➕ Añadir nuevo Script</button>
                </div>
            ` : ''}
            <div class="footer-comentarios" style="border-top: 1px solid #222; margin-top: 10px;">
                <button class="btn-toggle-comentarios" onclick="toggleSeccionComentarios('${sys.id}')" id="btn-coms-${sys.id}"
                        style="width:100%; padding:10px; background:none; border:none; color:var(--accent); cursor:pointer;">
                    💬 Ver comentarios
                </button>
                <div class="comentarios-wrapper" id="wrapper-${sys.id}" style="max-height:0; overflow:hidden; transition: max-height 0.4s ease;">
                    <div class="comentarios-section" style="padding: 10px; background: rgba(0,0,0,0.2);">
                        <form onsubmit="window.enviarComentario(event, '${sys.id}')" class="flex-row" style="margin-bottom:10px;">
                            <input type="text" placeholder="Escribe un comentario..." class="input-minimal" style="flex:1;">
                            <button type="submit" class="Enviar">Enviar</button>
                        </form>
                        <div id="coms-${sys.id}"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
    return htmlFinal.replace(/>\s+</g, '><').trim();

};
const nuevoScriptEnSistema = async (sysId) => {
    // 1. Pedir el nombre del archivo
    const nombre = prompt("Nombre del archivo (ej: logica, utilidades):");
    if (!nombre) return;

    // 2. Pedir el tipo de script con una pequeña validación
    const seleccion = prompt("Elige el tipo: \n1. script\n2. modulescript\n3. localscript").toLowerCase().trim();
    
    let tipoFinal = "";
    if (seleccion === "1" || seleccion === "script") tipoFinal = "script";
    else if (seleccion === "2" || seleccion === "modulescript") tipoFinal = "modulescript";
    else if (seleccion === "3" || seleccion === "localscript") tipoFinal = "localscript";
    else {
        alert("Tipo no válido. Usa: script, modulescript o localscript.");
        return;
    }

    // 3. Buscar el sistema en tus listas locales
    const sistema = (window.todosLosSistemas || []).find(s => s.id === sysId);
    
    if (!sistema) {
        console.error("No se encontró el sistema con ID:", sysId);
        return;
    }

    // 4. Crear el nuevo array de archivos
    const nuevosArchivos = [...(sistema.archivos || []), { 
        nombre: nombre, 
        tipo: tipoFinal, // Aquí se guarda la elección
        codigo: `-- Nuevo ${tipoFinal}\nprint("Hola Mundo")` 
    }];

    try {
        // 5. Actualizar en Firebase
        await updateDoc(doc(db, "sistemas", sysId), { 
            archivos: nuevosArchivos 
        });
        
        console.log(`✅ ${tipoFinal} añadido con éxito.`);
        
        // Refrescar la UI si tienes la función disponible
        if (typeof window.renderizar === "function") window.renderizar();

    } catch (error) {
        console.error("Error al guardar el nuevo script:", error);
        alert("No tienes permisos para editar este sistema.");
    }
};
const eliminarScript = async (sysId, indiceScript) => {
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
document.addEventListener('click', async (e) => {
    const target = e.target;

    // Like
    if (target.closest('.js-like')) {
        const btn = target.closest('.js-like');
        darLike(btn.dataset.id, btn.dataset.creador);
    }

    // Toggle Archivo
    if (target.closest('.js-toggle-archivo')) {
        toggleArchivo(target.closest('.js-toggle-archivo').dataset.id)
    }

    // Modo Editor
    if (target.closest('.js-edit-modo')) {
        toggleModoEditor(target.closest('.js-edit-modo').dataset.id);
    }
    if (target.closest('.js-seguir')) {
    const userId = target.closest('.js-seguir').dataset.user;
    window.toggleSeguir(userId); // Llama a tu función existente
}

// 2. Botón Descargar
if (target.closest('.js-descargar')) {
    window.descargarSistema(target.closest('.js-descargar').dataset.id);
}

// 3. Botón Reportar
if (target.closest('.js-reportar')) {
    const btn = target.closest('.js-reportar');
    window.reportarSistema(btn.dataset.id, btn.dataset.titulo);
}

// 4. Botón Compartir
if (target.closest('.js-compartir')) {
    const btn = target.closest('.js-compartir');
    compartirSistemaIndividual(btn.dataset.id, btn.dataset.creador);
}

// 5. Botón Nuevo Script (en edición)
if (target.closest('.js-nuevo-script')) {
    window.nuevoScriptEnSistema(target.closest('.js-nuevo-script').dataset.id);
}

    // Favorito
    if (target.closest('.js-fav')) {
        toggleFavorito(target.closest('.js-fav').dataset.id)
    }

    // Comentarios (Toggle)
    if (target.closest('.js-ver-comentarios')) {
        toggleSeccionComentarios(target.closest('.js-ver-comentarios').dataset.id);
    }
});

// Manejo de formularios de comentarios
document.addEventListener('submit', (e) => {
    if (e.target.classList.contains('js-form-comentario')) {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const palabras = input.value.trim().split(/\s+/).filter(p => p.length > 0);

        if (palabras.length > LIMITE_PALABRAS) {
            return alert(`Máximo ${LIMITE_PALABRAS} palabras.`);
        }
        enviarComentario(e, e.target.dataset.id);
    }
});

// Manejo de guardado de título al perder el foco (onblur)
document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('js-titulo-editable')) {
        guardarTitulo(e.target.dataset.id);
    }
});