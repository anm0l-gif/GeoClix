/**
 * GeoClixFires — Active Fire Data Module
 * Fetches active fire data from NASA FIRMS API (VIIRS).
 * Falls back to hardcoded sample fire locations across India when no API key is set.
 *
 * @module GeoClixFires
 */
var GeoClixFires = (function () {
    'use strict';

    /** @type {L.LayerGroup|null} */
    var fireLayerGroup = null;

    /** @type {Array<Object>} Cached fire data */
    var cachedFires = [];

    // ─── Sample Fire Data (30+ realistic Indian fire‐prone locations) ───
    /**
     * Hardcoded sample fires covering major forest fire zones:
     * Uttarakhand, Madhya Pradesh, Jharkhand, Odisha, Chhattisgarh,
     * Himachal Pradesh, Northeast (Mizoram, Nagaland, Manipur).
     * @type {Array<{lat:number,lng:number,brightness:number,frp:number,date:string,time:string,confidence:number}>}
     */
    var SAMPLE_FIRES = [
        // Uttarakhand — Rajaji & Jim Corbett belt
        { lat: 30.0869, lng: 78.2676, brightness: 342.1, frp: 18.5, date: '2026-10-22', time: '06:30', confidence: 88 },
        { lat: 29.9457, lng: 78.9350, brightness: 358.4, frp: 24.2, date: '2026-10-22', time: '07:15', confidence: 91 },
        { lat: 30.4118, lng: 79.4532, brightness: 321.7, frp: 12.8, date: '2026-10-23', time: '05:45', confidence: 78 },
        { lat: 30.6301, lng: 79.0805, brightness: 367.2, frp: 31.6, date: '2026-10-23', time: '06:00', confidence: 93 },
        { lat: 29.5281, lng: 79.2310, brightness: 334.5, frp: 15.3, date: '2026-10-24', time: '07:00', confidence: 85 },

        // Himachal Pradesh — Kullu/Shimla forests
        { lat: 31.9526, lng: 77.1095, brightness: 310.8, frp: 10.2, date: '2026-10-22', time: '08:30', confidence: 74 },
        { lat: 32.2190, lng: 76.3234, brightness: 328.3, frp: 14.7, date: '2026-10-23', time: '09:00', confidence: 82 },

        // Madhya Pradesh — Satpura/Kanha/Panna
        { lat: 22.6200, lng: 78.0800, brightness: 375.6, frp: 42.1, date: '2026-10-22', time: '04:00', confidence: 95 },
        { lat: 23.0848, lng: 80.6350, brightness: 348.9, frp: 28.3, date: '2026-10-22', time: '04:30', confidence: 89 },
        { lat: 22.3550, lng: 80.1728, brightness: 362.0, frp: 35.8, date: '2026-10-23', time: '03:45', confidence: 92 },
        { lat: 24.7180, lng: 80.3315, brightness: 305.4, frp: 9.8, date: '2026-10-23', time: '05:00', confidence: 71 },
        { lat: 23.4850, lng: 77.5200, brightness: 330.1, frp: 17.9, date: '2026-10-24', time: '04:15', confidence: 83 },

        // Chhattisgarh — Achanakmar / Indravati
        { lat: 22.4685, lng: 81.7347, brightness: 387.3, frp: 48.5, date: '2026-10-22', time: '03:15', confidence: 94 },
        { lat: 19.1278, lng: 80.8630, brightness: 356.8, frp: 26.7, date: '2026-10-22', time: '02:45', confidence: 90 },
        { lat: 21.8490, lng: 81.3150, brightness: 340.2, frp: 20.1, date: '2026-10-23', time: '03:00', confidence: 86 },
        { lat: 22.9130, lng: 82.0540, brightness: 318.7, frp: 13.4, date: '2026-10-24', time: '04:30', confidence: 79 },

        // Jharkhand — Dalma / Palamau
        { lat: 23.6345, lng: 85.4140, brightness: 345.2, frp: 22.9, date: '2026-10-22', time: '05:30', confidence: 87 },
        { lat: 23.9510, lng: 84.0730, brightness: 369.1, frp: 33.4, date: '2026-10-22', time: '05:00', confidence: 92 },
        { lat: 22.7860, lng: 86.1830, brightness: 312.6, frp: 11.5, date: '2026-10-23', time: '06:15', confidence: 76 },

        // Odisha — Simlipal / Satkosia
        { lat: 21.6170, lng: 86.3640, brightness: 352.7, frp: 25.6, date: '2026-10-22', time: '04:45', confidence: 89 },
        { lat: 20.4550, lng: 84.6410, brightness: 378.0, frp: 39.3, date: '2026-10-22', time: '03:30', confidence: 93 },
        { lat: 19.7230, lng: 84.3850, brightness: 331.5, frp: 18.2, date: '2026-10-23', time: '05:00', confidence: 84 },
        { lat: 21.9480, lng: 86.0760, brightness: 304.9, frp: 8.7,  date: '2026-10-24', time: '06:00', confidence: 72 },

        // Northeast — Mizoram / Nagaland / Manipur
        { lat: 23.7307, lng: 92.7173, brightness: 360.3, frp: 30.5, date: '2026-10-22', time: '07:30', confidence: 91 },
        { lat: 25.6747, lng: 94.1100, brightness: 335.8, frp: 19.8, date: '2026-10-22', time: '08:00', confidence: 85 },
        { lat: 24.8170, lng: 93.9368, brightness: 347.6, frp: 23.1, date: '2026-10-23', time: '07:45', confidence: 88 },
        { lat: 26.1584, lng: 94.5624, brightness: 315.2, frp: 12.0, date: '2026-10-23', time: '08:15', confidence: 77 },
        { lat: 23.1645, lng: 92.9376, brightness: 390.1, frp: 52.3, date: '2026-10-23', time: '06:30', confidence: 95 },

        // Western Ghats — Karnataka / Goa border
        { lat: 15.4909, lng: 74.0020, brightness: 308.4, frp: 10.1, date: '2026-10-22', time: '09:00', confidence: 73 },
        { lat: 14.2432, lng: 75.5760, brightness: 322.9, frp: 14.5, date: '2026-10-23', time: '09:30', confidence: 80 },

        // Rajasthan — Sariska / Ranthambore
        { lat: 26.0073, lng: 76.3890, brightness: 339.7, frp: 19.4, date: '2026-10-24', time: '10:00', confidence: 83 },
        { lat: 27.3560, lng: 76.5180, brightness: 314.6, frp: 11.8, date: '2026-10-24', time: '10:30', confidence: 75 }
    ];

    // ─── FIRMS CSV Parser ────────────────────────────────────────────────

    /**
     * Parses CSV text returned by NASA FIRMS into fire objects.
     * Expected columns: latitude,longitude,bright_ti4,scan,track,acq_date,
     * acq_time,satellite,confidence,version,bright_ti5,frp,daynight
     * @param {string} csv
     * @returns {Array<Object>}
     */
    function parseCSV(csv) {
        var lines = csv.trim().split('\n');
        if (lines.length < 2) return [];

        var headers = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
        var latIdx  = headers.indexOf('latitude');
        var lngIdx  = headers.indexOf('longitude');
        var briIdx  = headers.indexOf('bright_ti4');
        var frpIdx  = headers.indexOf('frp');
        var dateIdx = headers.indexOf('acq_date');
        var timeIdx = headers.indexOf('acq_time');
        var confIdx = headers.indexOf('confidence');

        if (latIdx === -1) latIdx = 0;
        if (lngIdx === -1) lngIdx = 1;

        var fires = [];
        for (var i = 1; i < lines.length; i++) {
            try {
                var cols = lines[i].split(',');
                if (cols.length < 4) continue;
                fires.push({
                    lat:        parseFloat(cols[latIdx]),
                    lng:        parseFloat(cols[lngIdx]),
                    brightness: briIdx  !== -1 ? parseFloat(cols[briIdx])  : 0,
                    frp:        frpIdx  !== -1 ? parseFloat(cols[frpIdx])  : 0,
                    date:       dateIdx !== -1 ? cols[dateIdx].trim()      : '',
                    time:       timeIdx !== -1 ? cols[timeIdx].trim()      : '',
                    confidence: confIdx !== -1 ? parseFloat(cols[confIdx]) : 0
                });
            } catch (e) {
                // skip malformed row
            }
        }
        return fires;
    }

    // ─── Fetch Fire Data ─────────────────────────────────────────────────

    /**
     * Fetches active fire data from NASA FIRMS API (VIIRS SNPP, last 24 h,
     * India). Falls back to sample data if no API key is configured.
     * @returns {Promise<Array<Object>>}
     */
    function fetchFireData() {
        var key = GEOCLIX_CONFIG.FIRMS_API_KEY;
        if (!key) {
            console.info('[GeoClixFires] No FIRMS API key — using sample fire data');
            cachedFires = SAMPLE_FIRES.slice();
            return Promise.resolve(cachedFires);
        }

        // NASA FIRMS area endpoint for India bounding box [SW: 68,6, NE: 98,38], last 1 day
        var url = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/' +
                  key + '/VIIRS_SNPP_NRT/68,6,98,38/1';

        return fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('FIRMS API error: ' + res.status);
                return res.text();
            })
            .then(function (csv) {
                cachedFires = parseCSV(csv);
                if (cachedFires.length === 0) {
                    console.warn('[GeoClixFires] FIRMS returned 0 fires; falling back to sample');
                    cachedFires = SAMPLE_FIRES.slice();
                }
                return cachedFires;
            })
            .catch(function (err) {
                console.warn('[GeoClixFires] fetchFireData failed, using sample:', err);
                cachedFires = SAMPLE_FIRES.slice();
                return cachedFires;
            });
    }

    // ─── Marker Rendering ────────────────────────────────────────────────

    /**
     * Maps brightness (300–400 K) to a colour on an orange→red gradient.
     * @param {number} brightness
     * @returns {string} CSS colour
     */
    function brightnessToColor(brightness) {
        var t = Math.max(0, Math.min(1, (brightness - 300) / 100)); // 0 → 1
        var r = 255;
        var g = Math.round(165 - t * 100); // 165 → 65
        var b = Math.round(0 + t * 30);    // 0 → 30
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    /**
     * Maps fire radiative power to a marker radius (pixels).
     * @param {number} frp
     * @returns {number}
     */
    function frpToRadius(frp) {
        return Math.max(4, Math.min(16, 4 + (frp / 5)));
    }

    /**
     * Adds circle markers to the Leaflet map for each fire detection.
     * @param {L.Map} map
     * @param {Array<Object>} fires
     */
    function addFireMarkers(map, fires) {
        if (!map) return;
        removeFireMarkers(map);

        fireLayerGroup = L.layerGroup();

        fires.forEach(function (fire) {
            if (isNaN(fire.lat) || isNaN(fire.lng)) return;

            var color  = brightnessToColor(fire.brightness);
            var radius = frpToRadius(fire.frp);

            var marker = L.circleMarker([fire.lat, fire.lng], {
                radius:      radius,
                fillColor:   color,
                color:       color,
                fillOpacity: 0.7,
                weight:      1,
                className:   'fire-pulse'   // pulsing animation CSS class
            });

            marker.bindPopup(
                '<div class="fire-popup">' +
                    '<strong>🔥 Active Fire</strong><br>' +
                    '<b>Location:</b> ' + fire.lat.toFixed(4) + '°N, ' + fire.lng.toFixed(4) + '°E<br>' +
                    '<b>Brightness:</b> ' + fire.brightness.toFixed(1) + ' K<br>' +
                    '<b>Fire Power:</b> ' + fire.frp.toFixed(1) + ' MW<br>' +
                    '<b>Confidence:</b> ' + fire.confidence + '%<br>' +
                    '<b>Date:</b> ' + fire.date + ' ' + fire.time +
                '</div>'
            );

            fireLayerGroup.addLayer(marker);
        });

        fireLayerGroup.addTo(map);
    }

    /**
     * Removes all fire markers from the map.
     * @param {L.Map} map
     */
    function removeFireMarkers(map) {
        if (fireLayerGroup) {
            try { fireLayerGroup.clearLayers(); } catch (_) {}
            try { if (map) map.removeLayer(fireLayerGroup); } catch (_) {}
            fireLayerGroup = null;
        }
    }

    /**
     * Toggles fire layer visibility.
     * @param {L.Map} map
     * @param {boolean} show
     */
    function toggleFires(map, show) {
        if (!fireLayerGroup || !map) return;
        if (show) {
            if (!map.hasLayer(fireLayerGroup)) {
                fireLayerGroup.addTo(map);
            }
        } else {
            if (map.hasLayer(fireLayerGroup)) {
                map.removeLayer(fireLayerGroup);
            }
        }
    }

    /**
     * Returns fires within a given radius of a point (Haversine).
     * @param {number} lat
     * @param {number} lng
     * @param {number} radiusKm
     * @returns {Array<Object>}
     */
    function getFiresNearLocation(lat, lng, radiusKm) {
        var toRad = Math.PI / 180;
        return cachedFires.filter(function (fire) {
            var dLat = (fire.lat - lat) * toRad;
            var dLng = (fire.lng - lng) * toRad;
            var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat * toRad) * Math.cos(fire.lat * toRad) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            var distKm = 6371 * c;
            return distKm <= radiusKm;
        });
    }

    // ─── Init ────────────────────────────────────────────────────────────

    /**
     * Initialises the fire module: fetches data and renders markers.
     * @param {L.Map} map
     * @returns {Promise<void>}
     */
    function init(map) {
        return fetchFireData().then(function (fires) {
            addFireMarkers(map, fires);
            console.info('[GeoClixFires] Loaded ' + fires.length + ' fire detections');
        });
    }

    // ─── Public API ──────────────────────────────────────────────────────
    return {
        init:                 init,
        fetchFireData:        fetchFireData,
        addFireMarkers:       addFireMarkers,
        removeFireMarkers:    removeFireMarkers,
        toggleFires:          toggleFires,
        getFiresNearLocation: getFiresNearLocation
    };
})();

window.GeoClixFires = GeoClixFires;
