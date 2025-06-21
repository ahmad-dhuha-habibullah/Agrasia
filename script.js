// --- Global State & Variables ---
let allFarmsData = [];
let currentFarmId = null;

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    applyInitialSidebarState(); // Applies the saved sidebar state on page load
    setupDashboard();
});

function checkAuth() {
    const token = localStorage.getItem('agrasia-token');
    const userName = localStorage.getItem('agrasia-user');
    
    if (!token || !userName) {
        window.location.href = '/login.html';
    } else {
        document.getElementById('user-name-display').textContent = `Welcome, ${userName}!`;
    }
}

async function setupDashboard() {
    initMap(); // From map.js
    allFarmsData = await loadFarms(); // From api.js
    
    if (allFarmsData && allFarmsData.length > 0) {
        populateFarms(allFarmsData, handleFarmSelection); // From ui.js
        setupEventListeners();
    }
}

function initMap() {
    // 1. Define the map layers
    const defaultMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    });

    const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
    });

    // 2. Initialize the map with the default layer
    map = L.map('map', {
        center: [0.8, 101.85],
        zoom: 9,
        layers: [defaultMap] // Set the default layer
    });

    // 3. Create the control object
    const baseLayers = {
        "Default": defaultMap,
        "Satellite": satelliteMap
    };

    // 4. Add the control to the map
    L.control.layers(baseLayers).addTo(map);
}

// This function remembers if the sidebar was open or closed
function applyInitialSidebarState() {
    const savedState = localStorage.getItem('sidebarState');
    if (savedState === 'collapsed') {
        document.body.classList.add('sidebar-collapsed');
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // --- Your existing listeners ---
    const toggleButton = document.getElementById('toggle-spatial-data');
    if (toggleButton) {
        toggleButton.addEventListener('click', function() {
            if (currentFarmId) {
                const farm = allFarmsData.find(f => f.id === currentFarmId);
                if (ndviOverlayLayer) {
                    removeNdviSpatialLayer();
                    this.textContent = 'Show Spatial Vigor';
                } else {
                    addNdviSpatialLayer(farm);
                    this.textContent = 'Hide Spatial Vigor';
                }
            } else {
                alert("Please select a farm first.");
            }
        });
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('agrasia-token');
            localStorage.removeItem('agrasia-user');
            window.location.href = '/login.html';
        });
    }

    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    document.getElementById('farm-list').addEventListener('click', () => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });

    // --- ADDED: Logic for the new desktop collapse button ---
    const desktopToggle = document.getElementById('sidebar-toggle');
    if (desktopToggle) {
        desktopToggle.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            const isCollapsed = document.body.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
        });
    }
}

// --- Main Application Logic (Unchanged) ---
async function handleFarmSelection(selectedFarmId) {
    if (currentFarmId === selectedFarmId) return;

    removeNdviSpatialLayer();
    const toggleButton = document.getElementById('toggle-spatial-data');
    if(toggleButton) toggleButton.textContent = 'Show Spatial Vigor';

    currentFarmId = selectedFarmId;

    document.querySelectorAll('.farm-list-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.farmId === currentFarmId);
    });

    for (const farmId in mapLayers) {
        mapLayers[farmId].setStyle(farmId === currentFarmId ?
            { fillColor: "#10B981", color: "#15803d", weight: 3 } :
            { fillColor: "#BFDBFE", color: "#3B82F6", weight: 2 }
        );
    }

    if(mapLayers[currentFarmId]) {
        map.fitBounds(mapLayers[currentFarmId].getBounds().pad(0.1));
    }

    const farmData = await fetchAllFarmData(currentFarmId);
    if (!farmData) {
        document.getElementById('dashboard-content').classList.add('hidden');
        return;
    }

    updateDashboardUI(farmData);
}