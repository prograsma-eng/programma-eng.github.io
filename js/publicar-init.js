import { agregarCampoArchivo, configurarFormulario } from './modules/posts-logic.js';

document.addEventListener('DOMContentLoaded', () => {
    const logo = document.getElementById('logo-home');
    if (logo) {
        logo.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    const btnAdd = document.getElementById('btn-add');
    if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
            e.preventDefault();
            agregarCampoArchivo();
        });
    }

    configurarFormulario();
    agregarCampoArchivo();
});
