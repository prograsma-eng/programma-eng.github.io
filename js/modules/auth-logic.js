// 1. IMPORTACIONES COMPLETAS (Agregué onSnapshot, query, orderBy que faltaban)
import { 
    db, doc, setDoc, collection, addDoc, serverTimestamp, 
    onSnapshot, query, orderBy 
} from '../firebase-config.js';

// 2. DEFINICIÓN DE VARIABLES (Para que el IF no de error)
const contenedorSistemas = document.getElementById('contenedor-sistemas');
let todosLosSistemas = [];

// --- BIENVENIDA ---
const lanzarBienvenida = () => {
    const modal = document.getElementById('welcome-modal');
    const yaVisto = sessionStorage.getItem('bienvenidaMostrada');
    // Usamos Clerk directamente ya que es global
    if (window.Clerk && Clerk.user && !yaVisto && modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 50);
        sessionStorage.setItem('bienvenidaMostrada', 'true');
    }
};

window.cerrarBienvenida = function() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
    }
};

// --- ESCUCHA DE DATOS ---
//if (contenedorSistemas) {
    // Escucha en tiempo real de la colección "sistemas"
   // onSnapshot(query(collection(db, "sistemas"), orderBy("likes", "desc")), (snap) => {
       // todosLosSistemas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Se asume que renderizar() está definido en app.js o ui-logic.js
        //if (typeof renderizar === "function") renderizar();
    //});
//}

// --- REGISTRO DE USUARIO ---
async function registrarUsuarioEnBaseDeDatos(user) {
    if (!user) return;
    
    const userRef = doc(db, "usuarios", user.id);
    await setDoc(userRef, {
        id: user.id,
        nombre: user.fullName || "Usuario sin nombre",
        foto: user.imageUrl || "",
        seguidoresCount: 0,
        nombre_min: (user.fullName || "").toLowerCase()
    }, { merge: true }); 
}
