/**
 * GeoClixMap — Main Interactive Map Controller
 * Manages the primary Leaflet overview map, Deforestation alert markers,
 * click-to-coordinate interactions, and transitions to detailed analysis.
 *
 * @module GeoClixMap
 */
var GeoClixMap = (function () {
    'use strict';

    var map = null;
    var currentTileLayer = null;
    var alertsLayerGroup = null;
    var ndviLayerGroup = null;

    // Sample high-priority forest loss alert locations in India
    var FOREST_ALERTS = [
        { lat: 29.5937, lng: 78.9629, name: 'Corbett Landscape Buffer', state: 'Uttarakhand', area: '3.4 km²', loss: 'Severe', date: '2024-10-21' },
        { lat: 22.8021, lng: 80.6015, name: 'Kanha Outer Corridor', state: 'Madhya Pradesh', area: '5.1 km²', loss: 'Moderate', date: '2024-09-15' },
        { lat: 23.9510, lng: 85.3400, name: 'Hazaribagh Mining Rim', state: 'Jharkhand', area: '7.8 km²', loss: 'Critical (Mining)', date: '2024-10-02' },
        { lat: 18.7210, lng: 81.2405, name: 'Bailadila Range Foothills', state: 'Chhattisgarh', area: '4.2 km²', loss: 'Severe', date: '2024-08-28' },
        { lat: 11.9138, lng: 76.1283, name: 'Nagarhole North Periphery', state: 'Karnataka', area: '2.3 km²', loss: 'Moderate', date: '2024-07-19' },
        { lat: 26.6500, lng: 93.3500, name: 'Golaghat Tea-Forest Border', state: 'Assam', area: '6.0 km²', loss: 'Severe', date: '2024-09-30' },
        { lat: 21.6210, lng: 86.3200, name: 'Similipal Buffer Zone', state: 'Odisha', area: '3.9 km²', loss: 'Moderate', date: '2024-10-11' },
        { lat: 15.4200, lng: 74.2800, name: 'Bhagwan Mahaveer Fringe', state: 'Goa', area: '1.8 km²', loss: 'Moderate', date: '2024-06-14' }
    ];

    /**
     * Initializes the main map.
     */
    function init() {
        var mapContainer = document.getElementById('main-map');
        if (!mapContainer || map) return;

        // Create Leaflet map centered over India
        map = L.map('main-map', {
            center: GEOCLIX_CONFIG.DEFAULT_CENTER || [22.5, 82.5],
            zoom: GEOCLIX_CONFIG.DEFAULT_ZOOM || 5,
            minZoom: GEOCLIX_CONFIG.MIN_ZOOM || 4,
            maxZoom: GEOCLIX_CONFIG.MAX_ZOOM || 18,
            zoomControl: true
        });

        // Add default satellite layer
        currentTileLayer = GeoClixSatellite.createTileLayer('satellite');
        currentTileLayer.addTo(map);

        // Alert Layer Group
        alertsLayerGroup = L.layerGroup().addTo(map);

        // NDVI Layer Group (Hidden by default)
        ndviLayerGroup = L.layerGroup();

        // Populate Alert Markers
        populateAlertMarkers();

        // Setup Event Listeners
        setupMapEvents();
        setupLayerControls();

        // Initialize overview sidebar with default center
        var center = map.getCenter();
        handleLocationSelect(center.lat, center.lng, false);

        // Check if fires should be initialized
        var firesToggle = document.getElementById('toggle-fires');
        if (firesToggle && firesToggle.checked && window.GeoClixFires) {
            window.GeoClixFires.init(map);
        }
    }

    /**
     * Populates deforestation alert markers.
     */
    function populateAlertMarkers() {
        if (!alertsLayerGroup) return;
        alertsLayerGroup.clearLayers();

        FOREST_ALERTS.forEach(function (alert) {
            // Custom pulsing HTML marker
            var icon = L.divIcon({
                className: 'alert-leaflet-icon',
                html: '<div style="width:20px;height:20px;background:rgba(239,68,68,0.85);border:2px solid #fff;border-radius:50%;box-shadow:0 0 16px rgba(239,68,68,0.9);animation:markerPulse 1.8s infinite;"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            var marker = L.marker([alert.lat, alert.lng], { icon: icon });

            var popupContent = [
                '<div style="font-family:var(--font-heading);min-width:180px;">',
                '  <div style="color:#ef4444;font-weight:700;font-size:0.85rem;margin-bottom:4px;">⚠️ FOREST LOSS ALERT</div>',
                '  <div style="font-size:0.95rem;font-weight:700;color:#fff;">' + alert.name + '</div>',
                '  <div style="color:#4ade80;font-size:0.8rem;margin-bottom:8px;">' + alert.state + '</div>',
                '  <div style="font-size:0.8rem;color:#cbd5e1;">Area: <b>' + alert.area + '</b></div>',
                '  <div style="font-size:0.8rem;color:#cbd5e1;">Severity: <b>' + alert.loss + '</b></div>',
                '  <div style="font-size:0.8rem;color:#94a3b8;margin-bottom:10px;">Date: ' + alert.date + '</div>',
                '  <button onclick="window.GeoClixApp.openAnalysis(' + alert.lat + ',' + alert.lng + ')" ',
                '    style="width:100%;padding:6px;background:#4ade80;color:#052e16;font-weight:700;border:none;border-radius:6px;cursor:pointer;">',
                '    Analyze Changes →',
                '  </button>',
                '</div>'
            ].join('');

            marker.bindPopup(popupContent);
            alertsLayerGroup.addLayer(marker);
        });
    }

    /**
     * Map events: mousemove (live coords) and click.
     */
    function setupMapEvents() {
        if (!map) return;

        var infoText = document.getElementById('map-info-text');

        map.on('mousemove', function (e) {
            if (infoText && window.GeoClixCoordinates) {
                var latStr = GeoClixCoordinates.formatCoord(e.latlng.lat, 'lat');
                var lngStr = GeoClixCoordinates.formatCoord(e.latlng.lng, 'lng');
                infoText.textContent = latStr + '  •  ' + lngStr + '  (Click anywhere to analyze)';
            }
        });

        map.on('click', function (e) {
            handleLocationSelect(e.latlng.lat, e.latlng.lng, true);
        });
    }

    /**
     * Handles selection of a location.
     * @param {number} lat
     * @param {number} lng
     * @param {boolean} promptAnalysis
     */
    function handleLocationSelect(lat, lng, promptAnalysis) {
        if (window.GeoClixCoordinates) {
            GeoClixCoordinates.updateCoordinateDisplays(lat, lng);
        }

        if (window.GeoClixWeather) {
            GeoClixWeather.updateOverviewWeather(lat, lng);
        }

        if (window.GeoClixCharts) {
            GeoClixCharts.updateForestBars(lat, lng);
        }

        if (promptAnalysis && window.GeoClixApp) {
            window.GeoClixApp.showToast(
                'Coordinates selected! Double-click or click "Explore" to view 10-year satellite comparison.',
                '📍',
                4000
            );

            // Clicking opens the analysis screen directly as requested in spec:
            // "Selecting a specific region or point of interest transitions the view to the detailed analytical interface"
            setTimeout(function () {
                window.GeoClixApp.openAnalysis(lat, lng);
            }, 600);
        }
    }

    /**
     * Sets up map controls: layer buttons & overlay checkboxes.
     */
    function setupLayerControls() {
        // Layer switcher buttons
        var layerBtns = document.querySelectorAll('.layer-btn');
        layerBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                layerBtns.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');

                var layerType = btn.getAttribute('data-layer');
                currentTileLayer = GeoClixSatellite.switchLayer(map, currentTileLayer, layerType);
            });
        });

        // Overlay Toggles
        var toggleFires = document.getElementById('toggle-fires');
        if (toggleFires) {
            toggleFires.addEventListener('change', function () {
                if (window.GeoClixFires) {
                    GeoClixFires.toggleFires(map, toggleFires.checked);
                }
            });
        }

        var toggleAlerts = document.getElementById('toggle-alerts');
        if (toggleAlerts) {
            toggleAlerts.checked = true;
            toggleAlerts.addEventListener('change', function () {
                if (toggleAlerts.checked) {
                    map.addLayer(alertsLayerGroup);
                } else {
                    map.removeLayer(alertsLayerGroup);
                }
            });
        }

        var toggleNdvi = document.getElementById('toggle-ndvi');
        if (toggleNdvi) {
            toggleNdvi.addEventListener('change', function () {
                if (toggleNdvi.checked) {
                    // Create simulated NDVI color overlay for forested regions
                    if (!map.hasLayer(ndviLayerGroup)) {
                        ndviLayerGroup.clearLayers();
                        var ndviPolygon = L.polygon([
                            [30.0, 78.0], [31.0, 79.5], [29.0, 80.0], [28.5, 78.5]
                        ], {
                            color: '#22c55e',
                            fillColor: '#4ade80',
                            fillOpacity: 0.35,
                            weight: 1
                        }).bindPopup('🌿 High NDVI Vegetation Index (0.78)');
                        ndviLayerGroup.addLayer(ndviPolygon);
                        map.addLayer(ndviLayerGroup);
                    }
                } else {
                    map.removeLayer(ndviLayerGroup);
                }
            });
        }
    }

    return {
        init: init,
        getMap: function () { return map; },
        handleLocationSelect: handleLocationSelect
    };
})();

window.GeoClixMap = GeoClixMap;
