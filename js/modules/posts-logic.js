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

// --- ARREGLO DE REFERENCIAS GLOBALES ---
// Esto asegura que si todosLosSistemas no está definido aquí, lo busque en el objeto global
const obtenerSistemas = () => window.todosLosSistemas || [];

window.toggleModoEditor = (id) => {
    window.editandoId = (window.editandoId === id) ? null : id;
    if (typeof window.renderizar === "function") window.renderizar();
};

window.guardarTitulo = async (id) => {
    const el = document.getElementById(`title-${id}`);
    if (!el) {
        console.error("No se encontró el elemento con ID:", `title-${id}`);
        return;
    }

    // Usamos .innerText y .trim() para limpiar espacios y saltos de línea extra
    const nuevoTitulo = el.innerText.trim();

    // Validación: Si el título quedó vacío, no guardamos
    if (!nuevoTitulo) {
        alert("El título no puede estar vacío");
        return;
    }

    try {
        const sistemaRef = doc(db, "sistemas", id);
        await updateDoc(sistemaRef, { 
            titulo: nuevoTitulo 
        });
        
        console.log("✅ Título actualizado en Firebase:", nuevoTitulo);
        
        // Feedback visual opcional para confirmar que se guardó
        el.style.color = "#4CAF50"; // Cambia a verde brevemente
        setTimeout(() => el.style.color = "", 1000);

    } catch (e) {
        console.error("Error al actualizar título en Firebase:", e);
        alert("Error al guardar el título. Revisa la consola.");
    }
};
// --- GUARDAR EDICIÓN DE CÓDIGO ---
window.guardarEdicion = async (sysId, arcIndex) => {
    const el = document.getElementById(`edit-${sysId}-${arcIndex}`);
    if (!el) return;
    const nuevoCodigo = el.innerText;

    try {
        const sistemaRef = doc(db, "sistemas", sysId);
        const snap = await getDoc(sistemaRef); // Obtenemos el estado actual real
        
        if (!snap.exists()) return;
        
        const archivosActuales = snap.data().archivos || [];
        const nuevosArchivos = [...archivosActuales];
        
        // Actualizamos solo el archivo que editamos
        nuevosArchivos[arcIndex].codigo = nuevoCodigo;

        await updateDoc(sistemaRef, { archivos: nuevosArchivos });
        alert("✅ Cambios guardados en la nube.");
    } catch (error) {
        console.error(error);
        alert("❌ Error al guardar.");
    }
};
window.toggleArchivo = (id) => {
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

window.agregarCampoArchivo = () => {
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
window.darLike = async (sistemaId) => {
    const user = window.currentUser; // Viene de Clerk
    const likeRef = doc(db, "sistemas", sistemaId, "usuariosLikes", user.id);
    if (!user) return window.Clerk?.openSignIn();

    try {
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const sistemaSnap = await getDoc(sistemaRef);
        if (!sistemaSnap.exists()) return;

        const data = sistemaSnap.data();
        const creadorId = data.creadorId;

        // REGLA: El creador no puede dar like (ni quitarlo)
        if (user.id === creadorId) {
            alert("Como creador, no puedes interactuar con los likes de tu propio sistema.");
            return;
        }

        const likeSnap = await getDoc(likeRef);

        if (likeSnap.exists()) {
            await updateDoc(sistemaRef, { likes: increment(-1) });
            // 2. Borrar el documento que registra el like del usuario
            await deleteDoc(likeRef);
            
            console.log("Like quitado con éxito");
        } else {
            // --- LÓGICA PARA DAR LIKE ---
            // 1. Aumentar 1 al contador principal
            await updateDoc(sistemaRef, { likes: increment(1) });
            // 2. Crear el registro del usuario
            await setDoc(likeRef, { fecha: serverTimestamp() });

            // 3. Enviar notificación (Solo cuando da like, no cuando lo quita)
            await addDoc(collection(db, "notificaciones"), {
                paraId: creadorId,
                nombreEmisor: user.fullName,
                fotoEmisor: user.imageUrl,
                mensaje: `le ha dado like a tu sistema: "${data.titulo}"`,
                tipo: "like",
                fecha: serverTimestamp()
            });
            
            console.log("Like agregado con éxito");
        }

    } catch (error) {
        console.error("Error en la función darLike:", error);
    }
};
window.eliminarSistema = async (sysId) => {
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

window.toggleFavorito = async (sistemaId) => {
    if (!window.currentUser) return window.Clerk?.openSignIn();

    const userRef = doc(db, "usuarios", window.currentUser.id);
    const sistemaRef = doc(db, "sistemas", sistemaId);
    
    try {
        const userSnap = await getDoc(userRef);
        const sistemaSnap = await getDoc(sistemaRef);
        
        if (!sistemaSnap.exists()) return;
        const datosSistema = sistemaSnap.data();

        if (datosSistema.creadorId === window.currentUser.id) {
            return alert("❌ No puedes dar favorito a tus propios sistemas.");
        }

        let favoritos = userSnap.exists() ? (userSnap.data().favoritos || []) : [];
        const yaEsFavorito = favoritos.includes(sistemaId);
        const btn = document.getElementById(`btn-fav-${sistemaId}`);

        if (yaEsFavorito) {
            await updateDoc(userRef, { favoritos: arrayRemove(sistemaId) });
            await updateDoc(sistemaRef, { favsCount: increment(-1) });
            if (btn) { btn.classList.remove('activo'); btn.innerText = '☆'; }
        } else {
            await updateDoc(userRef, { favoritos: arrayUnion(sistemaId) });
            await updateDoc(sistemaRef, { favsCount: increment(1) });
            if (btn) { btn.classList.add('activo'); btn.innerText = '⭐'; }
        }

        if (window.misFavoritosGlobal) {
            if (yaEsFavorito) {
                window.misFavoritosGlobal = window.misFavoritosGlobal.filter(id => id !== sistemaId);
            } else {
                window.misFavoritosGlobal.push(sistemaId);
            }
        }
        
        if (typeof window.renderizar === "function") window.renderizar();
    } catch (error) {
        console.error("Error en favorito:", error);
    }
};
window.compartirSistemaIndividual = function(sistemaId, creadorId) {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const urlCompartir = `${baseUrl}/perfil.html?id=${creadorId}#sistema-${sistemaId}`;

    navigator.clipboard.writeText(urlCompartir).then(() => {
        alert("¡Enlace al sistema copiado al portapapeles!");
    }).catch(err => {
        console.error('Error al copiar: ', err);
    });
};
window.aplicarEnfoqueSistema = function() {
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
function escaparHTML(str) {
    if (!str) return "";

    // 1. Detectar si contiene caracteres de inyección (< >)
    // El patrón /<[^>]*>/ busca cualquier cosa que parezca una etiqueta HTML
    if (/[<>]/.test(str)) {
        return nul; // Detenemos el proceso devolviendo null
    }

    // 2. Si pasa la validación, escapamos el resto de caracteres por seguridad
    return str.replace(/[&"']/g, function(m) {
        return {
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}
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
                <div class="archivo-header" onclick="window.toggleArchivo('${sys.id}-${i}')">
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
                    <button onclick="window.compartirSistemaIndividual('${sys.id}', '${escaparHTML(sys.creadorId)}')" title="Copiar enlace al sistema">🔗</button>
                    <button onclick="window.reportarSistema('${sys.id}', '${escaparHTML(tituloSeguro)}')">🚩</button>
                    ${esDueno ? `<button onclick="window.eliminarSistema('${sys.id}')">🗑️</button>` : ''}
                    <button class="btn-like" 
                        onclick="${esDueno ? "alert('No puedes dar like a tu propio sistema')" : `window.darLike('${sys.id}')`}" 
                        ${esDueno ? 'style="opacity: 0.6; cursor: not-allowed;"' : ''}>
                        ❤️ ${sys.likes || 0}
                    </button>
                    <button onclick="window.toggleFavorito('${sys.id}')" 
                            id="btn-fav-${sys.id}"
                            class="btn-accion ${esFavorito ? 'activo' : ''}" 
                            style="background: none; border: none; cursor: pointer; font-size: 1.2rem;">
                        ${esFavorito ? '⭐' : '☆'}
                    </button>
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
                <button class="btn-toggle-comentarios" onclick="window.toggleSeccionComentarios('${sys.id}')" id="btn-coms-${sys.id}" 
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
window.nuevoScriptEnSistema = async (sysId) => {
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