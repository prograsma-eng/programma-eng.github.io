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
if (contenedorSistemas) {
    // Escucha en tiempo real de la colección "sistemas"
    onSnapshot(query(collection(db, "sistemas"), orderBy("likes", "desc")), (snap) => {
        todosLosSistemas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Se asume que renderizar() está definido en app.js o ui-logic.js
        if (typeof renderizar === "function") renderizar();
    });
}

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

// --- FORMULARIO (EXPORTADO) ---
export function configurarFormulario() {
    const form = document.getElementById('form-sistema');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Prioridad: 1. Clerk cargado, 2. Variable global window
        const user = (window.Clerk && window.Clerk.user) || window.currentUser;
        
        if (!user) {
            alert("Espera a que cargue tu sesión o inicia sesión.");
            return;
        }

        // ... resto de tu código de recolección de datos ...
        console.log("Intentando publicar sistema de:", user.fullName);

            const titulo = document.getElementById('sys-titulo').value;
            const tag = document.getElementById('sys-tag').value;
            const bloquesArchivos = document.querySelectorAll('.archivo-input-item');
            
            const listaArchivos = Array.from(bloquesArchivos).map(bloque => ({
                nombre: bloque.querySelector('.arc-nombre').value,
                tipo: bloque.querySelector('.arc-tipo').value,
                codigo: bloque.querySelector('.arc-codigo').value
            }));

            if (listaArchivos.length === 0) return alert("Añade al menos un script.");

            try {
                const btn = e.target.querySelector('.btn-submit');
                btn.innerText = "Publicando...";
                btn.disabled = true;

                await addDoc(collection(db, "sistemas"), {
                    titulo, tag,
                    autor: user.fullName,
                    creadorId: user.id,
                    foto: user.imageUrl,
                    archivos: listaArchivos,
                    likes: 0,
                    fecha: serverTimestamp()
                });

                alert("🚀 ¡Sistema publicado con éxito!");
                window.location.href = "index.html"; 
            } catch (error) {
                console.error("Error al subir:", error);
                alert("Error al subir.");
                const btn = e.target.querySelector('.btn-submit');
                btn.innerText = "Publicar Sistema";
                btn.disabled = false;
            }
        });
    }

// Exportamos también la función de bienvenida por si la necesitas en app.js
export { lanzarBienvenida, registrarUsuarioEnBaseDeDatos };