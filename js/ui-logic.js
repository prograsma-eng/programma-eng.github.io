import { 
    db, collection, query, orderBy, onSnapshot, doc, getDoc, deleteDoc 
} from './firebase-config.js';
import { conectarContadorSeguidores } from './firebase-config.js';
import { generarHTMLSistemas } from './modules/posts-logic.js';

export function resaltarRoblox(codigo) {
    if (!codigo) return "";
    let esc = codigo.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc
        .replace(/("(.*?)"|'(.*?)')/g, '<span style="color:var(--lua-string)">$1</span>')
        .replace(/\b(function|local|if|then|else|elseif|end|while|for|do|return|and|or|not|true|false|nil)\b/g, '<span style="color:var(--lua-keyword)">$1</span>')
        .replace(/\b(game|workspace|script|Instance|Vector3|CFrame|Color3|task|wait|spawn|print|warn|error|getgenv|getsenv)\b/g, '<span style="color:var(--lua-builtin)">$1</span>')
        .replace(/(--.*)/g, '<span style="color:var(--lua-comment)">$1</span>')
        .replace(/\b(\d+)\b/g, '<span style="color:var(--lua-number)">$1</span>');
}

const inputBuscador = document.getElementById('buscador-input');
if (inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase().trim();
        const cont = document.getElementById('contenedor-sistemas');
        if (!window.todosLosSistemas || !cont) return;

        const filtrados = window.todosLosSistemas.filter(sys => 
            sys.titulo.toLowerCase().includes(texto) || 
            sys.autor.toLowerCase().includes(texto) || 
            sys.tag.toLowerCase().includes(texto)
        );

        cont.innerHTML = generarHTMLSistemas(
            filtrados, 
            window.misSiguiendoGlobal || [],
            window.misFavoritosGlobal || []
        );

        if (window.Prism) Prism.highlightAll();
        filtrados.forEach(sys => {
            if(window.escucharComentarios) window.escucharComentarios(sys.id);
        });
    });
}

function actualizarTextoBoton(id) {
    const btn = document.getElementById(`btn-coms-${id}`);
    const wrapper = document.getElementById(`wrapper-${id}`);
    const comsDiv = document.getElementById(`coms-${id}`);
    if (!btn || !comsDiv) return;
    
    const conteo = comsDiv.children.length;
    if (!wrapper.classList.contains('open')) {
        btn.innerText = `💬 Ver comentarios (${conteo})`;
    }

}
