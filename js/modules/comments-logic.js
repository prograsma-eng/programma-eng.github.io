import { 
    db, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, arrayUnion 
} from '../firebase-config.js';

// --- CONFIGURACIÓN ---
const MI_ADMIN_ID = "user_38V8D7ESSRzvjUdE4iLXB44grHP"; // Reemplaza con tu ID real de Clerk

// --- ENVIAR COMENTARIO ---
window.enviarComentario = async (e, id) => {
    e.preventDefault();
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    const sistemas = window.todosLosSistemas || [];
    
    const inp = e.target.querySelector('input');
    if(!inp.value.trim() || !user) return;
    
    const sistema = sistemas.find(s => s.id === id);
    if(!sistema) return;

    try {
        await addDoc(collection(db, "sistemas", id, "comentarios"), {
            texto: inp.value,
            autor: user.fullName || "Usuario",
            autorId: user.id,
            foto: user.imageUrl || "",
            likes: [],
            respuestas: [],
            fecha: serverTimestamp()
        });

        // Scroll suave al final del contenedor
        const wrapper = document.getElementById(`wrapper-${id}`);
        if (wrapper) {
            setTimeout(() => {
                wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
            }, 100);
        }

        // Notificación al creador
        if (sistema.creadorId !== user.id) {
            await addDoc(collection(db, "notificaciones"), {
                paraId: sistema.creadorId,
                titulo: sistema.titulo,
                mensaje: `${user.fullName} comentó tu sistema.`,
                tipo: "comentario",
                fecha: serverTimestamp()
            });
        }
        
        inp.value = '';
    } catch (error) {
        console.error("Error al comentar:", error);
    }
};

// --- ELIMINAR COMENTARIO ---
window.borrarComentario = async (sysId, comId) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return;

    try {
        const comRef = doc(db, "sistemas", sysId, "comentarios", comId);
        const snap = await getDoc(comRef);

        if (snap.exists()) {
            const autorId = snap.data().autorId;
            if (user.id === autorId || user.id === MI_ADMIN_ID) {
                if (confirm("¿Estás seguro de que quieres eliminar este comentario?")) {
                    await deleteDoc(comRef);
                }
            } else {
                alert("No tienes permiso.");
            }
        }
    } catch (error) {
        console.error("Error al borrar:", error);
    }
};

// --- LIKES EN COMENTARIOS ---
window.likeComentario = async (sysId, comId) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return window.Clerk?.openSignIn();
    
    const ref = doc(db, "sistemas", sysId, "comentarios", comId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        let likes = snap.data().likes || [];
        likes = likes.includes(user.id) ? likes.filter(i => i !== user.id) : [...likes, user.id];
        await updateDoc(ref, { likes });
    }
};

// --- RESPUESTAS ---
window.mostrarInputRespuesta = async (sysId, comId, nombre) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return alert("Inicia sesión para responder.");
    
    const txt = prompt(`Respondiendo a ${nombre}:`);
    if (!txt || !txt.trim()) return;

    const ref = doc(db, "sistemas", sysId, "comentarios", comId);
    try {
        await updateDoc(ref, {
            respuestas: arrayUnion({
                autor: user.fullName || "Usuario",
                autorId: user.id,
                texto: txt,
                likes: [],
                fecha: Date.now()
            })
        });
    } catch (error) {
        console.error("Error al responder:", error);
    }
};

window.borrarRespuesta = async (sysId, comId, idx) => {
    if (!confirm("¿Borrar esta respuesta?")) return;
    const ref = doc(db, "sistemas", sysId, "comentarios", comId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        const resActuales = [...(snap.data().respuestas || [])];
        resActuales.splice(idx, 1); 
        await updateDoc(ref, { respuestas: resActuales });
    }
};

// --- ESCUCHAR TIEMPO REAL ---
window.escucharComentarios = (sistemaId) => {
    const qComs = query(collection(db, "sistemas", sistemaId, "comentarios"), orderBy("fecha", "asc")); 

    onSnapshot(qComs, (snap) => {
        const user = window.currentUser || (window.Clerk && window.Clerk.user);
        const btn = document.getElementById(`btn-coms-${sistemaId}`);
        const wrapper = document.getElementById(`wrapper-${sistemaId}`);
        const cDiv = document.getElementById(`coms-${sistemaId}`);

        if (btn && wrapper) {
            const estaAbierto = wrapper.classList.contains('open');
            btn.innerText = estaAbierto ? "🔼 Ocultar comentarios" : `💬 Ver comentarios (${snap.size})`;
        }

        if (!cDiv) return;

        cDiv.innerHTML = snap.docs.map(d => {
            const comData = d.data();
            const comId = d.id;
            const esMioCom = user && (comData.autorId === user.id || user.id === MI_ADMIN_ID);
            const respuestas = comData.respuestas || [];
            const limite = 2;

            const htmlRespuestas = respuestas.map((res, idx) => {
                const esMioRes = user && (res.autorId === user.id || user.id === MI_ADMIN_ID);
                const estiloOculto = idx >= limite ? 'display: none;' : '';
                return `
                    <div class="respuesta-item extra-${comId}" style="margin-left: 30px; margin-top: 8px; padding: 5px 10px; border-left: 2px solid var(--accent); background: rgba(255,255,255,0.03); ${estiloOculto}">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:var(--accent); font-size:0.7rem;">${res.autor}</b>
                            ${esMioRes ? `<button onclick="borrarRespuesta('${sistemaId}', '${comId}', ${idx})" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:10px;">✕</button>` : ''}
                        </div>
                        <p style="margin:2px 0; font-size:0.8rem; color:#ccc;">${res.texto}</p>
                    </div>`;
            }).join('');

            return `
                <div class="comentario-item" style="border-bottom: 1px solid #222; padding: 10px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <img src="${comData.foto || 'https://via.placeholder.com/20'}" style="width:20px; height:20px; border-radius:50%;">
                            <b style="color:var(--accent); font-size:0.75rem;">${comData.autor} ${comData.autorId === MI_ADMIN_ID ? '⭐' : ''}</b>
                        </div>
                        ${esMioCom ? `<button onclick="borrarComentario('${sistemaId}', '${comId}')" style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button>` : ''}
                    </div>
                    <p style="margin:5px 0; font-size:0.85rem; color:#eee;">${comData.texto}</p>
                    <div style="display:flex; gap:15px; font-size:0.7rem; color:#888;">
                        <span onclick="likeComentario('${sistemaId}', '${comId}')" style="cursor:pointer;">❤️ ${comData.likes?.length || 0}</span>
                        <span onclick="mostrarInputRespuesta('${sistemaId}', '${comId}', '${comData.autor}')" style="cursor:pointer; color:var(--accent); font-weight:bold;">Responder</span>
                    </div>
                    <div id="contenedor-respuestas-${comId}">${htmlRespuestas}</div>
                    ${respuestas.length > limite ? `
                        <button id="btn-ver-${comId}" onclick="window.toggleVerMasRespuestas('${comId}')" 
                            style="margin-left:30px; background:none; border:none; color:var(--accent); font-size:0.7rem; cursor:pointer; padding:5px 0;">
                            Ver ${respuestas.length - limite} respuestas más...
                        </button>` : ''}
                </div>`;
        }).join('');
    });
};

window.toggleVerMasRespuestas = (comId) => {
    const extras = document.querySelectorAll(`.extra-${comId}`);
    const btn = document.getElementById(`btn-ver-${comId}`);
    if (!extras.length) return;
    
    const estaOculto = extras[limite] ? extras[limite].style.display === 'none' : true; 
    // Nota: simplificado para el toggle
    extras.forEach((el, idx) => { if(idx >= 2) el.style.display = el.style.display === 'none' ? 'block' : 'none'; });
    if (btn) btn.innerText = extras[2].style.display === 'block' ? "Ocultar respuestas" : `Ver más respuestas...`;
};

window.toggleSeccionComentarios = function(id) {
    const wrapper = document.getElementById(`wrapper-${id}`);
    const btn = document.getElementById(`btn-coms-${id}`);
    if (!wrapper) return;

    if (wrapper.classList.contains('open')) {
        wrapper.classList.remove('open');
        wrapper.style.maxHeight = "0";
    } else {
        wrapper.classList.add('open');
        wrapper.style.maxHeight = "600px"; 
        if(btn) btn.innerText = "🔼 Ocultar comentarios";
    }
};
// --- ESCUCHAR TIEMPO REAL (CORREGIDO) ---
export const escucharComentarios = (sistemaId) => {
    const qComs = query(collection(db, "sistemas", sistemaId, "comentarios"), orderBy("fecha", "asc")); 

    onSnapshot(qComs, 
        (snap) => {
            const user = window.currentUser || (window.Clerk && window.Clerk.user);
            const btn = document.getElementById(`btn-coms-${sistemaId}`);
            const wrapper = document.getElementById(`wrapper-${sistemaId}`);
            const cDiv = document.getElementById(`coms-${sistemaId}`);

            if (btn && wrapper) {
                const estaAbierto = wrapper.classList.contains('open');
                btn.innerText = estaAbierto ? "🔼 Ocultar comentarios" : `💬 Ver comentarios (${snap.size})`;
            }

            if (!cDiv) return;

            cDiv.innerHTML = snap.docs.map(d => {
                const comData = d.data();
                const comId = d.id;
                const esMioCom = user && (comData.autorId === user.id || user.id === MI_ADMIN_ID);
                
                return `
                    <div class="comentario-item" style="border-bottom: 1px solid #222; padding: 10px 0;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; gap:8px; align-items:center;">
                                <img src="${comData.foto || 'https://via.placeholder.com/20'}" style="width:20px; height:20px; border-radius:50%;">
                                <b style="color:var(--accent); font-size:0.75rem;">${comData.autor} ${comData.autorId === MI_ADMIN_ID ? '⭐' : ''}</b>
                            </div>
                            ${esMioCom ? `<button onclick="window.borrarComentario('${sistemaId}', '${comId}')" style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button>` : ''}
                        </div>
                        <p style="margin:5px 0; font-size:0.85rem; color:#eee;">${comData.texto}</p>
                        <div style="display:flex; gap:15px; font-size:0.7rem; color:#888;">
                            <span onclick="window.likeComentario('${sistemaId}', '${comId}')" style="cursor:pointer;">❤️ ${comData.likes?.length || 0}</span>
                            <span onclick="window.mostrarInputRespuesta('${sistemaId}', '${comId}', '${comData.autor}')" style="cursor:pointer; color:var(--accent); font-weight:bold;">Responder</span>
                        </div>
                    </div>`;
            }).join('');
        },
        (error) => {
            // Este log es silencioso y no aparece en rojo como error fatal
            console.log(`Comentarios del sistema ${sistemaId}: Esperando autenticación...`);
        }
    );
};

// Asegúrate de que window también use la versión corregida
window.escucharComentarios = escucharComentarios;