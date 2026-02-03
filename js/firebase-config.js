import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment, 
    setDoc, 
    deleteDoc, 
    getDoc, 
    where,
    arrayUnion,
    arrayRemove,
    getDocs,
    writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.eliminarCuentaTotalmente = async () => {
    console.log("🛠️ Iniciando limpieza profunda (Seguidores + Likes + Sistemas)...");

    if (!window.Clerk?.user) {
        alert("Sesión no detectada.");
        return;
    }

    const userId = window.Clerk.user.id;
    const confirmar = confirm("⚠️ ¿Borrar todo? Se eliminarán tus sistemas, seguidores, seguidos y likes permanentemente.");
    if (!confirmar) return;

    try {
        const batch = writeBatch(db);
        // --- 1. PROCESAR TODOS LOS SISTEMAS PARA LIMPIAR COMENTARIOS Y RESPUESTAS ---
        console.log("🔍 Escaneando todos los sistemas para borrar tus comentarios y respuestas...");
        const todosLosSistemas = await getDocs(collection(db, "sistemas"));

        for (const sistemaDoc of todosLosSistemas.docs) {
            // A. Buscar tus comentarios (Sub-colección)
            const comentariosRef = collection(db, "sistemas", sistemaDoc.id, "comentarios");
            const qTusComentarios = query(comentariosRef, where("autorId", "==", userId));
            const snapTusComentarios = await getDocs(qTusComentarios);

            snapTusComentarios.forEach(comenDoc => {
                console.log(`   🗑️ Borrando tu comentario en sistema: ${sistemaDoc.id}`);
                batch.delete(comenDoc.ref);
            });

            // B. Buscar tus respuestas dentro de comentarios de otros (Array 'respuestas')
            const todosLosComentarios = await getDocs(comentariosRef);
            todosLosComentarios.forEach(comenDoc => {
                const data = comenDoc.data();
                if (data.respuestas && Array.isArray(data.respuestas)) {
                    const tieneTuRespuesta = data.respuestas.some(r => r.autorId === userId);
                    if (tieneTuRespuesta) {
                        console.log(`   ➖ Quitando tu respuesta en el comentario: ${comenDoc.id}`);
                        const nuevasRespuestas = data.respuestas.filter(r => r.autorId !== userId);
                        batch.update(comenDoc.ref, { respuestas: nuevasRespuestas });
                    }
                }
            });
        }
        // --- 1. BORRAR PERFIL (Favoritos, LikesDados, Seguidores están dentro) ---
        // Según tu imagen, estos campos viven dentro del documento de la colección 'usuarios'
        const userRef = doc(db, "usuarios", userId);
        batch.delete(userRef);
        console.log("📌 Perfil y listas de favoritos/seguidores marcados para borrar.");

        // --- 2. BORRAR SISTEMAS PROPIOS ---
        const qSistemas = query(collection(db, "sistemas"), where("creadorId", "==", userId));
        const snapSistemas = await getDocs(qSistemas);
        snapSistemas.forEach(d => batch.delete(d.ref));
        console.log(`🗑️ Marcados ${snapSistemas.size} sistemas propios para eliminar.`);

        // --- 3. QUITAR LIKES DE OTROS SISTEMAS ---
        // Buscamos donde el usuario aparece en 'usuariosQueDieronLike'
        const qLikes = query(collection(db, "sistemas"), where("usuariosQueDieronLike", "array-contains", userId));
        const snapLikes = await getDocs(qLikes);
        snapLikes.forEach(d => {
            batch.update(d.ref, {
                usuariosQueDieronLike: arrayRemove(userId),
                likes: increment(-1)
            });
        });
        console.log(`➖ Removidos likes en ${snapLikes.size} sistemas ajenos.`);

        // A. BUSCAR A LAS PERSONAS QUE TÚ SEGUÍAS
// Para restarles un seguidor a ellos en su 'seguidoresCount'
console.log("🔍 Buscando a quiénes seguías para restarles un seguidor...");
const qAQuienSeguia = query(collection(db, "usuarios"), where("seguidoresCount", ">", 0)); 
// Nota: Aquí lo ideal es obtener tu lista de 'siguiendo' antes de borrar tu perfil

const miPerfilSnap = await getDoc(doc(db, "usuarios", userId));
if (miPerfilSnap.exists()) {
    const misSiguiendo = miPerfilSnap.data().siguiendo || [];
    
    console.log(`📊 Seguías a ${misSiguiendo.length} personas. Ajustando sus contadores...`);
    
    misSiguiendo.forEach(otroId => {
        const otroRef = doc(db, "usuarios", otroId);
        batch.update(otroRef, {
            // Bajamos el contador de la persona a la que tú seguías
            seguidoresCount: increment(-1) 
        });
        console.log(`   📉 Contador restado al usuario: ${otroId}`);
    });
}

// B. BUSCAR A QUIÉNES TE SEGUÍAN A TI
// Para borrar tu ID de sus listas de 'siguiendo'
console.log("🔍 Buscando usuarios que te seguían para borrarte de sus listas...");
const qQuienMeSeguia = query(collection(db, "usuarios"), where("siguiendo", "array-contains", userId));

const snapMeSiguen = await getDocs(qQuienMeSeguia);
snapMeSiguen.forEach(d => {
    console.log(`   👤 Borrando tu ID de la lista 'siguiendo' de: ${d.id}`);
    batch.update(d.ref, {
        siguiendo: arrayRemove(userId)
    });
});
        // --- 5. BORRAR NOTIFICACIONES ---
        const qNotis = query(collection(db, "notificaciones"), where("paraId", "==", userId));
        const snapNotis = await getDocs(qNotis);
        snapNotis.forEach(d => batch.delete(d.ref));

        // --- EJECUCIÓN ---
        await batch.commit();
        console.log("✅ Limpieza total completada en Firebase.");
        alert("¡Cuenta y rastro eliminados con éxito!");

        if (window.Clerk.openUserProfile) {
            window.Clerk.openUserProfile();
        } else {
            window.location.href = "/";
        }

    } catch (error) {
        console.error("❌ Error en el borrado:", error);
        alert("Error: " + error.message);
    }
};
const firebaseConfig = { 
    apiKey: "AIzaSyA6HiPcffZ6fCvaXm0RKjs2Zd-t_siSjb4", 
    authDomain: "robloxcommunity-bb652.firebaseapp.com", 
    projectId: "robloxcommunity-bb652", 
    storageBucket: "robloxcommunity-bb652.firebasestorage.app", 
    messagingSenderId: "114286923700", 
    appId: "1:114286923700:web:d6cb6a07d36bf85e6b6ce1" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Creamos un mapa para guardar los "cierres" de los listeners
const unsubscribesSeguidores = new Map();

export const conectarContadorSeguidores = (autorId) => {
    if (!autorId) return;

    // 1. Si ya tenemos un listener activo para este autor, lo cerramos antes de crear uno nuevo
    if (unsubscribesSeguidores.has(autorId)) {
        unsubscribesSeguidores.get(autorId)(); 
    }

    const autorRef = doc(db, "usuarios", autorId);
    
    // 2. Guardamos la función de cierre que devuelve onSnapshot
    const unsub = onSnapshot(autorRef, (docSnap) => {
        const selector = `#count-seguidores-${autorId}`;
        const contadores = document.querySelectorAll(selector);
        
        if (docSnap.exists()) {
            const total = docSnap.data().seguidoresCount ?? 0;
            contadores.forEach(span => {
                span.innerText = total;
            });
        }
    });

    unsubscribesSeguidores.set(autorId, unsub);
};

// --- EXPORTACIÓN DE TODAS LAS HERRAMIENTAS ---
export { 
    db, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    increment, 
    setDoc, 
    deleteDoc, 
    getDoc, 
    where,
    arrayUnion,
    arrayRemove,
    getDocs,
    getAuth
};

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
const auth = getAuth(app);
export { auth, onAuthStateChanged };