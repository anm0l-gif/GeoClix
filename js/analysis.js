/**
 * GeoClixAnalysis — Split-View Comparison & Analysis Overlay Module
 * Manages the "Then vs Now" split-view maps, overlay toggles, split divider,
 * and date input interactions for the analysis overlay screen.
 *
 * @module GeoClixAnalysis
 */
var GeoClixAnalysis = (function () {
    'use strict';

    var thenMap = null;
    var nowMap  = null;
    var thenTileLayer = null;
    var nowTileLayer  = null;

    /** One independent overlay per comparison pane. */
    var cloudOverlays     = { then: null, now: null };
    var pollutionOverlays = { then: null, now: null };
    var cloudCanvases     = { then: null, now: null };
    var pollutionCanvases = { then: null, now: null };

    var _syncing = false;
    var _cleanupFns = [];
    var activeLat = null;
    var activeLng = null;

    // ─── Tile URL Helpers ────────────────────────────────────────────────

    function tileUrlForDate(dateStr) {
        var year = 2026;
        if (dateStr) {
            var parsed = parseInt(dateStr.substring(0, 4), 10);
            if (!isNaN(parsed)) year = parsed;
        }

        // Pre-2020: Historical ArcGIS imagery
        // 2020+: Recent High-Resolution Satellite mosaic
        if (year < 2020) {
            return (GEOCLIX_CONFIG && GEOCLIX_CONFIG.TIMELAPSE_TILES && GEOCLIX_CONFIG.TIMELAPSE_TILES.historical)
                || (GEOCLIX_CONFIG && GEOCLIX_CONFIG.TILES && GEOCLIX_CONFIG.TILES.satellite)
                || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        } else {
            return (GEOCLIX_CONFIG && GEOCLIX_CONFIG.TIMELAPSE_TILES && GEOCLIX_CONFIG.TIMELAPSE_TILES.recent)
                || (GEOCLIX_CONFIG && GEOCLIX_CONFIG.SENTINEL2_TILES)
                || 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        }
    }

    function createTileLayer(url) {
        var opts = {
            maxZoom: (GEOCLIX_CONFIG && GEOCLIX_CONFIG.MAX_ZOOM) || 19,
            attribution: '© Satellite Imagery'
        };
        if (url && url.indexOf('google') !== -1) {
            opts.subdomains = ['0', '1', '2', '3'];
            opts.maxZoom = 20;
            opts.attribution = '© Google Satellite';
        } else if (url && url.indexOf('arcgisonline') !== -1) {
            opts.maxZoom = 19;
            opts.attribution = '© Esri, Maxar, Earthstar Geographics';
        }
        var layer = L.tileLayer(url, opts);
        layer.on('tileerror', function () {
            if (!layer._hasFallback && url.indexOf('arcgisonline') === -1) {
                layer._hasFallback = true;
                layer.setUrl('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
            }
        });
        return layer;
    }

    // ─── Init ────────────────────────────────────────────────────────────

    function init(lat, lng) {
        try {
            destroy();
            var center = [lat, lng];
            activeLat = lat;
            activeLng = lng;
            var zoom   = 12;

            thenMap = L.map('then-map', {
                center: center, zoom: zoom,
                zoomControl: false, attributionControl: false
            });
            thenTileLayer = createTileLayer(tileUrlForDate('2018-01-15'));
            thenTileLayer.addTo(thenMap);

            nowMap = L.map('now-map', {
                center: center, zoom: zoom,
                zoomControl: false, attributionControl: false
            });
            nowTileLayer = createTileLayer(tileUrlForDate('2026-10-24'));
            nowTileLayer.addTo(nowMap);

            syncMaps(thenMap, nowMap);
            setupSplitDivider();
            setupOverlayToggles();
            setupDateInputs();
            refreshKeyEvents();

            var latEl = document.getElementById('detail-lat');
            var lngEl = document.getElementById('detail-lng');
            if (latEl) latEl.textContent = lat.toFixed(4) + '°';
            if (lngEl) lngEl.textContent = lng.toFixed(4) + '°';

            function resizeMaps() {
                var container = document.querySelector('.split-view-container');
                var width = container ? container.offsetWidth : 0;
                var thenMapEl = document.getElementById('then-map');
                if (thenMapEl && width) {
                    thenMapEl.style.width = width + 'px';
                }
                if (thenMap) thenMap.invalidateSize();
                if (nowMap)  nowMap.invalidateSize();
            }

            setTimeout(resizeMaps, 50);
            setTimeout(resizeMaps, 300);
            setTimeout(resizeMaps, 600);

            window.addEventListener('resize', resizeMaps);
            _cleanupFns.push(function () {
                window.removeEventListener('resize', resizeMaps);
            });

            console.info('[GeoClixAnalysis] Initialised at', lat, lng);
        } catch (e) {
            console.warn('[GeoClixAnalysis] init error:', e);
        }
    }

    // ─── Map Sync ────────────────────────────────────────────────────────

    function syncMaps(map1, map2) {
        function onMove1() {
            if (_syncing) return;
            _syncing = true;
            map2.setView(map1.getCenter(), map1.getZoom(), { animate: false });
            _syncing = false;
        }
        function onMove2() {
            if (_syncing) return;
            _syncing = true;
            map1.setView(map2.getCenter(), map2.getZoom(), { animate: false });
            _syncing = false;
        }
        map1.on('moveend zoomend', onMove1);
        map2.on('moveend zoomend', onMove2);
        _cleanupFns.push(function () {
            try { map1.off('moveend zoomend', onMove1); } catch (_) {}
            try { map2.off('moveend zoomend', onMove2); } catch (_) {}
        });
    }

    // ─── Split Divider ───────────────────────────────────────────────────

    function setupSplitDivider() {
        var divider   = document.getElementById('split-divider');
        if (!divider) return;
        var container = divider.parentElement;
        if (!container) return;
        var thenPane  = container.querySelector('.then-pane');
        var nowPane   = container.querySelector('.now-pane');
        if (!thenPane || !nowPane) return;

        var dragging = false;

        function getPercent(clientX) {
            var rect = container.getBoundingClientRect();
            var pct  = ((clientX - rect.left) / rect.width) * 100;
            return Math.max(0, Math.min(100, pct));
        }

        function applyPercent(pct) {
            thenPane.style.width = pct + '%';
            divider.style.left   = pct + '%';

            var containerWidth = container.offsetWidth;
            var thenMapEl = document.getElementById('then-map');
            if (thenMapEl && containerWidth) {
                thenMapEl.style.width = containerWidth + 'px';
            }
        }

        function onStart(e) { e.preventDefault(); dragging = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }
        function onMove(e)  { if (!dragging) return; applyPercent(getPercent(e.touches ? e.touches[0].clientX : e.clientX)); }
        function onEnd()    {
            if (!dragging) return;
            dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        divider.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        divider.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);

        _cleanupFns.push(function () {
            divider.removeEventListener('mousedown', onStart);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            divider.removeEventListener('touchstart', onStart);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        });
    }

    // ─── Canvas-based Demo Overlays ──────────────────────────────────────

    /**
     * Creates a canvas overlay on top of a Leaflet map container.
     * @param {string} mapId   e.g. 'now-map'
     * @param {string} color   CSS color string
     * @param {number} opacity 0–1
     * @returns {HTMLCanvasElement}
     */
    function createCanvasOverlay(mapId, color, opacity) {
        var container = document.getElementById(mapId);
        if (!container) return null;

        var canvas = document.createElement('canvas');
        canvas.style.cssText = [
            'position:absolute',
            'top:0', 'left:0',
            'width:100%', 'height:100%',
            'pointer-events:none',
            'z-index:500',
            'opacity:' + opacity
        ].join(';');
        canvas.width  = container.offsetWidth  || 400;
        canvas.height = container.offsetHeight || 300;

        var ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add some texture — random "cloud" or "pollution" blobs
        for (var i = 0; i < 30; i++) {
            var x = Math.random() * canvas.width;
            var y = Math.random() * canvas.height;
            var r = 30 + Math.random() * 80;
            var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, color.replace(')', ', 0.6)').replace('rgb', 'rgba'));
            grad.addColorStop(1, 'transparent');
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Keep the overlay in its own map container. Appending every canvas
        // to .now-pane caused comparison overlays to appear in the wrong pane.
        container.style.position = 'relative';
        container.appendChild(canvas);
        return canvas;
    }

    function removeCanvasOverlay(canvas) {
        if (canvas && canvas.parentElement) {
            canvas.parentElement.removeChild(canvas);
        }
    }

    // ─── Overlay Toggles ─────────────────────────────────────────────────

    function setupOverlayToggles() {
        var cloudsToggle    = document.getElementById('clouds-toggle');
        var pollutionToggle = document.getElementById('pollution-toggle');
        var hasOWMKey       = GEOCLIX_CONFIG && GEOCLIX_CONFIG.OPENWEATHER_API_KEY;

        // ── Cloud overlay ──
        if (cloudsToggle) {
            var cloudHandler = function () {
                var label = document.querySelector('#overlay-clouds .overlay-label');
                var isOn  = cloudsToggle.checked;

                removeMapOverlays(cloudOverlays);
                removeCanvasOverlays(cloudCanvases);

                if (isOn) {
                    if (hasOWMKey) {
                        cloudOverlays.now = L.tileLayer(
                            'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                            { opacity: 0.55, maxZoom: 18 }
                        );
                        if (nowMap) cloudOverlays.now.addTo(nowMap);
                        if (thenMap) {
                            cloudOverlays.then = L.tileLayer(
                                'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                                { opacity: 0.55, maxZoom: 18 }
                            );
                            cloudOverlays.then.addTo(thenMap);
                        }
                    } else {
                        cloudCanvases.then = createCanvasOverlay('then-map', 'rgb(220, 230, 245)', 0.35);
                        cloudCanvases.now = createCanvasOverlay('now-map', 'rgb(220, 230, 245)', 0.35);
                    }
                    if (label) { label.style.opacity = '1'; label.style.color = '#fff'; }
                } else {
                    if (label) { label.style.opacity = '0.6'; label.style.color = ''; }
                }
            };
            cloudsToggle.addEventListener('change', cloudHandler);
            _cleanupFns.push(function () { cloudsToggle.removeEventListener('change', cloudHandler); });
        }

        // ── Pollution overlay ──
        if (pollutionToggle) {
            var pollutionHandler = function () {
                var label = document.querySelector('#overlay-pollution .overlay-label');
                var isOn  = pollutionToggle.checked;

                removeMapOverlays(pollutionOverlays);
                removeCanvasOverlays(pollutionCanvases);

                if (isOn) {
                    if (hasOWMKey) {
                        pollutionOverlays.now = L.tileLayer(
                            'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                            { opacity: 0.45, maxZoom: 18 }
                        );
                        if (nowMap) pollutionOverlays.now.addTo(nowMap);
                        if (thenMap) {
                            pollutionOverlays.then = L.tileLayer(
                                'https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=' + GEOCLIX_CONFIG.OPENWEATHER_API_KEY,
                                { opacity: 0.45, maxZoom: 18 }
                            );
                            pollutionOverlays.then.addTo(thenMap);
                        }
                    } else {
                        pollutionCanvases.then = createCanvasOverlay('then-map', 'rgb(180, 120, 40)', 0.3);
                        pollutionCanvases.now = createCanvasOverlay('now-map', 'rgb(180, 120, 40)', 0.3);
                    }
                    if (label) { label.style.opacity = '1'; label.style.color = '#f59e0b'; }
                } else {
                    if (label) { label.style.opacity = '0.6'; label.style.color = ''; }
                }
            };
            pollutionToggle.addEventListener('change', pollutionHandler);
            _cleanupFns.push(function () { pollutionToggle.removeEventListener('change', pollutionHandler); });
        }
    }

    function removeMapOverlays(overlays) {
        if (overlays.then && thenMap) { try { thenMap.removeLayer(overlays.then); } catch (_) {} }
        if (overlays.now && nowMap) { try { nowMap.removeLayer(overlays.now); } catch (_) {} }
        overlays.then = null;
        overlays.now = null;
    }

    function removeCanvasOverlays(canvases) {
        removeCanvasOverlay(canvases.then);
        removeCanvasOverlay(canvases.now);
        canvases.then = null;
        canvases.now = null;
    }

    // ─── Map Tile Updates ────────────────────────────────────────────────

    function updateThenMap(dateStr) {
        try {
            if (!thenMap) return;
            if (thenTileLayer) thenMap.removeLayer(thenTileLayer);
            thenTileLayer = createTileLayer(tileUrlForDate(dateStr));
            thenTileLayer.addTo(thenMap);
            thenMap.invalidateSize();
        } catch (e) {
            console.warn('[GeoClixAnalysis] updateThenMap error:', e);
        }
    }

    function updateNowMap(dateStr) {
        try {
            if (!nowMap) return;
            if (nowTileLayer) nowMap.removeLayer(nowTileLayer);
            nowTileLayer = createTileLayer(tileUrlForDate(dateStr));
            nowTileLayer.addTo(nowMap);
            nowMap.invalidateSize();
        } catch (e) {
            console.warn('[GeoClixAnalysis] updateNowMap error:', e);
        }
    }

    // ─── Date Inputs ─────────────────────────────────────────────────────

    function setupDateInputs() {
        var thenDateEl = document.getElementById('then-date');
        var nowDateEl  = document.getElementById('now-date');

        if (thenDateEl) {
            var thenHandler = function () { updateThenMap(thenDateEl.value); refreshKeyEvents(); };
            thenDateEl.addEventListener('change', thenHandler);
            _cleanupFns.push(function () { thenDateEl.removeEventListener('change', thenHandler); });
        }

        if (nowDateEl) {
            if (!nowDateEl.value) nowDateEl.value = new Date().toISOString().slice(0, 10);
            var nowHandler = function () { updateNowMap(nowDateEl.value); refreshKeyEvents(); };
            nowDateEl.addEventListener('change', nowHandler);
            _cleanupFns.push(function () { nowDateEl.removeEventListener('change', nowHandler); });
        }
    }

    // ─── Verified natural-event timeline ──────────────────────────────────

    function refreshKeyEvents() {
        if (typeof activeLat !== 'number' || typeof activeLng !== 'number') return;
        var thenDate = document.getElementById('then-date');
        var nowDate = document.getElementById('now-date');
        var start = thenDate && thenDate.value;
        var end = nowDate && nowDate.value;
        if (!start || !end || start > end) return;

        var timeline = document.getElementById('events-timeline');
        if (!timeline) return;
        timeline.textContent = 'Loading verified natural events…';

        // EONET uses west,north,east,south. A compact window ties results to
        // the analysed location instead of returning events across India.
        var bbox = [
            (activeLng - 0.75).toFixed(3),
            (activeLat + 0.75).toFixed(3),
            (activeLng + 0.75).toFixed(3),
            (activeLat - 0.75).toFixed(3)
        ].join(',');
        var url = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=all&limit=20&start=' +
            encodeURIComponent(start) + '&end=' + encodeURIComponent(end) + '&bbox=' + bbox;

        fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('EONET request failed: ' + res.status);
                return res.json();
            })
            .then(function (data) { renderKeyEvents((data && data.events) || [], timeline); })
            .catch(function () {
                timeline.textContent = 'Natural-event data is unavailable for this area and date range.';
            });
    }

    function renderKeyEvents(events, timeline) {
        timeline.replaceChildren();
        if (!events.length) {
            timeline.textContent = 'No NASA EONET natural events were reported for this area and date range.';
            return;
        }
        events.slice(0, 4).forEach(function (event) {
            var categories = (event.categories || []).map(function (category) {
                return category.title || category.id || '';
            }).join(' ').toLowerCase();
            var eventClass = categories.indexOf('fire') !== -1 ? 'fire' :
                categories.indexOf('flood') !== -1 ? 'flood' :
                categories.indexOf('drought') !== -1 ? 'drought' : 'mining';
            var date = event.geometry && event.geometry[0] && event.geometry[0].date ?
                event.geometry[0].date.slice(0, 10) : 'Date unknown';
            var item = document.createElement('div');
            item.className = 'event-item ' + eventClass;
            var dateEl = document.createElement('span');
            dateEl.className = 'event-year';
            dateEl.textContent = date;
            var textEl = document.createElement('span');
            textEl.className = 'event-text';
            textEl.textContent = event.title || 'Natural event';
            item.appendChild(dateEl);
            item.appendChild(textEl);
            timeline.appendChild(item);
        });
    }

    // ─── Destroy ─────────────────────────────────────────────────────────

    function destroy() {
        _cleanupFns.forEach(function (fn) { try { fn(); } catch (_) {} });
        _cleanupFns = [];

        // Clean up overlays
        removeMapOverlays(cloudOverlays);
        removeMapOverlays(pollutionOverlays);
        removeCanvasOverlays(cloudCanvases);
        removeCanvasOverlays(pollutionCanvases);

        // Destroy maps
        if (thenMap) { try { thenMap.remove(); } catch (_) {} thenMap = null; }
        if (nowMap)  { try { nowMap.remove();  } catch (_) {} nowMap  = null; }

        thenTileLayer = null;
        nowTileLayer  = null;
        _syncing      = false;
        activeLat = null;
        activeLng = null;
    }

    function getAnalysisMaps() {
        return { thenMap: thenMap, nowMap: nowMap };
    }

    return {
        init:                 init,
        destroy:              destroy,
        setupSplitDivider:    setupSplitDivider,
        setupOverlayToggles:  setupOverlayToggles,
        updateThenMap:        updateThenMap,
        updateNowMap:         updateNowMap,
        refreshKeyEvents:     refreshKeyEvents,
        getAnalysisMaps:      getAnalysisMaps
    };
})();

window.GeoClixAnalysis = GeoClixAnalysis;
