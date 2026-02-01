import { agregarCampoArchivo, configurarFormulario } from './modules/posts-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    // Manejar el clic del logo (ya no usamos onclick en HTML)
    const logo = document.getElementById('logo-home');
    if (logo) {
        logo.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // Manejar el botón añadir
    const btnAdd = document.getElementById('btn-add');
    if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
            e.preventDefault();
            agregarCampoArchivo();
        });
        console.log("✅ Sistema vinculado correctamente");
    }

    configurarFormulario();
    agregarCampoArchivo();
});