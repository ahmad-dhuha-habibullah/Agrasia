// --- Global State & Variables ---
let map;
let ndviOverlayLayer = null;
let ndviLegend = null;
let currentFarmLayer = null; // Holds the currently displayed farm boundary
let mapLayers = {}; // To store Leaflet layers by farm ID
let allFarmsData = []; // Caches the initial farms.json data
let indicesChart = null; // Chart.js instance for vegetation indices
let soilMoistureChart = null; // Chart.js instance for soil moisture
let currentFarmId = null; // The ID of the currently selected farm

// --- Application Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Remove the initial map overlay to allow direct interaction
    const overlay = document.getElementById('no-farm-selected-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    initMap();
    loadFarms();
    setupEventListeners();
});

// --- Map Initialization ---
function initMap() {
    map = L.map('map').setView([0.8, 101.85], 9); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// --- Event Listeners ---
function setupEventListeners() {
    document.getElementById('toggle-spatial-data').addEventListener('click', function() {
        if (currentFarmId) {
            const farm = allFarmsData.find(f => f.id === currentFarmId);
            if (ndviOverlayLayer) {
                removeNdviSpatialLayer();
                this.textContent = 'Show Spatial Vigor';
            } else {
                addNdviSpatialLayer(farm);
                this.textContent = 'Hide Spatial Vigor';
            }
        }
    });
}

// --- Data Fetching and Processing ---
async function loadFarms() {
    try {
        const response = await fetch('farms.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        allFarmsData = await response.json();
        populateFarms(allFarmsData);
    } catch (error) {
        console.error("Fatal Error: Could not load farms.json.", error);
        alert("Application could not start. Please check that farms.json is in the root project folder.");
    }
}

async function fetchAllFarmData(farmId) {
    try {
        // RE-CORRECTED: Added subfolder paths back to fetch calls
        const dataPromise = fetch(`${farmId}_data.json`).then(res => res.json());
        const soilPromise = fetch(`timeseries/${farmId}_soil.csv`).then(res => res.text());
        const indicesPromise = fetch(`timeseries/${farmId}_indices.csv`).then(res => res.text());
        const extraData = getMockExtraData(farmId);

        const [data, soilCsv, indicesCsv] = await Promise.all([dataPromise, soilPromise, indicesPromise]);

        return {
            ...data,
            soilData: parseCsv(soilCsv),
            indicesData: parseCsv(indicesCsv),
            ...extraData
        };
    } catch (error) {
        console.error(`Error fetching data for farm ${farmId}:`, error);
        alert(`Could not load all data for ${farmId}. Please check the file paths and console for errors.`);
        return null;
    }
}

// --- UI Population & Updates ---
function populateFarms(farms) {
    const farmListElement = document.getElementById('farm-list');
    farmListElement.innerHTML = ''; 

    farms.forEach(farm => {
        const geojsonLayer = L.geoJSON(farm.geojson, {
            style: { color: "#3B82F6", weight: 2, opacity: 0.8, fillColor: "#BFDBFE", fillOpacity: 0.5 }
        }).bindPopup(`<b>${farm.name}</b>`).on('click', () => {
            handleFarmSelection(farm.id);
        });
        
        mapLayers[farm.id] = geojsonLayer;
        geojsonLayer.addTo(map);

        const listItem = document.createElement('li');
        listItem.className = 'farm-list-item';
        listItem.textContent = farm.name;
        listItem.dataset.farmId = farm.id;
        listItem.addEventListener('click', () => handleFarmSelection(farm.id));
        farmListElement.appendChild(listItem);
    });
    
    const group = new L.featureGroup(Object.values(mapLayers));
    map.fitBounds(group.getBounds().pad(0.1));
}

async function handleFarmSelection(selectedFarmId) {
    if (currentFarmId === selectedFarmId) return; 
    currentFarmId = selectedFarmId;
    
    document.querySelectorAll('.farm-list-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.farmId === currentFarmId);
    });

    for (const farmId in mapLayers) {
        if (farmId === currentFarmId) {
            mapLayers[farmId].setStyle({ fillColor: "#10B981", color: "#15803d", weight: 3 });
        } else {
            mapLayers[farmId].setStyle({ fillColor: "#BFDBFE", color: "#3B82F6", weight: 2 });
        }
    }
    
    if(mapLayers[currentFarmId]) {
        map.fitBounds(mapLayers[currentFarmId].getBounds().pad(0.1));
    }

    const farmData = await fetchAllFarmData(currentFarmId);
    if (!farmData) {
        return;
    }

    document.getElementById('dashboard-content').classList.remove('hidden');
    updateDashboardUI(farmData);
}

function updateDashboardUI(data) {
    updateWeatherCard(data.weatherForecast, data.lastUpdate);
    updateIndicesCard(data.currentNdvi, data.currentNdmi, data.currentEvi, data.indicesData);
    updateSoilWaterCard(data.waterStressStatus, data.soilPh, data.last24hRain, data.soilData);
    updateIrrigationCard(data.irrigation);
    updateYieldCard(data.yield);
    updateTasksCard(data.tasks);
    updateAlertsCard(data.alerts);
    updateScoutingCard(data.scouting);
}

// --- Card Update Functions ---
function updateWeatherCard(forecasts, lastUpdate) {
    const container = document.getElementById('weather-forecast-container');
    container.innerHTML = '';
    forecasts.forEach(forecast => {
        container.innerHTML += `<div class="weather-day"><div class="day">${forecast.date}</div><i class="icon fas fa-${forecast.icon}"></i><div class="temp">${forecast.temp}</div><div class="desc">${forecast.desc}</div></div>`;
    });
    document.getElementById('last-update').textContent = lastUpdate;
}
function updateIndicesCard(ndvi, ndmi, evi, indicesData) {
    document.getElementById('current-ndvi').textContent = ndvi;
    document.getElementById('current-ndmi').textContent = ndmi;
    document.getElementById('current-evi').textContent = evi;
    if (indicesChart) indicesChart.destroy();
    indicesChart = createChart('indices-chart', 'line', indicesData.labels, [
        { label: 'NDVI', data: indicesData.datasets['ndvi'], borderColor: '#16a34a', tension: 0.4, fill: false },
        { label: 'NDMI', data: indicesData.datasets['ndmi'], borderColor: '#2563eb', tension: 0.4, fill: false }
    ]);
}
function updateSoilWaterCard(stress, ph, rain, soilData) {
    document.getElementById('water-stress-status').textContent = stress;
    document.getElementById('soil-ph').textContent = ph;
    document.getElementById('last-24h-rain').textContent = rain;
    if (soilMoistureChart) soilMoistureChart.destroy();
    soilMoistureChart = createChart('soil-moisture-chart', 'line', soilData.labels, [
        { label: 'Soil Moisture (%)', data: soilData.datasets['moisture'], borderColor: '#f97316', tension: 0.4, fill: false }
    ]);
}
function updateIrrigationCard(data) {
    const card = document.querySelector('#dashboard-content > div:nth-of-type(4)');
    card.innerHTML = `
        <h4 class="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-header" viewBox="0 0 24 24" fill="currentColor"><path d="M12.928 2.333c-4.439-.433-8.893 2.155-10.835 6.271-1.353 2.868-1.353 6.22 0 9.088 1.942 4.116 6.396 6.7 10.835 6.271.936-.091 1.839-.36 2.667-.777l-1.123-1.684c-.49.255-.999.435-1.544.529-3.792.368-7.464-1.87-8.998-5.325-.929-2.3-1.071-4.88-.42-7.299 1.564-6.042 7.747-8.814 13.488-5.718l1.454-2.181c-1.072-.693-2.274-1.12-3.524-1.255zm6.545 1.706-1.454 2.181c5.741 3.096 7.052 9.672 5.488 15.714-.626 2.419-1.928 4.629-3.76 6.331l1.107 1.66c2.253-2.094 3.84-4.853 4.542-7.808s.119-6.236-1.823-10.353c-1.942-4.116-6.396-6.7-10.835-6.271l-.835-1.252z"/><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12z"/><path d="M13 7h-2v5.414l3.293 3.293 1.414-1.414L13 11.586V7z"/></svg>
            Irrigation & DSS
        </h4>
        <div class="card-content">
            <div class="info-item"><span>Irrigation Needs:</span><strong class="text-blue-600">${data.irrigationNeeds}</strong></div>
            <div class="info-item"><span>Recommendation:</span><strong class="text-green-600">${data.recommendedAction}</strong></div>
            <h5 class="sub-title">Solar System Status</h5>
            <ul class="details-list-grid">
                <li><span>Panels:</span><strong>${data.solarPanelStatus}</strong></li>
                <li><span>Battery:</span><strong>${data.batteryLevel}</strong></li>
                <li><span>Pump:</span><strong>${data.pumpStatus}</strong></li>
                <li><span>Water Flow:</span><strong>${data.waterFlow}</strong></li>
            </ul>
        </div>
        <div class="card-actions">
            <button class="app-button primary"><i class="fas fa-play-circle mr-2"></i>Control Irrigation</button>
            <button class="app-button secondary"><i class="fas fa-map-marked-alt mr-2"></i>Generate Map</button>
        </div>
    `;
}
function updateYieldCard(data) {
    const card = document.querySelector('#dashboard-content > div:nth-of-type(5)');
    card.innerHTML = `
        <h4 class="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-header" viewBox="0 0 24 24" fill="currentColor"><path d="M5 22h14v-2H5v2zm14-12v8H5v-8h14zm2-2H3v12h18V8zM19 4h-4V3h-2v1H9V3H7v1H5C3.897 4 3 4.897 3 6v14c0 1.103.897 2 2 2h14c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zM7 14h2v-4H7v4zm4 0h2v-2h-2v2zm4 0h2v-6h-2v6z"/></svg>
            Yield & Quality Est.
        </h4>
        <div class="card-content">
            <h5 class="sub-title">Crop: ${data.cropType}</h5>
            <ul class="details-list-grid">
                <li><span>Grain Filling Rate:</span><strong>${data.quality.grainFillingRate}</strong></li>
                <li><span>Milling Rendement:</span><strong>${data.quality.millingRendement}</strong></li>
                <li><span>Est. Tillers/hill:</span><strong>${data.quantity.tillers}</strong></li>
                <li><span>Est. Yield:</span><strong>${data.quantity.yield}</strong></li>
            </ul>
        </div>
        <div class="card-actions">
             <button class="app-button">View Full Report</button>
        </div>
    `;
}
function updateTasksCard(data) {
    const card = document.querySelector('#dashboard-content > div:nth-of-type(6)');
    let tasksHtml = '<li class="text-center text-gray-500 py-4">No pending tasks.</li>';
    if (data.length > 0) {
        tasksHtml = data.map(task => `
            <li class="task-item">
                <strong class="task-name">${task.name}</strong>
                <span class="task-details">Operator: ${task.operator} | Cost: ${task.cost}</span>
            </li>
        `).join('');
    }
    card.innerHTML = `
        <h4 class="card-title">
             <svg xmlns="http://www.w3.org/2000/svg" class="icon-header" viewBox="0 0 24 24" fill="currentColor"><path d="M13.414 2H6c-1.103 0-2 .897-2 2v16c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V8.586L13.414 2zM18 20H6V4h7v5h5v11z"/><path d="M8 12h8v2H8zm0 4h8v2H8z"/></svg>
            Task Management
        </h4>
        <div class="card-content">
            <ul class="details-list-col">${tasksHtml}</ul>
        </div>
        <div class="card-actions">
            <button class="app-button">Manage Tasks</button>
        </div>
    `;
}
function updateAlertsCard(data) {
    const card = document.querySelector('#dashboard-content > div:nth-of-type(7)');
     let alertsHtml = '<li class="text-center text-gray-500 py-4">No active alerts.</li>';
    if(data.length > 0){
        alertsHtml = data.map(alert => {
            const typeClass = `alert-${alert.type}`;
            return `<li class="alert-item ${typeClass}"><i class="fas fa-exclamation-circle mr-2"></i>${alert.message}</li>`
        }).join('');
    }
    card.innerHTML = `
        <h4 class="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-header animate-pulse text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M11 16h2v2h-2zm0-8h2v6h-2z"/></svg>
            Active Alerts
        </h4>
        <div class="card-content">
            <ul class="details-list-col">${alertsHtml}</ul>
        </div>
        <div class="card-actions">
            <button class="app-button danger">View All Alerts</button>
        </div>
    `;
}
function updateScoutingCard(data) {
    const card = document.querySelector('#dashboard-content > div:nth-of-type(8)');
    let reportsHtml = '<li class="text-center text-gray-500 py-4">No recent reports.</li>';
    if(data.length > 0){
        reportsHtml = data.map(report => `<li class="scouting-report"><strong>${report.date}:</strong> ${report.report}</li>`).join('');
    }
    card.innerHTML = `
        <h4 class="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon-header" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7.589 2 4 5.589 4 10c0 4.411 8 12 8 12s8-7.589 8-12c0-4.411-3.589-8-8-8zm0 12c-2.206 0-4-1.794-4-4s1.794-4 4-4 4 1.794 4 4-1.794 4-4 4z"/></svg>
            Field Scouting
        </h4>
        <div class="card-content">
             <h5 class="sub-title">Recent Reports</h5>
             <ul class="details-list-col">${reportsHtml}</ul>
        </div>
        <div class="card-actions">
            <button class="app-button">Request Observations</button>
        </div>
    `;
}

// --- Map & Spatial Layer Management ---
async function addNdviSpatialLayer(farm) {
    try {
        // RE-CORRECTED: Added subfolder path back to fetch call
        const response = await fetch(`spatial/${farm.id}_spatial.json`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const geojson = await response.json();

        if (ndviOverlayLayer) map.removeLayer(ndviOverlayLayer);

        ndviOverlayLayer = L.geoJSON(geojson, {
            style: feature => ({
                fillColor: getNdviColor(feature.properties.value),
                weight: 1,
                opacity: 0.5,
                color: 'white',
                fillOpacity: 0.7
            })
        }).addTo(map);
        
        if (!ndviLegend) {
            ndviLegend = L.control({ position: 'bottomright' });
            ndviLegend.onAdd = () => {
                const div = L.DomUtil.create('div', 'info legend');
                const grades = [0.4, 0.5, 0.6, 0.7, 0.8];
                div.innerHTML = '<h4>NDVI Vigor</h4>';
                for (let i = 0; i < grades.length; i++) {
                    div.innerHTML += `<i style="background:${getNdviColor(grades[i] + 0.01)}"></i> ${grades[i] + (grades[i + 1] ? '&ndash;' + grades[i + 1] + '<br>' : '+')}`;
                }
                return div;
            };
        }
        ndviLegend.addTo(map);

    } catch (error) {
        console.error("Error adding NDVI spatial layer:", error);
        alert(`Could not load spatial data. Make sure 'spatial/${farm.id}_spatial.json' exists.`);
    }
}

function removeNdviSpatialLayer() {
    if (ndviOverlayLayer) map.removeLayer(ndviOverlayLayer);
    if (ndviLegend && map.hasControl(ndviLegend)) map.removeControl(ndviLegend);
}

// --- Utility Functions ---
function parseCsv(csvText) {
    const lines = csvText.trim().split('\n').filter(line => line);
    const headers = lines.shift().split(',').map(h => h.trim());
    const labels = [];
    const datasets = {};
    headers.slice(1).forEach(header => { datasets[header] = []; });
    lines.forEach(line => {
        const values = line.split(',');
        labels.push(values[0].trim());
        headers.slice(1).forEach((header, index) => {
            datasets[header].push(parseFloat(values[index + 1]));
        });
    });
    return { labels, datasets };
}

function createChart(canvasId, type, labels, datasets) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const existingChart = Chart.getChart(canvasId);
    if (existingChart) {
        existingChart.destroy();
    }
    return new Chart(ctx, {
        type: type,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 15 } } },
            scales: { y: { beginAtZero: false, grid: { drawBorder: false } }, x: { grid: { display: false } } },
            interaction: { intersect: false, mode: 'index' },
        }
    });
}

function getNdviColor(d) {
    return d > 0.8 ? '#1a9850' : d > 0.7 ? '#66bd63' : d > 0.6 ? '#a6d96a' : d > 0.5 ? '#fdae61' : d > 0.4 ? '#f46d43' : '#d73027';
}

function getMockExtraData(farmId) {
    const commonData = {
        tasks: [
            { name: "Fertilize Zone A", operator: "Agus", cost: "Rp 1.500.000" },
            { name: "Scout for pests in Block C", operator: "Budi", cost: "Rp 250.000" },
        ],
        alerts: [
            { type: "irrigation", message: "High water stress detected in Zone D." },
            { type: "weather", message: "Heavy rain forecast for tomorrow." },
        ],
        scouting: [
            { date: "2024-10-24", report: "Minor pest activity in block 5." },
            { date: "2024-10-22", report: "Weed growth observed near canal." },
        ]
    };
    const farmSpecificData = {
        farm001: {
            irrigation: { irrigationNeeds: "2,500 m³", recommendedAction: "Irrigate Zone B and C for 45 minutes.", solarPanelStatus: "Optimal (4.5 kWh)", batteryLevel: "92%", pumpStatus: "Standby", waterFlow: "0 L/min" },
            yield: { cropType: "Rice", quality: { grainFillingRate: "85%", millingRendement: "68%" }, quantity: { tillers: "25/hill", yield: "6.8 Ton/Ha" } },
        },
        farm002: {
            irrigation: { irrigationNeeds: "800 m³", recommendedAction: "Monitor soil moisture. Irrigate if below 25%.", solarPanelStatus: "Optimal (4.8 kWh)", batteryLevel: "95%", pumpStatus: "Standby", waterFlow: "0 L/min" },
            yield: { cropType: "Rice", quality: { grainFillingRate: "82%", millingRendement: "65%" }, quantity: { tillers: "22/hill", yield: "5.9 Ton/Ha" } },
        }
    };
    return { ...commonData, ...farmSpecificData[farmId] };
}
