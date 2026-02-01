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
    console.log("🛠️ Intentando ejecutar eliminarCuentaTotalmente...");

    // 1. Verificar si Clerk está cargado
    if (!window.Clerk || !window.Clerk.user) {
        console.error("❌ CLERK NO DETECTADO:", window.Clerk);
        alert("Error: No se detecta tu sesión de Clerk. Espera a que cargue la página.");
        return;
    }

    const userId = window.Clerk.user.id;
    console.log("👤 Usuario identificado:", userId);

    const confirmar = confirm("⚠️ ¿ESTÁS SEGURO? Se borrarán tus sistemas, notificaciones y perfil de Firestore.");
    if (!confirmar) {
        console.log("px Cancelado por el usuario.");
        return;
    }

    try {
        const batch = writeBatch(db);
        console.log("📦 Batch creado. Preparando borrado de perfil...");

        // Referencia al perfil principal
        const userRef = doc(db, "usuarios", userId);
        batch.delete(userRef);
        console.log("📌 Marcado para borrar perfil en: usuarios/" + userId);

        // Limpiar colecciones
        const colecciones = ["sistemas", "notificaciones"];

        for (const nombreCol of colecciones) {
            console.log(`🔍 Buscando documentos en la colección: [${nombreCol}] donde usuarioId == ${userId}`);
            
            // IMPORTANTE: Verifica si en tu DB es "usuarioId" o "creadorId"
            const q = query(collection(db, nombreCol), where("creadorId", "==", userId));
            const snapshot = await getDocs(q);
            
            console.log(`📊 Encontrados ${snapshot.size} documentos en [${nombreCol}]`);

            snapshot.forEach((documento) => {
                console.log(`   - Marcando para borrar ID: ${documento.id}`);
                batch.delete(documento.ref);
            });
        }

        console.log("📡 Enviando todos los cambios a Firebase (Commit)...");
        await batch.commit();
        
        console.log("✅ ¡ÉXITO! Firebase confirmó el borrado total.");
        alert("¡Tus datos han sido eliminados de la base de datos!");
        
        // 3. Redirección final
        if (window.Clerk.openUserProfile) {
            console.log("📂 Abriendo panel de Clerk para borrado de cuenta de autenticación...");
            window.Clerk.openUserProfile();
        } else {
            console.log("🏠 Redirigiendo al inicio...");
            window.location.href = "/";
        }

    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN EL BORRADO:", error);
        alert("Error de Firebase: " + error.code + " - " + error.message);
        
        if (error.code === 'permission-denied') {
            console.warn("👉 Tip: Revisa tus 'Security Rules' en Firebase. Debes tener permiso para borrar.");
        }
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