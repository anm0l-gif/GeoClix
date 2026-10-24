/**
 * GeoClix Dashboard Module
 * Handles dynamic regional switching, scatter marker overlays (loss, fires, canopy),
 * live cloud/pollution overlays with canvas fallback, and Chart.js forest trajectory.
 */
(function () {
    'use strict';

    // Regional dataset for India's major forested zones
    var REGION_DATA = {
        'madhya-pradesh': {
            name: 'Madhya Pradesh (Central India)',
            lat: 22.9734,
            lng: 78.6569,
            zoom: 8,
            coverPct: 72.4,
            forestHa: '7,746,200 ha',
            nonforestHa: '2,953,800 ha',
            changePct: '-12.4%',
            lostHa: '3,245 ha',
            gainedHa: '612 ha',
            status: 'Vulnerable',
            aqi: '42 (Good)',
            fires: 18,
            temp: '28.4 °C',
            trend: [78, 77.5, 77, 76.2, 75.8, 75, 74.3, 73.8, 73.1, 72.8, 72.4]
        },
        'western-ghats': {
            name: 'Western Ghats (Biodiversity Hotspot)',
            lat: 13.5000,
            lng: 75.5000,
            zoom: 8,
            coverPct: 84.1,
            forestHa: '9,120,000 ha',
            nonforestHa: '1,720,000 ha',
            changePct: '-4.8%',
            lostHa: '1,120 ha',
            gainedHa: '840 ha',
            status: 'Protected',
            aqi: '28 (Good)',
            fires: 4,
            temp: '24.2 °C',
            trend: [86, 85.8, 85.5, 85.2, 85.0, 84.8, 84.6, 84.4, 84.3, 84.2, 84.1]
        },
        'assam': {
            name: 'Assam & Karbi Anglong',
            lat: 26.2006,
            lng: 92.9376,
            zoom: 8,
            coverPct: 68.2,
            forestHa: '2,831,200 ha',
            nonforestHa: '1,320,000 ha',
            changePct: '-15.2%',
            lostHa: '4,890 ha',
            gainedHa: '310 ha',
            status: 'High Alert',
            aqi: '55 (Moderate)',
            fires: 31,
            temp: '26.8 °C',
            trend: [76, 75.2, 74.0, 73.1, 72.0, 71.2, 70.4, 69.8, 69.1, 68.6, 68.2]
        },
        'odisha': {
            name: 'Similipal Forest, Odisha',
            lat: 21.8000,
            lng: 86.3000,
            zoom: 9,
            coverPct: 64.7,
            forestHa: '3,210,000 ha',
            nonforestHa: '1,750,000 ha',
            changePct: '-9.3%',
            lostHa: '2,410 ha',
            gainedHa: '540 ha',
            status: 'Alert',
            aqi: '68 (Moderate)',
            fires: 22,
            temp: '30.1 °C',
            trend: [71, 70.5, 69.8, 68.9, 68.0, 67.2, 66.5, 65.8, 65.2, 64.9, 64.7]
        },
        'uttarakhand': {
            name: 'Jim Corbett, Uttarakhand',
            lat: 29.5300,
            lng: 78.7747,
            zoom: 10,
            coverPct: 81.3,
            forestHa: '1,288,000 ha',
            nonforestHa: '296,000 ha',
            changePct: '-6.1%',
            lostHa: '780 ha',
            gainedHa: '420 ha',
            status: 'Monitoring',
            aqi: '35 (Good)',
            fires: 8,
            temp: '21.5 °C',
            trend: [84, 83.8, 83.5, 83.1, 82.8, 82.4, 82.0, 81.8, 81.6, 81.4, 81.3]
        },
        'sundarbans': {
            name: 'Sundarbans Mangroves',
            lat: 21.9497,
            lng: 89.1833,
            zoom: 9,
            coverPct: 77.8,
            forestHa: '426,000 ha',
            nonforestHa: '122,000 ha',
            changePct: '-8.5%',
            lostHa: '1,640 ha',
            gainedHa: '790 ha',
            status: 'Sensitive',
            aqi: '48 (Good)',
            fires: 1,
            temp: '29.0 °C',
            trend: [82, 81.6, 81.2, 80.5, 80.0, 79.4, 78.9, 78.5, 78.2, 78.0, 77.8]
        }
    };

    var map = null;
    var markerLayerGroup = null;
    var forestCoverLayer = null;
    var trendChart = null;

    // Overlay layers
    var cloudOverlayLayer = null;
    var pollutionOverlayLayer = null;
    var cloudCanvasEl = null;
    var pollutionCanvasEl = null;
    var workspaceNotice = null;
    var activeWorkspaceView = 'dashboard';

    /**
     * Initializes the dashboard
     */
    function init() {
        initMap();
        initChart();
        setupEventListeners();
        loadRegion('madhya-pradesh');
    }

    /**
     * Initialize Leaflet map with satellite base tiles
     */
    function initMap() {
        map = L.map('dash-map', {
            center: [22.9734, 78.6569],
            zoom: 8,
            zoomControl: true
        });

        var satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 18,
            attribution: '© Esri, Maxar, Earthstar Geographics'
        });

        var streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        });

        satelliteLayer.addTo(map);

        L.control.layers({
            '🛰️ Satellite': satelliteLayer,
            '🗺️ Street Map': streetLayer
        }, null, { position: 'topleft' }).addTo(map);

        markerLayerGroup = L.layerGroup().addTo(map);
        forestCoverLayer = L.layerGroup();
        workspaceNotice = L.control({ position: 'topright' });
        workspaceNotice.onAdd = function () {
            var el = L.DomUtil.create('div', 'workspace-map-notice');
            el.setAttribute('aria-live', 'polite');
            return el;
        };
        workspaceNotice.addTo(map);

        // Ensure Leaflet recalculates dimensions inside flexbox container
        setTimeout(function () { if (map) map.invalidateSize(); }, 100);
        setTimeout(function () { if (map) map.invalidateSize(); }, 400);
        window.addEventListener('resize', function () { if (map) map.invalidateSize(); });
    }

    /**
     * Renders scatter markers based on active region coordinates
     */
    function renderScatterMarkers(lat, lng) {
        if (!markerLayerGroup) return;
        markerLayerGroup.clearLayers();

        var showFires = document.getElementById('dash-fire-toggle').checked;
        var showLoss = document.getElementById('dash-loss-toggle').checked;

        // Generate scatter points around the central coordinates
        var points = [
            // Dense canopy points (green)
            { dlat: 0.12, dlng: -0.15, type: 'forest', title: 'Dense Shorea Robusta Canopy' },
            { dlat: -0.08, dlng: 0.22, type: 'forest', title: 'Evergreen Canopy Block' },
            { dlat: 0.25, dlng: 0.05, type: 'forest', title: 'Old Growth Forest Reserve' },
            { dlat: -0.19, dlng: -0.12, type: 'forest', title: 'Riparian Buffer Zone' },
            // Regrowth points (blue)
            { dlat: 0.18, dlng: 0.30, type: 'regrowth', title: 'Afforestation Plot (2021 Plantation)' },
            { dlat: -0.22, dlng: 0.15, type: 'regrowth', title: 'Natural Regeneration Corridor' }
        ];

        if (showLoss) {
            points.push(
                { dlat: -0.04, dlng: -0.05, type: 'loss', title: 'Canopy Loss: Illegal Felling (2.4 ha)' },
                { dlat: 0.07, dlng: 0.18, type: 'loss', title: 'Canopy Disturbance: Road Expansion (4.1 ha)' },
                { dlat: -0.15, dlng: 0.02, type: 'loss', title: 'Vegetation Loss Detected (Sentinel-2)' }
            );
        }

        if (showFires) {
            points.push(
                { dlat: 0.02, dlng: -0.22, type: 'fire', title: 'Thermal Anomaly / Active Fire (VIIRS 375m)' },
                { dlat: -0.11, dlng: -0.28, type: 'fire', title: 'High Confidence Fire Hotspot' }
            );
        }

        points.forEach(function (pt) {
            var ptLat = lat + pt.dlat;
            var ptLng = lng + pt.dlng;
            var color = '#22c55e';
            if (pt.type === 'loss') color = '#ef4444';
            if (pt.type === 'fire') color = '#f59e0b';
            if (pt.type === 'regrowth') color = '#38bdf8';

            var markerHtml = '<div class="custom-scatter-marker" style="width: 14px; height: 14px; background: ' + color + '; box-shadow: 0 0 10px ' + color + '; border: 2px solid #fff;"></div>';

            var customIcon = L.divIcon({
                className: '',
                html: markerHtml,
                iconSize: [14, 14],
                iconAnchor: [7, 7]
            });

            var m = L.marker([ptLat, ptLng], { icon: customIcon });
            m._geoclixType = pt.type;
            var popupContent = [
                '<div style="min-width: 200px; font-family: sans-serif;">',
                '  <b style="font-size: 0.95rem; color: #166534;">' + pt.title + '</b><br>',
                '  <span style="font-size: 0.8rem; color: #64748b;">Lat: ' + ptLat.toFixed(4) + '° | Lng: ' + ptLng.toFixed(4) + '°</span><br>',
                '  <button class="popup-inspect-btn" style="margin-top: 10px; width: 100%; padding: 7px 12px; background: #22c55e; border: none; border-radius: 6px; color: #fff; font-weight: 600; font-size: 0.85rem; cursor: pointer;">🔍 Detailed Analysis & Timelapse</button>',
                '</div>'
            ].join('');

            m.bindPopup(popupContent);
            m.on('popupopen', function () {
                var popupEl = m.getPopup().getElement();
                if (popupEl) {
                    var btn = popupEl.querySelector('.popup-inspect-btn');
                    if (btn) {
                        btn.onclick = function () {
                            openDetailedAnalysis(ptLat, ptLng, pt.title);
                        };
                    }
                }
            });

            markerLayerGroup.addLayer(m);
        });
    }

    function renderForestCover(reg) {
        if (!forestCoverLayer || !map) return;
        forestCoverLayer.clearLayers();
        var radius = Math.max(30000, Math.round((reg.coverPct || 50) * 1100));
        L.circle([reg.lat, reg.lng], {
            radius: radius,
            color: '#22c55e',
            weight: 2,
            fillColor: '#22c55e',
            fillOpacity: 0.34,
            dashArray: '6 5'
        }).bindPopup('<b>Forest-cover extent</b><br>Whole selected region highlighted (' + reg.coverPct + '% canopy estimate).<br><small>Prototype boundary — not a verified forest polygon.</small>').addTo(forestCoverLayer);
        forestCoverLayer.addTo(map);
    }

    function clearForestCover() {
        if (forestCoverLayer && map) map.removeLayer(forestCoverLayer);
    }

    function renderIndiaHotspots() {
        if (!markerLayerGroup) return;
        markerLayerGroup.clearLayers();
        var hotspots = [
            { lat: 29.59, lng: 78.96, label: 'Forest loss — Uttarakhand' },
            { lat: 22.80, lng: 80.60, label: 'Forest loss — Madhya Pradesh' },
            { lat: 23.95, lng: 85.34, label: 'Forest loss — Jharkhand' },
            { lat: 18.72, lng: 81.24, label: 'Forest loss — Chhattisgarh' },
            { lat: 11.91, lng: 76.13, label: 'Forest fire / loss hotspot — Karnataka' },
            { lat: 26.65, lng: 93.35, label: 'Forest fire / loss hotspot — Assam' },
            { lat: 21.62, lng: 86.32, label: 'Forest loss — Odisha' },
            { lat: 15.42, lng: 74.28, label: 'Forest fire hotspot — Goa' }
        ];
        hotspots.forEach(function (spot) {
            var icon = L.divIcon({
                className: '',
                html: '<div class="india-hotspot-marker"></div>',
                iconSize: [18, 18], iconAnchor: [9, 9]
            });
            L.marker([spot.lat, spot.lng], { icon: icon })
                .bindPopup('<b style="color:#dc2626">● Hotspot</b><br>' + spot.label)
                .addTo(markerLayerGroup);
        });
    }

    /**
     * Dynamic Region Data Switcher
     */
    function loadRegion(regionKey) {
        var data = REGION_DATA[regionKey];
        if (!data) return;

        // Center map
        if (map) {
            map.flyTo([data.lat, data.lng], data.zoom, { duration: 1.2 });
        }

        // Update Coordinates
        document.getElementById('dash-coord-lat').textContent = data.lat.toFixed(4) + '° N';
        document.getElementById('dash-coord-lng').textContent = data.lng.toFixed(4) + '° E';

        // Update Stats Card 1 (Forest Cover)
        document.getElementById('stat-cover-pct').textContent = data.coverPct + '%';
        document.getElementById('stat-forest-ha').textContent = data.forestHa;
        document.getElementById('stat-nonforest-ha').textContent = data.nonforestHa;
        document.getElementById('stat-prog-forest').style.width = data.coverPct + '%';
        document.getElementById('stat-prog-nonforest').style.width = (100 - data.coverPct) + '%';

        // Update Stats Card 2 (Change)
        document.getElementById('stat-change-val').textContent = data.changePct;
        document.getElementById('stat-lost-ha').textContent = data.lostHa;
        document.getElementById('stat-gained-ha').textContent = data.gainedHa;

        // Context Card
        document.getElementById('stat-aqi-val').textContent = data.aqi;
        document.getElementById('stat-fire-count').textContent = data.fires + ' Hotspots';
        document.getElementById('stat-temp-val').textContent = data.temp;

        // Render Scatter Markers
        renderScatterMarkers(data.lat, data.lng);

        // Update Chart
        updateChart(data.trend);

        if (activeWorkspaceView === 'forest-cover') renderForestCover(data);
    }

    /**
     * Initialize Trend Chart (Chart.js)
     */
    function initChart() {
        var canvas = document.getElementById('dash-trend-chart');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var years = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Forest Canopy %',
                    data: [78, 77.5, 77, 76.2, 75.8, 75, 74.3, 73.8, 73.1, 72.8, 72.4],
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74, 222, 128, 0.1)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.parsed.y + '% Canopy Cover';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    }
                }
            }
        });
    }

    function updateChart(newData) {
        if (!trendChart) return;
        trendChart.data.datasets[0].data = newData;
        trendChart.update();
    }

    /**
     * Canvas demo fallback overlay creator
     */
    function createDemoCanvas(containerId, color, opacity) {
        var container = document.getElementById(containerId);
        if (!container) return null;

        var canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '400';
        canvas.style.opacity = opacity;
        canvas.width = container.offsetWidth || 800;
        canvas.height = container.offsetHeight || 600;

        var ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add cloud / pollution organic texture
        for (var i = 0; i < 40; i++) {
            var x = Math.random() * canvas.width;
            var y = Math.random() * canvas.height;
            var r = 40 + Math.random() * 90;
            var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, color.replace(')', ', 0.65)').replace('rgb', 'rgba'));
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        container.appendChild(canvas);
        return canvas;
    }

    var forestTrendChartInstance = null;

    /**
     * Opens Detailed Split-View Comparison, AI Enhance & Timelapse
     */
    async function openDetailedAnalysis(lat, lng, title) {
        var analysisView = document.getElementById('analysis-view');
        if (!analysisView) return;

        analysisView.classList.remove('hidden');

        // Location Info
        var regName = document.getElementById('an-region-name');
        var regState = document.getElementById('an-region-state');
        var regArea = document.getElementById('an-region-area');

        if (regName) regName.textContent = title || 'Locating Area...';
        if (regArea) regArea.textContent = 'Coordinates: ' + lat.toFixed(4) + '°, ' + lng.toFixed(4) + '°';

        if (window.GeoClixCoordinates) {
            var info = await GeoClixCoordinates.reverseGeocode(lat, lng);
            if (regState) regState.textContent = info.state + ', ' + info.country;
            GeoClixCoordinates.updateCoordinateDisplays(lat, lng);
        }

        // Weather & AQI
        if (window.GeoClixWeather) {
            GeoClixWeather.updateAnalysisWeather(lat, lng);
        }

        // Forest Trend Chart
        if (window.GeoClixCharts) {
            if (forestTrendChartInstance) {
                GeoClixCharts.destroyChart(forestTrendChartInstance);
            }
            forestTrendChartInstance = GeoClixCharts.initForestTrendChart(lat, lng);
        }

        // Split-View Satellite Maps
        if (window.GeoClixAnalysis) {
            GeoClixAnalysis.init(lat, lng);

            var maps = GeoClixAnalysis.getAnalysisMaps();
            if (maps && maps.nowMap) {
                if (window.GeoClixTimelapse) {
                    GeoClixTimelapse.init(maps.nowMap, lat, lng);
                }
                if (window.GeoClixEnhance) {
                    GeoClixEnhance.init(maps.nowMap);
                }
            }
        }
    }

    function closeDetailedAnalysis() {
        var analysisView = document.getElementById('analysis-view');
        if (!analysisView) return;

        analysisView.classList.add('hidden');

        if (window.GeoClixAnalysis) {
            GeoClixAnalysis.destroy();
        }
        if (window.GeoClixTimelapse) {
            GeoClixTimelapse.destroy();
        }
        if (window.GeoClixEnhance) {
            GeoClixEnhance.destroy();
        }
        if (forestTrendChartInstance && window.GeoClixCharts) {
            GeoClixCharts.destroyChart(forestTrendChartInstance);
            forestTrendChartInstance = null;
        }
    }

    /**
     * Switch view between Workspace tabs:
     * - 'dashboard': standard overview map + stats
     * - 'forest-cover': focus on canopy classification layer + dense polygons
     * - 'satellite-map': switches to ultra-high resolution Sentinel-2 optical feed
     * - 'analytics': zooms into regional decadal trajectory & loss projections
     * - 'reports': highlights high-confidence deforestation alerts & incidents
     */
    function handleWorkspaceView(view) {
        if (!map) return;
        activeWorkspaceView = view;
        setTimeout(function () { if (map) map.invalidateSize(); }, 60);
        var regionSelect = document.getElementById('region-select');
        var reg = REGION_DATA[regionSelect ? regionSelect.value : 'madhya-pradesh'];

        if (view === 'dashboard') {
            clearForestCover();
            loadRegion(regionSelect ? regionSelect.value : 'madhya-pradesh');
            setWorkspaceNotice('Dashboard overview');
        } else if (view === 'forest-cover') {
            // Highlight the complete selected forest region, not only samples.
            map.flyTo([reg.lat, reg.lng], reg.zoom + 1, { duration: 1.0 });
            document.getElementById('dash-loss-toggle').checked = false;
            document.getElementById('dash-fire-toggle').checked = false;
            renderScatterMarkers(reg.lat, reg.lng);
            renderForestCover(reg);
            setWorkspaceNotice('Forest cover: selected region extent highlighted');
        } else if (view === 'satellite-map') {
            clearForestCover();
            // Reset to India and show nationwide fire/loss hotspots.
            map.flyTo([22.5, 82.5], 5, { duration: 1.0 });
            document.getElementById('dash-loss-toggle').checked = true;
            document.getElementById('dash-fire-toggle').checked = true;
            renderIndiaHotspots();
            setWorkspaceNotice('India satellite map: red forest fire and loss hotspots');
        } else if (view === 'analytics') {
            // Scroll right stats panel to trend chart
            var statsPanel = document.querySelector('.dash-stats-panel');
            var chartCard = document.getElementById('dash-trend-chart');
            if (statsPanel && chartCard) {
                statsPanel.scrollTo({ top: chartCard.offsetTop - 80, behavior: 'smooth' });
            }
            setWorkspaceNotice('Analytics: 10-year canopy trajectory');
        } else if (view === 'reports') {
            // Filter strictly to loss alerts & thermal fire hotspots
            document.getElementById('dash-loss-toggle').checked = true;
            document.getElementById('dash-fire-toggle').checked = true;
            renderScatterMarkers(reg.lat, reg.lng);
            // Open first loss marker popup
            if (markerLayerGroup) {
                var layers = markerLayerGroup.getLayers();
                var alertMarker = layers.find(function (layer) { return layer._geoclixType === 'loss'; });
                if (alertMarker) {
                    alertMarker.openPopup();
                }
            }
            setWorkspaceNotice('Alert reports: canopy-loss incidents');
        }
    }

    function setWorkspaceNotice(message) {
        if (!workspaceNotice || !workspaceNotice.getContainer) return;
        var el = workspaceNotice.getContainer();
        if (el) el.textContent = message;
    }

    /**
     * Event Listeners setup
     */
    function setupEventListeners() {
        // Analysis close buttons
        var closeBtn = document.getElementById('analysis-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeDetailedAnalysis);
        }
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeDetailedAnalysis();
        });

        // Date range compare button in analysis
        var compareBtn = document.getElementById('compare-btn');
        if (compareBtn) {
            compareBtn.addEventListener('click', function () {
                var fromVal = document.getElementById('range-from').value;
                var toVal = document.getElementById('range-to').value;
                var thenDate = document.getElementById('then-date');
                var nowDate = document.getElementById('now-date');

                if (thenDate && fromVal) thenDate.value = fromVal;
                if (nowDate && toVal) nowDate.value = toVal;

                if (window.GeoClixAnalysis) {
                    GeoClixAnalysis.updateThenMap(fromVal);
                    GeoClixAnalysis.updateNowMap(toVal);
                    GeoClixAnalysis.refreshKeyEvents();
                }
            });
        }
        // Workspace Menu Tabs
        var menuItems = document.querySelectorAll('.sidebar-menu-group .menu-item');
        menuItems.forEach(function (item) {
            item.addEventListener('click', function () {
                menuItems.forEach(function (m) { m.classList.remove('active'); });
                item.classList.add('active');
                menuItems.forEach(function (m) { m.setAttribute('aria-pressed', String(m === item)); });

                var view = item.getAttribute('data-view');
                handleWorkspaceView(view);
            });
        });

        // Region Dropdown
        var regionSelect = document.getElementById('region-select');
        if (regionSelect) {
            regionSelect.addEventListener('change', function () {
                loadRegion(regionSelect.value);
            });
        }

        // Scatter Marker Filter Toggles
        var fireToggle = document.getElementById('dash-fire-toggle');
        var lossToggle = document.getElementById('dash-loss-toggle');

        if (fireToggle) {
            fireToggle.addEventListener('change', function () {
                var reg = REGION_DATA[regionSelect.value];
                renderScatterMarkers(reg.lat, reg.lng);
            });
        }
        if (lossToggle) {
            lossToggle.addEventListener('change', function () {
                var reg = REGION_DATA[regionSelect.value];
                renderScatterMarkers(reg.lat, reg.lng);
            });
        }

        // Cloud Overlay Toggle
        var cloudToggle = document.getElementById('dash-cloud-toggle');
        if (cloudToggle) {
            cloudToggle.addEventListener('change', function () {
                var hasKey = typeof GEOCLIX_CONFIG !== 'undefined' && GEOCLIX_CONFIG.OPENWEATHER_API_KEY;
                if (cloudToggle.checked) {
                    if (hasKey && map) {
                        cloudOverlayLayer = L.tileLayer(
                            'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                            { opacity: 0.5, maxZoom: 18 }
                        ).addTo(map);
                    } else {
                        cloudCanvasEl = createDemoCanvas('dash-map', 'rgb(220, 235, 245)', 0.4);
                    }
                } else {
                    if (cloudOverlayLayer && map) {
                        map.removeLayer(cloudOverlayLayer);
                        cloudOverlayLayer = null;
                    }
                    if (cloudCanvasEl && cloudCanvasEl.parentElement) {
                        cloudCanvasEl.parentElement.removeChild(cloudCanvasEl);
                        cloudCanvasEl = null;
                    }
                }
            });
        }

        // Pollution Overlay Toggle
        var pollutionToggle = document.getElementById('dash-pollution-toggle');
        if (pollutionToggle) {
            pollutionToggle.addEventListener('change', function () {
                var hasKey = typeof GEOCLIX_CONFIG !== 'undefined' && GEOCLIX_CONFIG.OPENWEATHER_API_KEY;
                if (pollutionToggle.checked) {
                    if (hasKey && map) {
                        pollutionOverlayLayer = L.tileLayer(
                            'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                            { opacity: 0.4, maxZoom: 18 }
                        ).addTo(map);
                    } else {
                        pollutionCanvasEl = createDemoCanvas('dash-map', 'rgb(190, 120, 40)', 0.3);
                    }
                } else {
                    if (pollutionOverlayLayer && map) {
                        map.removeLayer(pollutionOverlayLayer);
                        pollutionOverlayLayer = null;
                    }
                    if (pollutionCanvasEl && pollutionCanvasEl.parentElement) {
                        pollutionCanvasEl.parentElement.removeChild(pollutionCanvasEl);
                        pollutionCanvasEl = null;
                    }
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
