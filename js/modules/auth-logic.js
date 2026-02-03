import { 
    db, doc, setDoc, collection, addDoc, serverTimestamp, 
    onSnapshot, query, orderBy 
} from '../firebase-config.js';

const contenedorSistemas = document.getElementById('contenedor-sistemas');
let todosLosSistemas = [];

const lanzarBienvenida = () => {
    const modal = document.getElementById('welcome-modal');
    const yaVisto = sessionStorage.getItem('bienvenidaMostrada');
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

