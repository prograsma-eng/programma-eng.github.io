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
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// --- FUNCIÓN PARA EL CONTADOR EN TIEMPO REAL ---
export const conectarContadorSeguidores = (autorId) => {
    if (!autorId) return;

    const autorRef = doc(db, "usuarios", autorId);
    
    onSnapshot(autorRef, (docSnap) => {
        // IMPORTANTE: Buscamos TODOS los contadores de este autor en la página
        const contadores = document.querySelectorAll(`#count-seguidores-${autorId}`);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Usamos el nombre exacto que vi en tu imagen: seguidoresCount
            // Si el campo no existe en algún usuario, ponemos 0 por defecto
            const total = data.seguidoresCount !== undefined ? data.seguidoresCount : 0;
            
            contadores.forEach(span => {
                span.innerText = total;
            });
            
            console.log(`✅ Sincronizados ${contadores.length} contadores para ${autorId}: ${total}`);
        }
    });
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