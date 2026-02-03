import { 
    db, doc, getDoc, setDoc, updateDoc, increment, arrayUnion, 
    arrayRemove, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, getDocs, deleteDoc,
    conectarContadorSeguidores , getAuth}
  from '../firebase-config.js';

  import {mostrarToast} from '../app.js'
const MI_ADMIN_ID = "user_38lpub6nAzQUEUYMSBDzTcnVNdr";
window.toggleNotificaciones = () => {
    const dropdown = document.getElementById('noti-dropdown');
    if (!dropdown) return;
    
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
};
const toggleSeguir = async (creadorId) => { 
    const user = window.Clerk?.user;
    if (!user) return;

    const idLimpio = String(creadorId).trim();
    if (user.id === idLimpio) return alert("¡Eres el creador!");

    const miUserRef = doc(db, "usuarios", user.id);
    const creadorRef = doc(db, "usuarios", idLimpio);

    try {
        const miDoc = await getDoc(miUserRef);
        let siguiendoAhora = false;
        let cambioRealizado = false;

        if (!miDoc.exists()) {
            await setDoc(miUserRef, {
                id: user.id,
                nombre: user.fullName || "Usuario",
                foto: user.imageUrl || "",
                siguiendo: [idLimpio],
                favoritos: []
            });
            siguiendoAhora = true;
            cambioRealizado = true;
        } else {
            const siguiendo = miDoc.data().siguiendo || [];
            if (siguiendo.includes(idLimpio)) {
                await updateDoc(miUserRef, { siguiendo: arrayRemove(idLimpio) });
                siguiendoAhora = false;
            } else {
                await updateDoc(miUserRef, { siguiendo: arrayUnion(idLimpio) });
                siguiendoAhora = true;
            }
            cambioRealizado = true; 
        }
        if (cambioRealizado) {
            try {
                await updateDoc(creadorRef, { 
                    seguidoresCount: increment(siguiendoAhora ? 1 : -1)
                });
            } catch (err) {
                if (err.code === 'not-found') {
                    await setDoc(creadorRef, { seguidoresCount: siguiendoAhora ? 1 : 0 }, { merge: true });
                }
            }
        }
        
        if (siguiendoAhora) {
            if (!window.misSiguiendoGlobal.includes(idLimpio)) {
                window.misSiguiendoGlobal.push(idLimpio);
            }
            addDoc(collection(db, "notificaciones"), {
                paraId: idLimpio,
                nombreEmisor: user.fullName,
                fotoEmisor: user.imageUrl,
                mensaje: `ha comenzado a seguirte.`,
                tipo: "Seguidores",
                fecha: serverTimestamp()
            });
        } else {
            window.misSiguiendoGlobal = window.misSiguiendoGlobal.filter(id => id !== idLimpio);
        }

    } catch (e) {
    }
};

window.rastrearActividad = () => {
    const user = window.Clerk?.user;
    if (!user) return;

    const listaNotis = document.getElementById('lista-notificaciones');
    const countBadge = document.getElementById('noti-count');

    const q = query(
        collection(db, "notificaciones"),
        where("paraId", "==", user.id),
        orderBy("fecha", "desc")
    );

    onSnapshot(q, (snap) => {
        if (!listaNotis) return;

        if (snap.empty) {
            if (countBadge) countBadge.style.display = 'none';
            listaNotis.innerHTML = '<p style="padding:15px; color:#888; text-align:center;">Sin notificaciones</p>';
            return;
        }

        const registrosVistos = new Set();
        const notificacionesUnicas = [];

        snap.docs.forEach(d => {
            const data = d.data();
            const llaveCuerpo = `${data.nombreEmisor}-${data.mensaje}-${data.tipo}`;

            if (!registrosVistos.has(llaveCuerpo)) {
                registrosVistos.add(llaveCuerpo);
                notificacionesUnicas.push({ id: d.id, ...data });
            } else {
                deleteDoc(doc(db, "notificaciones", d.id)).catch(err => console.error("Error limpieza:", err));
            }
        });

        if (countBadge) {
            countBadge.textContent = notificacionesUnicas.length;
            countBadge.style.display = notificacionesUnicas.length > 0 ? 'flex' : 'none';
        }

        listaNotis.innerHTML = ''; 
        notificacionesUnicas.forEach(n => {
            const item = document.createElement('div');
            item.className = 'noti-item';
            
            const content = document.createElement('span');
            content.innerHTML = `<b></b> `; 
            content.querySelector('b').textContent = n.nombreEmisor || 'Usuario';
            content.append(document.createTextNode(` ${n.mensaje}`));

            const btn = document.createElement('button');
            btn.innerHTML = '&times;';
            btn.onclick = () => window.eliminarNotificacion(n.id);

            item.appendChild(content);
            item.appendChild(btn);
            listaNotis.appendChild(item);
        });
    });
};
window.resolverReporte = async (reporteId, sistemaId) => {
    if (window.currentUser?.id !== MI_ADMIN_ID) {
        alert("Acceso denegado.");
        return;
    }

    const confirmar = confirm("⚠️ ¿Eliminar sistema y notificar al usuario?");
    if (!confirmar) return;

    try {
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const sistemaSnap = await getDoc(sistemaRef);
        
        if (sistemaSnap.exists()) {
            const data = sistemaSnap.data();
            const dueñoId = data.creadorId;
            const tituloSistema = data.titulo || "Tu sistema";

            await addDoc(collection(db, "notificaciones"), {
                paraId: dueñoId,
                titulo: "Sistema Eliminado",
                mensaje: `Tu sistema "${tituloSistema}" ha sido eliminado por infringir las normas de la comunidad tras varios reportes.`,
                tipo: "moderacion",
                fecha: serverTimestamp(),
                leida: false
            });

            await deleteDoc(sistemaRef);
        }

        await deleteDoc(doc(db, "reportes", reporteId)); 
        
        alert("Sistema eliminado y usuario notificado.");
        if (typeof cargarPanelAdmin === 'function') cargarPanelAdmin();

    } catch (error) {
    }
};
window.eliminarNotificacion = async (notiId) => {
    try {
        await deleteDoc(doc(db, "notificaciones", notiId));
    } catch (error) {
    }
};

window.ignorarReporte = async (reporteId) => {
    if (confirm("¿Ignorar este reporte? El sistema permanecerá público.")) {
        await deleteDoc(doc(db, "reportes", reporteId));
    }
};

window.reportarSistema = async (id, titulo) => {
    const motivo = prompt(`¿Por qué deseas reportar el sistema "${titulo}"?`);
    if (!motivo) return;
    const user = window.currentUser || (window.Clerk && window.Clerk.user);

    try {
        await addDoc(collection(db, "reportes"), {
            sistemaId: id,
            sistemaTitulo: titulo,
            motivo: motivo,
            reportadoPor: user ? user.fullName : "Anónimo",
            reportadoPorId: user ? user.id : "n/a",
            fecha: serverTimestamp()
        });
        alert("🚩 Reporte enviado correctamente.");
    } catch (error) {  }
};

window.copiarCodigo = (id) => {
    const el = document.getElementById(`edit-${id}`);
    if (!el) return;
    navigator.clipboard.writeText(el.innerText).then(() => alert("📋 Código copiado"));
};

window.descargarSistema = async function(sistemaId) {
    try {
        const docSnap = await getDoc(doc(db, "sistemas", sistemaId));
        if (!docSnap.exists()) return alert("Sistema no encontrado.");
        const data = docSnap.data();
        const zip = new JSZip();
        const folder = zip.folder(data.titulo.replace(/\s+/g, '_'));
        data.archivos.forEach(arc => folder.file(`${arc.nombre}.lua`, arc.codigo));
        zip.generateAsync({ type: "blob" }).then(content => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `${data.titulo}.zip`;
            link.click();
        });
    } catch (e) {}
};

window.buscarPersonasApartado = async () => {
    const busqueda = document.getElementById('input-persona')?.value.trim().toLowerCase();
    const resultadosDiv = document.getElementById('resultados-personas');
    
    if (!busqueda || !resultadosDiv) { 
        if(resultadosDiv) resultadosDiv.innerHTML = ""; 
        return; 
    }

    try {
        const snap = await getDocs(collection(db, "usuarios"));
        resultadosDiv.innerHTML = "";

        const encontrados = snap.docs
            .map(doc => doc.data())
            .filter(u => 
                (u.nombre || "").toLowerCase().includes(busqueda) || 
                (u.id || "").toLowerCase().includes(busqueda)
            );

        if (encontrados.length === 0) {
            resultadosDiv.innerHTML = "<p style='color:gray;'>No hay resultados</p>";
            return;
        }

        encontrados.forEach(u => {
            const item = document.createElement('div');
            item.className = "perfil-item";
            item.style.cssText = "display:flex; align-items:center; gap:10px; background:#1a1a1a; padding:10px; border-radius:10px; cursor:pointer; margin-bottom:5px; border:1px solid #333;";

            item.addEventListener('click', () => {
                if (window.verPerfil) window.verPerfil(u.id);
            });

            const img = document.createElement('img');
            img.src = u.foto || 'https://via.placeholder.com/40';
            img.style.cssText = "width:40px; height:40px; border-radius:50%; object-fit:cover;";
            
            img.addEventListener('error', () => {
                item.style.display = 'none';
            });

            const info = document.createElement('div');
            info.innerHTML = `
                <div style="color:white; font-weight:bold; font-size:0.9rem;">${u.nombre}</div>
                <div style="color:#007bff; font-size:0.7rem;">${u.seguidoresCount || 0} seguidores</div>
            `;

            item.appendChild(img);
            item.appendChild(info);
            resultadosDiv.appendChild(item);
        });

    } catch (e) { ; 
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const inputPersona = document.getElementById('input-persona');
    if (inputPersona) {
        inputPersona.addEventListener('input', window.buscarPersonasApartado);
    }

    const btnEliminar = document.getElementById('btn-eliminar-rastro');
    if (btnEliminar) {
        btnEliminar.addEventListener('click', window.eliminarCuentaTotalmente);
    }
});
window.verPerfil = (id) => window.location.href = `perfil.html?id=${id}`;


export{toggleSeguir}
