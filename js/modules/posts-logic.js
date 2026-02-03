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

import {toggleSeccionComentarios} from './comments-logic.js'
import {toggleSeguir} from './social-logic.js'
const LIMITE_PALABRAS = 50;
// --- ARREGLO DE REFERENCIAS GLOBALES ---
// Esto asegura que si todosLosSiste000mas no está definido aquí, lo busque en el objeto global
const obtenerSistemas = () => window.todosLosSistemas || [];


 const toggleModoEditor = (id) => {
    window.editandoId = (window.editandoId === id) ? null : id;
    if (typeof window.renderizar === "function") window.renderizar();
    if (typeof window.renderizarSegunTab === "function") window.renderizarSegunTab();
};

const  guardarTitulo = async (id) => {
    const el = document.getElementById(`title-${id}`);
    if (!el) return;
    const nuevoTitulo = el.innerText.trim();

    if (!nuevoTitulo) {
        mostrarToast("El título no puede estar vacío", "error");
        return;
    }

    try {
        const sistemaRef = doc(db, "sistemas", id);
        await updateDoc(sistemaRef, { titulo: nuevoTitulo });
        mostrarToast("Título actualizado", "success");
    } catch (e) {
        console.error(e);
        mostrarToast("Error al guardar título", "error");
    }
};
 const toggleArchivo = (id) => {
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
    
    // 1. Definimos el HTML SIN ningún "onclick"
    div.innerHTML = `
        <div class="archivo-input-header">
            <input type="text" class="arc-nombre" placeholder="Nombre (ej: Loader)" required style="flex:2;">
            <select class="arc-tipo" style="flex:1;">
                <option value="Script">📜 Script</option>
                <option value="LocalScript">💻 LocalScript</option>
                <option value="ModuleScript">📦 ModuleScript</option>
            </select>
            <button type="button" class="btn-remove-script">✕</button>
        </div>
        <textarea class="arc-codigo" placeholder="Código aquí..."></textarea>
    `;

    // 2. Agregamos el evento de borrar de forma segura mediante código, no mediante HTML
    const botonBorrar = div.querySelector('.btn-remove-script');
    botonBorrar.addEventListener('click', () => {
        div.remove();
    });

    container.appendChild(div);
};
let bloqueadoLike = false;


const darLike = async (sistemaId, creadorId) => {
    const user = window.Clerk?.user;
    if (!user) return mostrarToast("Inicia sesión para votar" ,"error");
    if (user.id === creadorId) return mostrarToast("No puedes dar like a tu propio sistema", "error");
    if (bloqueadoLike) return;

    bloqueadoLike = true; 
    try {
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const usuarioRef = doc(db, "usuarios", user.id);
        const sistemaSnap = await getDoc(sistemaRef);
        
        if (!sistemaSnap.exists()) return;
        if (!window.misLikesGlobal) window.misLikesGlobal = [];

        const listaLikes = sistemaSnap.data().usuariosQueDieronLike || [];
        const yaDioLike = listaLikes.includes(user.id);

        if (yaDioLike) {
            await updateDoc(sistemaRef, { likes: increment(-1), usuariosQueDieronLike: arrayRemove(user.id) });
            await updateDoc(usuarioRef, { likesDados: arrayRemove(sistemaId) });
            window.misLikesGlobal = window.misLikesGlobal.filter(id => id !== sistemaId);
            mostrarToast("Like quitado");
        } else {
            await updateDoc(sistemaRef, { likes: increment(1), usuariosQueDieronLike: arrayUnion(user.id) });
            await updateDoc(usuarioRef, { likesDados: arrayUnion(sistemaId) });
            window.misLikesGlobal.push(sistemaId);
            mostrarToast("¡Te gusta este sistema!", "success");
        }
        if (typeof window.renderizar === "function") window.renderizar();
    } catch (error) {
        console.error(error);
        mostrarToast("Error al procesar voto", "error");
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

const compartirSistemaIndividual = async (sistemaId, creadorId) => {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const urlCompartir = `${baseUrl}/perfil.html?id=${creadorId}#sistema-${sistemaId}`;

    try {
        await navigator.clipboard.writeText(urlCompartir);
        mostrarToast("🔗 Enlace copiado al portapapeles", "success");
    } catch (err) {
        console.error('Error al copiar: ', err);
        mostrarToast("No se pudo copiar el enlace", "error");
    }
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
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
};
  const iconos = {
                        'Script': '🟩',
                        'localscript': '🟦',
                        'modulescript': '🟪'
                         };
// --- FUNCIÓN DE GENERACIÓN DE HTML ---

function generarHTMLSistemas(lista, misSiguiendo = [], misFavoritos = [], mostrarSeguidores = true) {
    if (!lista || lista.length === 0) return `<p class='text-center text-muted'>No se encontraron sistemas ⚙️.</p>`;

    const idPerfilUrl = new URLSearchParams(window.location.search).get("id");

    const htmlFinal = lista.map(sys => {
        // Filtro de perfil
        if (idPerfilUrl && sys.creadorId !== idPerfilUrl) return '';

        const idCreadorRef = String(sys.creadorId).trim();
        const esDueno = window.currentUser && String(window.currentUser.id).trim() === idCreadorRef;
        const yaLoSigo = misSiguiendo.some(id => String(id).trim() === idCreadorRef);
        const esFavorito = window.misFavoritosGlobal?.includes(sys.id);

        // Renderizado de archivos (Scripts)
        const htmlArchivos = sys.archivos.map((arc, i) => {
            const idArchivo = `${sys.id}-${i}`; 
            const tipoClase = `type-${arc.tipo.toLowerCase().replace(/\s+/g, '')}`;
            
            return `
            <div class="archivo-item">
                <div class="archivo-header js-toggle-archivo" data-id="${idArchivo}">
                    <span>
                        <span class="tag-badge ${tipoClase}">
                            ${iconos[arc.tipo] || '⚪'} ${escaparHTML(arc.tipo)}
                        </span>
                        <b class="font-code">${escaparHTML(arc.nombre)}.lua</b>
                    </span>
                    <div class="flex-row">
                        <button class="js-copy-code btn-copy" data-id="${idArchivo}" title="Copiar código">📋</button>
                        ${window.editandoId === sys.id ? `
                            <button class="js-save-edit" data-sysid="${sys.id}" data-index="${i}" title="Guardar">💾</button>
                            <button class="js-delete-script text-danger" data-sysid="${sys.id}" data-index="${i}" title="Eliminar">✕</button>
                        ` : ''}
                    </div>
                </div>
                <div class="codigo-wrapper" id="wrap-${idArchivo}" style="display: none;">
                    <pre class="language-lua"><code id="edit-${idArchivo}" contenteditable="${window.editandoId === sys.id}">${escaparHTML(arc.codigo)}</code></pre>
                </div>
            </div>`;
        }).join('');

        // Renderizado del contenedor principal del sistema
        return `
        <div class="sistema-container ${window.editandoId === sys.id ? 'editando' : ''}" id="sistema-${sys.id}">
            <div class="sistema-header">
                <div class="autor-box">
                    <img src="${escaparHTML(sys.foto)}" 
                         class="comentario-avatar js-perfil-link" 
                         data-url="perfil.html?id=${escaparHTML(sys.creadorId)}"
                         alt="Avatar de ${escaparHTML(sys.autor)}"
                         style="cursor:pointer;">
                    <div>
                        <div class="flex-row">
                            <h2 id="title-${sys.id}" 
                                class="${window.editandoId === sys.id ? 'js-titulo-editable' : ''}" 
                                data-id="${sys.id}"
                                contenteditable="${window.editandoId === sys.id}">
                                ${escaparHTML(sys.titulo)}
                            </h2>
                            <span class="tag-badge">#${escaparHTML(sys.tag)}</span>
                        </div>
                        <div class="flex-row">
                            <p class="text-dim">Por 
                                <span class="text-accent js-perfil-link" 
                                      data-url="perfil.html?id=${escaparHTML(sys.creadorId)}" 
                                      style="cursor:pointer; font-weight:bold;">
                                    ${escaparHTML(sys.autor)}
                                </span>
                                ${mostrarSeguidores ? `
                                    <span class="seguidores-badge">
                                        👤 <span id="count-seguidores-${escaparHTML(sys.creadorId)}">0</span>
                                    </span>
                                ` : ''}
                                ${(!esDueno && mostrarSeguidores) ? `
                                    <button class="js-seguir ${yaLoSigo ? 'siguiendo' : 'no-siguiendo'}" 
                                            data-user="${escaparHTML(sys.creadorId)}">
                                        ${yaLoSigo ? '❌ Dejar de seguir' : '🔔 Seguir'}
                                    </button>
                                ` : ''}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="acciones-box">
                    ${esDueno ? `<button class="js-edit-modo" data-id="${sys.id}">${window.editandoId === sys.id ? '✅' : '✏️'}</button>` : ''}
                    <button class="js-compartir" data-id="${sys.id}" data-creador="${sys.creadorId}" title="Copiar enlace">🔗</button>
                    <button class="js-reportar" data-id="${sys.id}" data-titulo="${escaparHTML(sys.titulo)}" title="Reportar">🚩</button>
                    ${esDueno ? `<button class="js-EliminarSistema" data-id="${sys.id}" title="Eliminar Sistema">🗑️</button>` : ''}
                   <button 
                        class="js-like ${esDueno ? 'btn-desactivado' : ''}" 
                        ${esDueno ? 'disabled' : ''} 
                        data-id="${sys.id}" 
                        data-creador="${sys.creadorId}">
                        ❤️ ${sys.likes || 0}
                    </button>
                    <button class="js-fav ${esFavorito ? 'activo' : ''}" data-id="${sys.id}">${esFavorito ? '⭐' : '☆'}</button>
                    <button class="js-descargar" data-id="${sys.id}" title="Descargar ZIP">📥 Descargar</button>
                </div>
            </div>

            <div class="lista-archivos-container">${htmlArchivos}</div>

            ${window.editandoId === sys.id ? `
                <div style="padding: 10px;">
                    <button class="js-nuevo-script btn-nuevo-script" data-id="${sys.id}">➕ Añadir nuevo Script</button>
                </div>
            ` : ''}

            <div class="footer-comentarios" style="border-top: 1px solid #222; margin-top: 10px;">
                <button class="js-ver-comentarios" data-id="${sys.id}">💬 Ver comentarios</button>
                <div class="comentarios-wrapper" id="wrapper-${sys.id}" style="max-height:0; overflow:hidden; transition: max-height 0.4s ease;">
                    <div class="comentarios-section" style="padding: 10px; background: rgba(0,0,0,0.2);">
                        <form class="js-form-comentario flex-row" 
                              data-id="${sys.id}" 
                              name="form-comentario-${sys.id}"
                              id="form-com-${sys.id}"
                              style="margin-bottom:10px;">
                            <input type="text" 
                                   name="texto-comentario"
                                   id="input-text-${sys.id}"
                                   placeholder="Escribe un comentario..." 
                                   class="input-minimal" 
                                   required 
                                   style="flex:1;">
                            <button type="submit" class="Enviar">Enviar</button>
                        </form>
                        <div id="coms-${sys.id}"></div>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    return htmlFinal.replace(/>\s+</g, '><').trim();
}
const guardarEdicion = async (sysId, arcIndex) => {
    console.log("🚀 Iniciando guardado para:", sysId, "en índice:", arcIndex);
    
    const el = document.getElementById(`edit-${sysId}-${arcIndex}`);
    if (!el) {
        alert("❌ Error: No se encontró el elemento HTML con el código.");
        console.error("ID buscado:", `edit-${sysId}-${arcIndex}`);
        return;
    }
    
    const nuevoCodigo = el.innerText;
    console.log("📝 Código capturado (primeros 20 caracteres):", nuevoCodigo.substring(0, 20));

    // Debug de listas
    console.log("🔍 Buscando sistema en listas locales...");
    console.log("Contenido de window.todosLosSistemas:", window.todosLosSistemas);
    
    // Intentamos buscar en cualquier lista disponible
    const sistema = (window.todosLosSistemas || []).find(s => s.id === sysId);

    if (!sistema) {
        console.error("❌ SISTEMA NO ENCONTRADO EN LOCAL.");
        alert("Fallo local: El sistema no está en la memoria del navegador. ¿Se cargó la lista?");
        return;
    }

    try {
        const sistemaRef = doc(db, "sistemas", sysId);
        console.log("📡 Enviando a Firebase...");
        
        const nuevosArchivos = [...sistema.archivos];
        nuevosArchivos[arcIndex] = { ...nuevosArchivos[arcIndex], codigo: nuevoCodigo };

        await updateDoc(sistemaRef, { archivos: nuevosArchivos });
        
        console.log("✅ Firebase respondió: OK");
        mostrarToast("✅ Cambios guardados", "success");
        
        sistema.archivos = nuevosArchivos;
        if (typeof window.renderizarSegunTab === "function") window.renderizarSegunTab();
        
    } catch (error) {
        console.error("❌ ERROR DE FIREBASE:", error);
        alert("Error de red o permisos: " + error.message);
    }
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

    // --- NUEVOS: MANEJO DE SCRIPTS Y EDICIÓN ---
    
    // Copiar Código (Nuevo)
    const btnCopy = target.closest('.js-copy-code');
    if (btnCopy) {
        e.stopPropagation(); // Evita que se cierre el acordeón al copiar
        window.copiarCodigo(btnCopy.dataset.id);
    }

    // Guardar Edición de un script (Nuevo)
    const btnSave = target.closest('.js-save-edit');
    if (btnSave) {
        e.stopPropagation();
        window.guardarEdicion(btnSave.dataset.sysid, btnSave.dataset.index);
    }

    // Eliminar un script individual (Nuevo)
    const btnDelScript = target.closest('.js-delete-script');
    if (btnDelScript) {
        e.stopPropagation();
        window.eliminarScript(btnDelScript.dataset.sysid, btnDelScript.dataset.index);
    }

    // --- NUEVOS: LINKS Y REPORTES ---

    // Reportar Sistema (Nuevo)
    const btnReport = target.closest('.js-reportar');
    if (btnReport) {
        window.reportarSistema(btnReport.dataset.id, btnReport.dataset.titulo);
    }

    // Link a Perfiles (Nuevo - reemplaza el onclick de las fotos)
    const linkPerfil = target.closest('.js-perfil-link');
    if (linkPerfil) {
        window.location.href = linkPerfil.dataset.url;
    }

    // --- LOS QUE YA TENÍAS (Mantenidos) ---

    const btnLike = target.closest('.js-like');
    if (btnLike) darLike(btnLike.dataset.id, btnLike.dataset.creador);

    const btnDel = target.closest('.js-EliminarSistema');
    if (btnDel) eliminarSistema(btnDel.dataset.id);

    const btnToggleArc = target.closest('.js-toggle-archivo');
    if (btnToggleArc) toggleArchivo(btnToggleArc.dataset.id);

    const btnEdit = target.closest('.js-edit-modo');
    if (btnEdit) toggleModoEditor(btnEdit.dataset.id);

    const btnSeguir = target.closest('.js-seguir');
    if (btnSeguir) toggleSeguir(btnSeguir.dataset.user);

    const btnDesc = target.closest('.js-descargar');
    if (btnDesc && window.descargarSistema) window.descargarSistema(btnDesc.dataset.id);

    const btnFav = target.closest('.js-fav');
    if (btnFav) toggleFavorito(btnFav.dataset.id);

    const btnShare = target.closest('.js-compartir');
    if (btnShare) compartirSistemaIndividual(btnShare.dataset.id, btnShare.dataset.creador);

    const btnNewScript = target.closest('.js-nuevo-script');
    if (btnNewScript) nuevoScriptEnSistema(btnNewScript.dataset.id);

    const VerComentarios = target.closest('.js-ver-comentarios');
    if (VerComentarios) toggleSeccionComentarios(VerComentarios.dataset.id);
});
// Manejo de formularios de comentarios
// Manejo de guardado de título al perder el foco (onblur)
document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('js-titulo-editable')) {
        guardarTitulo(e.target.dataset.id);
    }
});
 const configurarFormulario = () => {
    const form = document.getElementById('form-sistema');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Prioridad: 1. Clerk cargado, 2. Variable global window
        const user = (window.Clerk && window.Clerk.user) || window.currentUser;
        if (!user) return;
        
        const miUserRef = doc(db, "usuarios", user.id);
        
        const miDoc = await getDoc(miUserRef);
        if (!miDoc.exists()) {
                await setDoc(miUserRef, {
                    id: user.id,
                    nombre: user.fullName || "Usuario",
                    foto: user.imageUrl || "",
                    siguiendo: [],
                    favoritos: []
                });
        }
        if (!user) {
            alert("Espera a que cargue tu sesión o inicia sesión.");
            return;
        }

        // ... resto de tu código de recolección de datos ...
        console.log("Intentando publicar sistema de:", user.fullName);

            const titulo = document.getElementById('sys-titulo').value;
            const tag = document.getElementById('sys-tag').value;
            const bloquesArchivos = document.querySelectorAll('.archivo-input-item');
            
            const listaArchivos = Array.from(bloquesArchivos).map(bloque => ({
                nombre: bloque.querySelector('.arc-nombre').value,
                tipo: bloque.querySelector('.arc-tipo').value,
                codigo: bloque.querySelector('.arc-codigo').value
            }));

            if (listaArchivos.length === 0) return alert("Añade al menos un script.");

            try {
                const btn = e.target.querySelector('.btn-submit');
                btn.innerText = "Publicando...";
                btn.disabled = true;

                await addDoc(collection(db, "sistemas"), {
                    titulo, tag,
                    autor: user.fullName,
                    creadorId: user.id,
                    foto: user.imageUrl,
                    archivos: listaArchivos,
                    likes: 0,
                    fecha: serverTimestamp()
                });

                alert("🚀 ¡Sistema publicado con éxito!");
                window.location.href = "index.html"; 
            } catch (error) {
                console.error("Error al subir:", error);
                alert("Error al subir.");
                const btn = e.target.querySelector('.btn-submit');
                btn.innerText = "Publicar Sistema";
                btn.disabled = false;
            }
        });
}
window.configurarFormulario = configurarFormulario
window.guardarTitulo = guardarTitulo
window.guardarEdicion = guardarEdicion
window.eliminarScript = eliminarScript
export{obtenerSistemas,toggleModoEditor,guardarTitulo,
toggleArchivo,agregarCampoArchivo,darLike
,eliminarSistema,toggleFavorito,compartirSistemaIndividual
,aplicarEnfoqueSistema,escaparHTML,generarHTMLSistemas,
nuevoScriptEnSistema,eliminarScript,configurarFormulario,guardarEdicion}