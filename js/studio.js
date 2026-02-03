import { 
    db, collection, query, where, onSnapshot, doc, getDoc, orderBy,
    updateDoc, increment, arrayUnion, arrayRemove, addDoc, serverTimestamp,
    auth, onAuthStateChanged, conectarContadorSeguidores 
} from './firebase-config.js';

let listaPublicaciones = [];
let listaFavoritos = [];
window.misFavoritosGlobal = []; 
window.misSiguiendoGlobal = [];  
window.editandoId = null; 
let tabActual = 'publicaciones';
let textoBusqueda = "";

const escucharDatosStudio = (userId) => {
    const usuarioRef = doc(db, "usuarios", userId);

    onSnapshot(usuarioRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const elSeguidores = document.getElementById('stat-favs');
            if (elSeguidores) {
                elSeguidores.innerText = data.seguidoresCount || 0;
            }

            window.misSiguiendoGlobal = data.siguiendo || [];
            window.misFavoritosGlobal = data.favoritos || [];
            
            if (window.misFavoritosGlobal.length > 0) {
                cargarSistemasFavoritos(window.misFavoritosGlobal);
            }
            
            renderizarSegunTab();
        }
    });
};

function cargarPublicacionesStudio(userId) {
    const qPub = query(collection(db, "sistemas"), where("creadorId", "==", userId), orderBy("fecha", "desc"));
    
    onSnapshot(qPub, (snap) => {
        listaPublicaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalLikes = listaPublicaciones.reduce((acc, sys) => acc + (sys.likes || 0), 0);
        const totalPubs = listaPublicaciones.length;
        window.todosLosSistemas = listaPublicaciones;

        const elLikes = document.getElementById('stat-likes');
        const elPubs = document.getElementById('stat-posts');

        if (elLikes) elLikes.innerText = totalLikes;
        if (elPubs) elPubs.innerText = totalPubs;

        renderizarSegunTab();
    });
}
const inicializarClerkEnStudio = () => {
    const scriptClerk = document.createElement('script');
    scriptClerk.setAttribute('data-clerk-publishable-key', 'pk_test_Z3VpZGVkLWNvbGxpZS0yOC5jbGVyay5hY2NvdW50cy5kZXYk');
    scriptClerk.async = true;
    scriptClerk.src = 'https://allowed-moth-84.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js';

    scriptClerk.onload = async () => {
        await Clerk.load();

        const configurarInterfazUsuario = async (user) => {
            window.currentUser = user;
            
            const userButtonDiv = document.getElementById('user-button');
            if (userButtonDiv) {
                await Clerk.mountUserButton(userButtonDiv, {
                    afterSignOutUrl: "index.html",
                });
            }
            escucharDatosStudio(user.id);
            
            cargarPublicacionesStudio(user.id);
        };

        if (Clerk.user) {
            await configurarInterfazUsuario(Clerk.user);
        } else {
            setTimeout(async () => {
                if (Clerk.user) await configurarInterfazUsuario(Clerk.user);
                else window.location.href = "index.html";
            }, 1500); 
        }
    };
    document.head.appendChild(scriptClerk);
};

inicializarClerkEnStudio();
document.getElementById('input-busqueda')?.addEventListener('input', (e) => {
    textoBusqueda = e.target.value.toLowerCase();
    renderizarSegunTab();
})
window.cambiarTab = (tab) => {
    tabActual = tab;
    const items = {
        'publicaciones': { id: 'tab-pub', title: 'Contenido del canal' },
        'favoritos': { id: 'tab-fav', title: 'Tus Favoritos Guardados' },
        'estadisticas': { id: 'tab-est', title: 'Estadísticas del canal' }
    };

    Object.values(items).forEach(item => {
        document.getElementById(item.id)?.classList.remove('active');
    });
    
    document.getElementById(items[tab].id)?.classList.add('active');
    document.getElementById('titulo-studio').innerText = items[tab].title;
    
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        searchContainer.style.display = (tab === 'estadisticas') ? "none" : "block";
    }

    renderizarSegunTab();
};

function renderizarSegunTab() {
    const contenedor = document.getElementById('contenedor-estudio');
    if (!contenedor) return;

    if (tabActual === 'estadisticas') {
        renderizarEstadisticas(contenedor);
        return;
    }

    if (typeof window.generarHTMLSistemas !== 'function') {
        contenedor.innerHTML = `<p style="text-align:center; padding:50px; color:gray;">Cargando motor de renderizado...</p>`;
        setTimeout(renderizarSegunTab, 500);
        return;
    }

    let datos = tabActual === 'publicaciones' ? listaPublicaciones : listaFavoritos;
    const datosFiltrados = datos.filter(sys => (sys.titulo || "").toLowerCase().includes(textoBusqueda));

    if (datosFiltrados.length === 0) {
        contenedor.innerHTML = `<p style="text-align:center; padding:50px; color:gray;">No hay contenido disponible.</p>`;
        return;
    }

    let htmlExtra = "";
    if (tabActual === 'publicaciones' && !textoBusqueda && datos[0]) {
        const ultima = datos[0];
        htmlExtra = `
            <div class="highlight-last">
                <span style="color: var(--accent); font-size: 0.8rem; font-weight: bold;">ÚLTIMA PUBLICACIÓN</span>
                <h4 style="margin: 10px 0; font-size: 1.4rem;">${ultima.titulo || "Sin título"}</h4>
                <div style="display: flex; gap: 20px; color: var(--text-gray); font-size: 0.9rem;">
                    <span>❤️ ${ultima.likes || 0} Likes</span>
                    <span>⭐ ${ultima.favsCount || 0} Favs</span>
                </div>
            </div>`;
    }

    contenedor.innerHTML = htmlExtra + window.generarHTMLSistemas(
    datosFiltrados, 
    window.misSiguiendoGlobal || [], 
    window.misFavoritosGlobal || [], 
    false
    )
    if (window.Prism) Prism.highlightAll();
datosFiltrados.forEach(sys => {
    if (typeof conectarContadorSeguidores === 'function') {
        conectarContadorSeguidores(sys.creadorId);
    }
});
}
window.renderizarSegunTab = renderizarSegunTab;
function renderizarEstadisticas(contenedor) {
    const totalLikes = listaPublicaciones.reduce((acc, sys) => acc + (sys.likes || 0), 0);
    const totalPubs = listaPublicaciones.length;
    const userId = window.currentUser?.id;

    const seguidoresReales = document.getElementById('stat-favs')?.innerText || "0";

contenedor.innerHTML = `
    <div class="stats-container">
        <div class="stats-grid">
            <div class="stat-card">
                <p>Seguidores Totales</p>
                <h2 style="color: #ffca28;">${seguidoresReales}</h2>
            </div>
            </div>
        ...
    </div>
`;

    contenedor.innerHTML = `
        <div class="stats-container">
            <div class="stats-grid">
                <div class="stat-card">
                    <p>Seguidores Totales</p>
                    <h2 id="count-seguidores-${userId}">${document.getElementById('seguidores-estudio-main')?.innerText || 0}</h2>
                </div>
                <div class="stat-card">
                    <p>Publicaciones</p>
                    <h2>${totalPubs}</h2>
                </div>
                <div class="stat-card">
                    <p>Likes Totales</p>
                    <h2 style="color: #ff4e4e;">${totalLikes}</h2>
                </div>
            </div>
            <div class="chart-wrapper" style="margin-top:20px; background:#111; padding:20px; border-radius:12px;">
                <canvas id="graficaCanal"></canvas>
            </div>
        </div>
    `;
    setTimeout(crearGraficaEfectiva, 150);
}
function crearGraficaEfectiva() {
    const ctx = document.getElementById('graficaCanal');
    if (!ctx || typeof Chart === 'undefined') return;

    if (window.miChart) window.miChart.destroy();

    const topSistemas = [...listaPublicaciones]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5);

    const etiquetas = topSistemas.map(s => s.titulo.substring(0, 10) + "...");
    const datosLikes = topSistemas.map(s => s.likes || 0);

    window.miChart = new Chart(ctx, {
        type: 'bar', 
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Likes por Sistema',
                data: datosLikes,
                backgroundColor: 'rgba(0, 162, 255, 0.5)',
                borderColor: '#00a2ff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: '#222' }, 
                    ticks: { color: '#888', stepSize: 1 } 
                },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            },
            plugins: {
                legend: { display: true, labels: { color: '#fff' } }
            }
        }
    });
}
const cargarSistemasFavoritos = async (listaIds) => {
    if (!listaIds || listaIds.length === 0) {
        listaFavoritos = [];
        renderizarSegunTab();
        return;
    }

    try {
        const q = query(collection(db, "sistemas"), where("__name__", "in", listaIds));
        
        onSnapshot(q, (snap) => {
            listaFavoritos = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            if (tabActual === 'favoritos') {
                renderizarSegunTab();
            }
        });
    } catch (error) {
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const tabPublicaciones = document.getElementById('tab-pub');
    const tabFavoritos = document.getElementById('tab-fav');
    const tabEstadisticas = document.getElementById('tab-est');

    if (tabPublicaciones) {
        tabPublicaciones.addEventListener('click', () => cambiarTab('publicaciones'));
    }
    if (tabFavoritos) {
        tabFavoritos.addEventListener('click', () => cambiarTab('favoritos'));
    }
    if (tabEstadisticas) {
        tabEstadisticas.addEventListener('click', () => cambiarTab('estadisticas'));
    }

});
