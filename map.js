// This file manages everything related to the Leaflet map.

// Map-specific global variables
let map;
let ndviOverlayLayer = null;
let ndviLegend = null;
let mapLayers = {}; // To store Leaflet layers by farm ID

/**
 * Initializes the Leaflet map.
 */
function initMap() {
    map = L.map('map').setView([0.8, 101.85], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

/**
 * Adds the spatial NDVI vigor data as a colored layer on the map.
 * @param {object} farm - The farm object, containing its ID.
 */
async function addNdviSpatialLayer(farm) {
    try {
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

/**
 * Removes the NDVI spatial layer and its legend from the map.
 */
function removeNdviSpatialLayer() {
    if (ndviOverlayLayer && map.hasLayer(ndviOverlayLayer)) map.removeLayer(ndviOverlayLayer);
    if (ndviLegend && map.hasControl(ndviLegend)) map.removeControl(ndviLegend);
    ndviOverlayLayer = null; // Clear the reference
}

/**
 * Helper function to determine the color for an NDVI value.
 * @param {number} d - The NDVI value.
 */
function getNdviColor(d) {
    return d > 0.8 ? '#1a9850' : d > 0.7 ? '#66bd63' : d > 0.6 ? '#a6d96a' : d > 0.5 ? '#fdae61' : d > 0.4 ? '#f46d43' : '#d73027';
}