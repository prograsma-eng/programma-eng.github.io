import { 
    db, collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, arrayUnion 
} from '../firebase-config.js';

const MI_ADMIN_ID = "user_38lpub6nAzQUEUYMSBDzTcnVNdr";

window.enviarComentario = async (e, id) => {
    const btn = e.target.querySelector('button');
    if (btn && btn.disabled) return; 

    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    e.preventDefault();
    
    const form = e.target;
    const inp = form.querySelector('input');
    const texto = inp.value.trim();

    if (!user) return alert("Inicia sesión para comentar.");
    if (!texto) return;

    const LIMITE_PALABRAS = 50; 
    const palabras = texto.split(/\s+/).filter(p => p.length > 0);

    if (palabras.length > LIMITE_PALABRAS) {
        return alert(`⚠️ Tu comentario es muy largo. Máximo ${LIMITE_PALABRAS} palabras.`);
    }

    if (btn) btn.disabled = true;

    try {
        const sistemas = window.todosLosSistemas || [];
        const sistema = sistemas.find(s => s.id === id);
        if (!sistema) throw new Error("Sistema no encontrado");

        await addDoc(collection(db, "sistemas", id, "comentarios"), {
            texto: texto, 
            autor: user.fullName || "Usuario",
            autorId: user.id,
            foto: user.imageUrl || "",
            likes: [],
            respuestas: [],
            fecha: serverTimestamp()
        });

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
        
        const wrapper = document.getElementById(`wrapper-${id}`);
        if (wrapper) {
            setTimeout(() => {
                wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
            }, 100);
        }

    } catch (error) {
        console.error("Error al comentar:", error);
        alert("Hubo un error al publicar tu comentario.");
    } finally {
        if (btn) btn.disabled = false;
    }
};

window.borrarComentario = async (sysId, comId) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return;

    try {
        const comRef = doc(db, "sistemas", sysId, "comentarios", comId);
        const snap = await getDoc(comRef);

        if (!snap.exists()) return;

        const data = snap.data();
        const esAutorizado = user.id === data.autorId || user.id === ADMIN_ID;

        if (esAutorizado) {
            if (confirm("¿Estás seguro de que quieres eliminar este comentario?")) {
                await deleteDoc(comRef);
            }
        } else {
            alert("No tienes permiso para borrar este comentario.");
        }
    } catch (error) {
    }
};

window.likeComentario = async (sysId, comId) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return window.Clerk?.openSignIn();
    
    const ref = doc(db, "sistemas", sysId, "comentarios", comId);

    try {
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const likes = snap.data().likes || [];
        const yaDioLike = likes.includes(user.id);

        await updateDoc(ref, {
            likes: yaDioLike ? arrayRemove(user.id) : arrayUnion(user.id)
        });

    } catch (error) {
        console.error("Error al procesar like en comentario:", error);
    }
};

window.mostrarInputRespuesta = async (sysId, comId, nombre) => {
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    if (!user) return alert("Inicia sesión para responder.");
    
    let txt = prompt(`Respondiendo a ${nombre}:`);
    if (!txt || !txt.trim()) return;

    const LIMITE_PALABRAS_RES = 50; 
    const palabras = txt.trim().split(/\s+/).filter(p => p.length > 0);

    if (palabras.length > LIMITE_PALABRAS_RES) {
        return alert(`⚠️ La respuesta es muy larga. Máximo ${LIMITE_PALABRAS_RES} palabras.`);
    }

    const textoSeguro = txt.replace(/<[^>]*>?/gm, '');

    const ref = doc(db, "sistemas", sysId, "comentarios", comId);
    try {
        await updateDoc(ref, {
            respuestas: arrayUnion({
                autor: user.fullName || "Usuario",
                autorId: user.id,
                texto: textoSeguro,
                likes: [],
                fecha: Date.now()
            })
        });
    } catch (error) {
    }
};
async function borrarRespuesta(sysId, comId, idx) {
    if (!confirm("¿Borrar esta respuesta?")) return;
    const user = window.currentUser || (window.Clerk && window.Clerk.user);
    const ref = doc(db, "sistemas", sysId, "comentarios", comId);
    
    try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const resActuales = [...(snap.data().respuestas || [])];
            if (resActuales[idx].autorId === user.id || user.id === MI_ADMIN_ID) {
                resActuales.splice(idx, 1); 
                await updateDoc(ref, { respuestas: resActuales });
            } else {
                alert("No tienes permiso.");
            }
        }
    } catch (e) {}
}

window.toggleVerMasRespuestas = (comId) => {
    const extras = document.querySelectorAll(`.extra-${comId}`);
    const btn = document.getElementById(`btn-ver-${comId}`);
    if (!extras.length) return;
    
    const estaOculto = extras[limite] ? extras[limite].style.display === 'none' : true; 
    extras.forEach((el, idx) => { if(idx >= 2) el.style.display = el.style.display === 'none' ? 'block' : 'none'; });
    if (btn) btn.innerText = extras[2].style.display === 'block' ? "Ocultar respuestas" : `Ver más respuestas...`;
};

export const toggleSeccionComentarios = function(id) {
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
function toggleVerMasRespuestas(comId) {
    const extras = document.querySelectorAll(`.extra-${comId}`);
    const btn = document.getElementById(`btn-ver-${comId}`);
    if (!extras.length) return;
    
    const limiteEfectivo = 2;
    const estaOculto = extras[limiteEfectivo] ? extras[limiteEfectivo].style.display === 'none' : true;

    extras.forEach((el, idx) => { 
        if(idx >= limiteEfectivo) {
            el.style.display = estaOculto ? 'block' : 'none';
        }
    });
    
    if (btn) btn.innerText = estaOculto ? "🔼 Ocultar respuestas" : `Ver más respuestas...`;
}
const desuscripcionesComentarios = {};

export const escucharComentarios = (sistemaId) => {
    if (desuscripcionesComentarios[sistemaId]) {
        desuscripcionesComentarios[sistemaId]();
    }

    const qComs = query(
        collection(db, "sistemas", sistemaId, "comentarios"), 
        orderBy("fecha", "asc")
    ); 

    desuscripcionesComentarios[sistemaId] = onSnapshot(qComs, (snap) => {
        const user = window.currentUser || (window.Clerk && window.Clerk.user);
        const adminId = window.MI_ADMIN_ID || "ID_POR_DEFECTO";

        const btn = document.getElementById(`btn-coms-${sistemaId}`);
        const wrapper = document.getElementById(`wrapper-${sistemaId}`);
        const cDiv = document.getElementById(`coms-${sistemaId}`);

        if (btn && wrapper) {
            const estaAbierto = wrapper.classList.contains('open');
            btn.innerText = estaAbierto ? "🔼 Ocultar comentarios" : `💬 Ver comentarios (${snap.size})`;
        }

        if (!cDiv) return;

        if (snap.empty) {
            cDiv.innerHTML = `<p style="font-size:0.8rem; color:#666; text-align:center;">No hay comentarios aún.</p>`;
            return;
        }

        cDiv.innerHTML = snap.docs.map(d => {
            const comData = d.data();
            const comId = d.id;
            const esMioCom = user && (comData.autorId === user.id || user.id === adminId);
            const respuestas = comData.respuestas || [];
            const limite = 2;

            const htmlRespuestas = respuestas.map((res, idx) => {
                const esMioRes = user && (res.autorId === user.id || user.id === adminId);
                const estiloOculto = idx >= limite ? 'display: none;' : '';
                
                return `
                    <div class="respuesta-item extra-${comId}" 
                         style="margin-left: 30px; margin-top: 8px; padding: 5px 10px; border-left: 2px solid var(--accent); background: rgba(255,255,255,0.03); ${estiloOculto}">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <b style="color:var(--accent); font-size:0.7rem;">${escaparHTML(res.autor)}</b>
                            ${esMioRes ? `
                                <button class="js-del-res" 
                                        data-sys="${sistemaId}" 
                                        data-com="${comId}" 
                                        data-idx="${idx}" 
                                        style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:10px;">✕</button>
                            ` : ''}
                        </div>
                        <p style="margin:2px 0; font-size:0.8rem; color:#ccc;">${escaparHTML(res.texto)}</p>
                    </div>`;
            }).join('');

            return `
                <div class="comentario-item" style="border-bottom: 1px solid #222; padding: 10px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:8px; align-items:center;">
                            <img src="${escaparHTML(comData.foto) || 'https://via.placeholder.com/20'}" style="width:20px; height:20px; border-radius:50%;">
                            <b style="color:var(--accent); font-size:0.75rem;">
                                ${escaparHTML(comData.autor)} ${comData.autorId === adminId ? '⭐' : ''}
                            </b>
                        </div>
                        ${esMioCom ? `
                            <button class="js-del-com" 
                                    data-sys="${sistemaId}" 
                                    data-com="${comId}" 
                                    style="background:none; border:none; color:#ef4444; cursor:pointer;">🗑️</button>
                        ` : ''}
                    </div>
                    <p style="margin:5px 0; font-size:0.85rem; color:#eee;">${escaparHTML(comData.texto)}</p>
                    <div style="display:flex; gap:15px; font-size:0.7rem; color:#888;">
                        <span class="js-like-com" data-sys="${sistemaId}" data-com="${comId}" style="cursor:pointer;">
                            ❤️ ${comData.likes?.length || 0}
                        </span>
                        <span class="js-reply-com" 
                              data-sys="${sistemaId}" 
                              data-com="${comId}" 
                              data-autor="${escaparHTML(comData.autor)}" 
                              style="cursor:pointer; color:var(--accent); font-weight:bold;">Responder</span>
                    </div>
                    <div id="contenedor-respuestas-${comId}">${htmlRespuestas}</div>
                    ${respuestas.length > limite ? `
                        <button id="btn-ver-${comId}" 
                                class="js-ver-mas-res" 
                                data-com="${comId}"
                                style="margin-left:30px; background:none; border:none; color:var(--accent); font-size:0.7rem; cursor:pointer; padding:5px 0;">
                            Ver ${respuestas.length - limite} respuestas más...
                        </button>` : ''}
                </div>`;
        }).join('');
    }, (error) => {
    });
};
document.addEventListener('click', (e) => {
    const t = e.target;
    const btnLikeCom = t.closest('.js-like-com');
    if (btnLikeCom) {
        window.likeComentario(btnLikeCom.dataset.sys, btnLikeCom.dataset.com);
    }

    const btnDelCom = t.closest('.js-del-com');
    if (btnDelCom) {
        window.borrarComentario(btnDelCom.dataset.sys, btnDelCom.dataset.com);
    }

    const btnReply = t.closest('.js-reply-com');
    if (btnReply) {
        window.mostrarInputRespuesta(btnReply.dataset.sys, btnReply.dataset.com, btnReply.dataset.autor);
    }


    const btnDelRes = t.closest('.js-del-res');
    if (btnDelRes) {
        window.borrarRespuesta(btnDelRes.dataset.sys, btnDelRes.dataset.com, btnDelRes.dataset.idx);
    }

    const btnVerMas = t.closest('.js-ver-mas-res');
    if (btnVerMas) {
        window.toggleVerMasRespuestas(btnVerMas.dataset.com);
    }
});
document.addEventListener('submit', (e) => {
    const form = e.target.closest('.js-form-comentario');
    if (form) {
        e.preventDefault();
        const sysId = form.dataset.id;
        window.enviarComentario(e, sysId);
    }
});
window.borrarComentario = borrarComentario;
window.likeComentario = likeComentario;
window.mostrarInputRespuesta = mostrarInputRespuesta;
window.borrarRespuesta = borrarRespuesta;
window.toggleVerMasRespuestas = toggleVerMasRespuestas;
window.escucharComentarios = escucharComentarios;

export const escaparHTML = (str) => {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));

}
