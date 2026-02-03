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

    if (!window.Clerk?.user) {
        alert("Sesión no detectada.");
        return;
    }

    const userId = window.Clerk.user.id;
    const confirmar = confirm("⚠️ ¿Borrar todo? Se eliminarán tus sistemas, seguidores, seguidos y likes permanentemente.");
    if (!confirmar) return;

    try {
        const batch = writeBatch(db);
        const todosLosSistemas = await getDocs(collection(db, "sistemas"));

        for (const sistemaDoc of todosLosSistemas.docs) {
            const comentariosRef = collection(db, "sistemas", sistemaDoc.id, "comentarios");
            const qTusComentarios = query(comentariosRef, where("autorId", "==", userId));
            const snapTusComentarios = await getDocs(qTusComentarios);

            snapTusComentarios.forEach(comenDoc => {
                batch.delete(comenDoc.ref);
            });

            const todosLosComentarios = await getDocs(comentariosRef);
            todosLosComentarios.forEach(comenDoc => {
                const data = comenDoc.data();
                if (data.respuestas && Array.isArray(data.respuestas)) {
                    const tieneTuRespuesta = data.respuestas.some(r => r.autorId === userId);
                    if (tieneTuRespuesta) {
                        const nuevasRespuestas = data.respuestas.filter(r => r.autorId !== userId);
                        batch.update(comenDoc.ref, { respuestas: nuevasRespuestas });
                    }
                }
            });
        }
        const userRef = doc(db, "usuarios", userId);
        batch.delete(userRef);
        const qSistemas = query(collection(db, "sistemas"), where("creadorId", "==", userId));
        const snapSistemas = await getDocs(qSistemas);
        snapSistemas.forEach(d => batch.delete(d.ref));
        const qLikes = query(collection(db, "sistemas"), where("usuariosQueDieronLike", "array-contains", userId));
        const snapLikes = await getDocs(qLikes);
        snapLikes.forEach(d => {
            batch.update(d.ref, {
                usuariosQueDieronLike: arrayRemove(userId),
                likes: increment(-1)
            });
        });
const qAQuienSeguia = query(collection(db, "usuarios"), where("seguidoresCount", ">", 0)); 
const miPerfilSnap = await getDoc(doc(db, "usuarios", userId));
if (miPerfilSnap.exists()) {
    const misSiguiendo = miPerfilSnap.data().siguiendo || [];
    misSiguiendo.forEach(otroId => {
        const otroRef = doc(db, "usuarios", otroId);
        batch.update(otroRef, {
            seguidoresCount: increment(-1) 
        });
    });
}

const qQuienMeSeguia = query(collection(db, "usuarios"), where("siguiendo", "array-contains", userId));

const snapMeSiguen = await getDocs(qQuienMeSeguia);
snapMeSiguen.forEach(d => {
    batch.update(d.ref, {
        siguiendo: arrayRemove(userId)
    });
});
        const qNotis = query(collection(db, "notificaciones"), where("paraId", "==", userId));
        const snapNotis = await getDocs(qNotis);
        snapNotis.forEach(d => batch.delete(d.ref));

        await batch.commit();
        alert("¡Cuenta y rastro eliminados con éxito!");

        if (window.Clerk.openUserProfile) {
            window.Clerk.openUserProfile();
        } else {
            window.location.href = "/";
        }

    } catch (error) {
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

const unsubscribesSeguidores = new Map();

export const conectarContadorSeguidores = (autorId) => {
    if (!autorId) return;
    if (unsubscribesSeguidores.has(autorId)) {
        unsubscribesSeguidores.get(autorId)(); 
    }

    const autorRef = doc(db, "usuarios", autorId);

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
