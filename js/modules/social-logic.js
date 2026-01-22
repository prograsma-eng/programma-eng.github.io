import { 
    db, doc, getDoc, setDoc, updateDoc, increment, arrayUnion, 
    arrayRemove, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy, getDocs, deleteDoc,
    conectarContadorSeguidores , getAuth}
  from '../firebase-config.js';

// --- SISTEMA DE SEGUIMIENTO ---
const MI_ADMIN_ID = "user_38V8D7ESSRzvjUdE4iLXB44grHP"; // Reemplaza con tu ID real de Clerk
// --- ABRIR/CERRAR EL DROPDOWN ---
window.toggleNotificaciones = () => {
    const dropdown = document.getElementById('noti-dropdown');
    if (!dropdown) return;
    
    // Alternamos la visibilidad
    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
};
// --- SISTEMA DE SEGUIMIENTO (Optimizado para Clerk) ---
export const toggleSeguir = async (creadorId) => { 
    // Usamos Clerk directamente como fuente de verdad
    const user = window.Clerk?.user;
if (!user) return; // Si no hay Clerk, Firebase no recibe nada.

    if (user.id === creadorId) {
        return alert("¡Eres el creador! No puedes seguirte a ti mismo.");
    }

    const miUserRef = doc(db, "usuarios", user.id);
    const creadorRef = doc(db, "usuarios", creadorId);

    try {
        const miDoc = await getDoc(miUserRef);
        let siguiendoAhora = false;

        if (!miDoc.exists()) {
            // Si no existe, lo creamos con el nuevo seguidor
            await setDoc(miUserRef, {
                id: user.id,
                nombre: user.fullName || "Usuario",
                foto: user.imageUrl || "",
                siguiendo: [creadorId],
                seguidoresCount: 0,
                favoritos: []
            });
            siguiendoAhora = true;
        } else {
            const siguiendo = miDoc.data().siguiendo || [];
            if (siguiendo.includes(creadorId)) {
                await updateDoc(miUserRef, { siguiendo: arrayRemove(creadorId) });
                siguiendoAhora = false;
            } else {
                await updateDoc(miUserRef, { siguiendo: arrayUnion(creadorId) });
                siguiendoAhora = true;
            }
        }

        // Actualizamos contador del creador
        await updateDoc(creadorRef, { 
            seguidoresCount: increment(siguiendoAhora ? 1 : -1) 
        });

        // Notificación (Solo si empezamos a seguir)
        if (siguiendoAhora) {
            await addDoc(collection(db, "notificaciones"), {
                paraId: creadorId,
                nombreEmisor: user.fullName,
                fotoEmisor: user.imageUrl,
                mensaje: `ha comenzado a seguirte.`,
                tipo: "seguidores",
                fecha: serverTimestamp()
            });
        }

        if (typeof window.renderizar === "function") window.renderizar();

    } catch (e) {
        console.error("Error en toggleSeguir:", e);
    }
};

// --- ESCUCHA DE NOTIFICACIONES (Sin Errores en Consola) ---
window.rastrearActividad = () => {
    const user = window.Clerk?.user;
    if (!user) return; // Si no hay usuario, no activamos el listener de Firebase

    const q = query(
        collection(db, "notificaciones"),
        where("paraId", "==", user.id), 
        orderBy("fecha", "desc")
    );

    onSnapshot(q, (snap) => {
        const listaNotis = document.getElementById('lista-notificaciones');
        const countBadge = document.getElementById('noti-count');
        if (!listaNotis) return;

        const total = snap.size;
        if (countBadge) {
            countBadge.innerText = total;
            countBadge.style.display = total > 0 ? 'flex' : 'none';
        }

        listaNotis.innerHTML = snap.empty 
            ? '<p style="padding:15px; color:#888; text-align:center;">Sin notificaciones</p>'
            : snap.docs.map(d => {
                const n = d.data();
                return `
                    <div class="noti-item">
                        <span><b>${n.nombreEmisor || 'Usuario'}</b> ${n.mensaje}</span>
                        <button onclick="window.eliminarNotificacion('${d.id}')">&times;</button>
                    </div>`;
            }).join('');
    }, (error) => {
        // Silenciamos el error de permisos si Firebase aún no conecta el auth
        console.log("Sincronizando notificaciones...");
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
        // 1. Obtener datos del sistema ANTES de borrarlo
        const sistemaRef = doc(db, "sistemas", sistemaId);
        const sistemaSnap = await getDoc(sistemaRef);
        
        if (sistemaSnap.exists()) {
            const data = sistemaSnap.data();
            const dueñoId = data.creadorId;
            const tituloSistema = data.titulo || "Tu sistema";

            // 2. Enviar notificación de baneo al usuario
            await addDoc(collection(db, "notificaciones"), {
                paraId: dueñoId, // Campo correcto según tus fotos de Firebase
                titulo: "Sistema Eliminado",
                mensaje: `Tu sistema "${tituloSistema}" ha sido eliminado por infringir las normas de la comunidad tras varios reportes.`,
                tipo: "moderacion",
                fecha: serverTimestamp(),
                leida: false
            });

            // 3. Eliminar el sistema
            await deleteDoc(sistemaRef);
        }

        // 4. Eliminar el reporte del panel de admin
        await deleteDoc(doc(db, "reportes", reporteId)); 
        
        alert("Sistema eliminado y usuario notificado.");
        if (typeof cargarPanelAdmin === 'function') cargarPanelAdmin();

    } catch (error) {
        console.error("Error en moderación:", error);
    }
};
// --- FUNCIÓN PARA ELIMINAR ---
window.eliminarNotificacion = async (notiId) => {
    try {
        await deleteDoc(doc(db, "notificaciones", notiId));
    } catch (error) {
        console.error("Error al borrar notificación:", error);
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
    } catch (error) { alert("Error al enviar reporte."); }
};

// --- UTILIDADES ---
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
    } catch (e) { alert("Error al descargar."); }
};

window.buscarPersonasApartado = async () => {
    const busqueda = document.getElementById('input-persona')?.value.trim().toLowerCase();
    const resultadosDiv = document.getElementById('resultados-personas');
    if (!busqueda || !resultadosDiv) { if(resultadosDiv) resultadosDiv.innerHTML = ""; return; }

    try {
        const snap = await getDocs(collection(db, "usuarios"));
        const encontrados = [];
        snap.forEach(doc => {
            const u = doc.data();
            if ((u.nombre || "").toLowerCase().includes(busqueda) || (u.id || "").toLowerCase().includes(busqueda)) {
                encontrados.push(u);
            }
        });

        resultadosDiv.innerHTML = encontrados.length === 0 ? "<p>No hay resultados</p>" : encontrados.map(u => `
            <div class="perfil-item" onclick="window.verPerfil('${u.id}')" style="display:flex; align-items:center; gap:10px; background:#1a1a1a; padding:10px; border-radius:10px; margin-bottom:5px; cursor:pointer; border:1px solid #333;">
                <img src="${u.foto || 'https://via.placeholder.com/40'}" style="width:40px; height:40px; border-radius:50%;">
                <div>
                    <div style="color:white; font-weight:bold; font-size:0.9rem;">${u.nombre}</div>
                    <div style="color:var(--accent); font-size:0.7rem;">${u.seguidoresCount || 0} seguidores</div>
                </div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
};

window.verPerfil = (id) => window.location.href = `perfil.html?id=${id}`;