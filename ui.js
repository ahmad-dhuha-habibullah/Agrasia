// This file handles all updates to the DOM (the user interface).

// Chart.js instances
let indicesChart = null;
let soilMoistureChart = null;

/**
 * Populates the sidebar list with farms and adds their boundaries to the map.
 * @param {Array<object>} farms - The array of farm objects.
 * @param {function} selectionHandler - The function to call when a farm is clicked.
 */
function populateFarms(farms, selectionHandler) {
    const farmListElement = document.getElementById('farm-list');
    farmListElement.innerHTML = '';

    farms.forEach(farm => {
        const geojsonLayer = L.geoJSON(farm.geojson, {
            style: { color: "#3B82F6", weight: 2, opacity: 0.8, fillColor: "#BFDBFE", fillOpacity: 0.5 }
        }).bindPopup(`<b>${farm.name}</b>`).on('click', () => {
            selectionHandler(farm.id);
        });

        mapLayers[farm.id] = geojsonLayer;
        geojsonLayer.addTo(map);

        const listItem = document.createElement('li');
        listItem.className = 'farm-list-item';
        listItem.textContent = farm.name;
        listItem.dataset.farmId = farm.id;
        listItem.addEventListener('click', () => selectionHandler(farm.id));
        farmListElement.appendChild(listItem);
    });

    if (Object.keys(mapLayers).length > 0) {
        const group = new L.featureGroup(Object.values(mapLayers));
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * Main function to update all dashboard cards with new data.
 * @param {object} data - The consolidated data object for the selected farm.
 */
function updateDashboardUI(data) {
    document.getElementById('dashboard-content').classList.remove('hidden');
    updateWeatherCard(data.weatherForecast, data.lastUpdate);
    updateIndicesCard(data.currentNdvi, data.currentNdmi, data.currentEvi, data.indicesData);
    updateSoilWaterCard(data.waterStressStatus, data.soilPh, data.last24hRain, data.soilData);
    updateIrrigationCard(data.irrigation);
    updateYieldCard(data.yield);
    updateTasksCard(data.tasks);
    updateAlertsCard(data.alerts);
    updateScoutingCard(data.scouting);
}

// --- Specific Card Update Functions ---

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
    const card = document.getElementById('irrigation-card'); // Correctly select the container
    card.innerHTML = `
        <h4 class="card-title">
            <i class="fas fa-tint icon-header"></i>
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
            <button class="app-button primary">Control Irrigation</button>
        </div>
    `;
}

function updateYieldCard(data) {
    const card = document.getElementById('yield-card'); // Correctly select the container
    card.innerHTML = `
        <h4 class="card-title">
            <i class="fas fa-chart-pie icon-header"></i>
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
    const container = document.getElementById('task-list'); // Correctly select the UL
    let tasksHtml = '<li class="text-center text-gray-500 py-4">No pending tasks.</li>';
    if (data && data.length > 0) {
        tasksHtml = data.map(task => `
            <li class="task-item">
                <strong class="task-name">${task.name}</strong>
                <span class="task-details">Operator: ${task.operator} | Cost: ${task.cost}</span>
            </li>
        `).join('');
    }
    container.innerHTML = tasksHtml;
}

function updateAlertsCard(data) {
    const container = document.getElementById('alerts-list'); // Correctly select the UL
     let alertsHtml = '<li class="text-center text-gray-500 py-4">No active alerts.</li>';
    if(data && data.length > 0){
        alertsHtml = data.map(alert => {
            const typeClass = `alert-${alert.type}`;
            return `<li class="alert-item ${typeClass}"><i class="fas fa-exclamation-circle mr-2"></i>${alert.message}</li>`
        }).join('');
    }
    container.innerHTML = alertsHtml;
}

function updateScoutingCard(data) {
    const container = document.getElementById('scouting-notes'); // Correctly select the UL
    let reportsHtml = '<li class="text-center text-gray-500 py-4">No recent reports.</li>';
    if(data && data.length > 0){
        reportsHtml = data.map(report => `<li class="scouting-report"><strong>${report.date}:</strong> ${report.report}</li>`).join('');
    }
     container.innerHTML = reportsHtml;
}


/**
 * Utility function to create or update a Chart.js chart instance.
 */
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