/**
 * GeoClixWeather — Weather & Air Quality Module
 * Fetches weather + AQI data from OpenWeatherMap free API.
 * Falls back to realistic mock data for Indian cities when no API key is set.
 *
 * @module GeoClixWeather
 */
var GeoClixWeather = (function () {
    'use strict';

    // ─── AQI Colour & Label Mapping ─────────────────────────────────────
    /** @type {Object<number, {label: string, color: string}>} */
    var AQI_MAP = {
        1: { label: 'Good',      color: '#4ade80' },
        2: { label: 'Fair',      color: '#a3e635' },
        3: { label: 'Moderate',  color: '#facc15' },
        4: { label: 'Poor',      color: '#f97316' },
        5: { label: 'Very Poor', color: '#ef4444' }
    };

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * Simple seeded pseudo-random number generator (mulberry32).
     * Produces a deterministic float [0, 1) for a given seed.
     * @param {number} seed
     * @returns {function(): number}
     */
    function seededRng(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Generates realistic mock weather data for India based on coordinates.
     * @param {number} lat
     * @param {number} lng
     * @returns {{temp: number, humidity: number, rainfall: number, wind: number, aqi: number}}
     */
    function generateMockData(lat, lng) {
        var seed = Math.round((lat * 1000 + lng * 1000 + Date.now() / 86400000) * 100);
        var rng = seededRng(seed);

        // Temperature varies with latitude: hotter in the south, cooler in the north
        var baseTempOffset = (35.5 - lat) / (35.5 - 6.5); // 0 (north) → 1 (south)
        var temp = Math.round(18 + baseTempOffset * 14 + (rng() * 6 - 3)); // 18‒38 °C
        temp = Math.max(18, Math.min(38, temp));

        var humidity = Math.round(40 + rng() * 45); // 40‒85 %
        var rainfall = Math.round(rng() * 150);     // 0‒150 mm
        var wind = Math.round(5 + rng() * 20);      // 5‒25 km/h
        var aqi = Math.min(4, Math.max(1, Math.ceil(rng() * 4))); // 1‒4

        return { temp: temp, humidity: humidity, rainfall: rainfall, wind: wind, aqi: aqi };
    }

    // ─── API Calls ───────────────────────────────────────────────────────

    /**
     * Fetches current weather data from OpenWeatherMap.
     * Returns mock data if no API key is configured.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<Object>} Resolved with weather payload
     */
    function fetchWeather(lat, lng) {
        var key = GEOCLIX_CONFIG.OPENWEATHER_API_KEY;
        if (!key) {
            var mock = generateMockData(lat, lng);
            return Promise.resolve({
                main: { temp: mock.temp, humidity: mock.humidity },
                wind: { speed: mock.wind / 3.6 }, // API returns m/s
                rain: mock.rainfall > 0 ? { '1h': mock.rainfall } : undefined,
                _mock: true
            });
        }

        var url = 'https://api.openweathermap.org/data/2.5/weather?lat=' +
                  lat + '&lon=' + lng + '&appid=' + key + '&units=metric';

        return fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('Weather API error: ' + res.status);
                return res.json();
            })
            .catch(function (err) {
                console.warn('[GeoClixWeather] fetchWeather failed, using mock:', err);
                var mock = generateMockData(lat, lng);
                return {
                    main: { temp: mock.temp, humidity: mock.humidity },
                    wind: { speed: mock.wind / 3.6 },
                    rain: mock.rainfall > 0 ? { '1h': mock.rainfall } : undefined,
                    _mock: true
                };
            });
    }

    /**
     * Fetches Air Quality Index data from OpenWeatherMap.
     * Returns mock data if no API key is configured.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<Object>} Resolved with AQI payload
     */
    function fetchAQI(lat, lng) {
        var key = GEOCLIX_CONFIG.OPENWEATHER_API_KEY;
        if (!key) {
            var mock = generateMockData(lat, lng);
            return Promise.resolve({
                list: [{ main: { aqi: mock.aqi } }],
                _mock: true
            });
        }

        var url = 'https://api.openweathermap.org/data/2.5/air_pollution?lat=' +
                  lat + '&lon=' + lng + '&appid=' + key;

        return fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('AQI API error: ' + res.status);
                return res.json();
            })
            .catch(function (err) {
                console.warn('[GeoClixWeather] fetchAQI failed, using mock:', err);
                var mock = generateMockData(lat, lng);
                return {
                    list: [{ main: { aqi: mock.aqi } }],
                    _mock: true
                };
            });
    }

    // ─── DOM Updates — Overview Sidebar ──────────────────────────────────

    /**
     * Maps AQI index 1–5 to a stroke-dashoffset on a 264-unit arc.
     * AQI 1 → nearly full arc (small offset), AQI 5 → nearly empty arc.
     * @param {number} aqi 1–5
     * @returns {number}
     */
    function aqiToOffset(aqi) {
        // Total circumference ≈ 264 (2π × 42)
        // Map 1→52, 2→105, 3→158, 4→211, 5→250
        var filled = aqi / 5;          // 0.2 – 1.0
        return Math.round(264 - filled * 212); // leaves a small gap
    }

    /**
     * Fetches weather + AQI and updates the Overview sidebar elements.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<void>}
     */
    function updateOverviewWeather(lat, lng) {
        return Promise.all([fetchWeather(lat, lng), fetchAQI(lat, lng)])
            .then(function (results) {
                var weather = results[0];
                var aqiData = results[1];

                try {
                    // Climate summary
                    var tempEl      = document.getElementById('ov-temp');
                    var humidityEl  = document.getElementById('ov-humidity');
                    var rainfallEl  = document.getElementById('ov-rainfall');
                    var windEl      = document.getElementById('ov-wind');

                    if (tempEl)     tempEl.textContent     = Math.round(weather.main.temp) + '°C';
                    if (humidityEl) humidityEl.textContent  = weather.main.humidity + '%';
                    if (rainfallEl) rainfallEl.textContent  = ((weather.rain && (weather.rain['1h'] || weather.rain['3h'])) || 0) + ' mm';
                    if (windEl)     windEl.textContent      = Math.round(weather.wind.speed * 3.6) + ' km/h';

                    // AQI circle
                    var aqiIndex  = aqiData.list && aqiData.list[0] && aqiData.list[0].main ? aqiData.list[0].main.aqi : 1;
                    var aqiInfo   = AQI_MAP[aqiIndex] || AQI_MAP[1];

                    var numEl    = document.getElementById('ov-aqi-number');
                    var statusEl = document.getElementById('ov-aqi-status');
                    var arcEl    = document.getElementById('ov-aqi-arc');

                    if (numEl)    numEl.textContent    = aqiIndex;
                    if (statusEl) statusEl.textContent = aqiInfo.label;
                    if (arcEl) {
                        arcEl.style.stroke            = aqiInfo.color;
                        arcEl.style.strokeDashoffset   = aqiToOffset(aqiIndex);
                    }
                } catch (e) {
                    console.warn('[GeoClixWeather] updateOverviewWeather DOM error:', e);
                }
            })
            .catch(function (err) {
                console.warn('[GeoClixWeather] updateOverviewWeather error:', err);
            });
    }

    // ─── DOM Updates — Analysis Sidebar ──────────────────────────────────

    /**
     * Fetches weather + AQI and updates the Analysis sidebar elements.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<void>}
     */
    function updateAnalysisWeather(lat, lng) {
        return Promise.all([fetchWeather(lat, lng), fetchAQI(lat, lng)])
            .then(function (results) {
                var weather = results[0];
                var aqiData = results[1];

                try {
                    // Climate mini‐grid
                    var tempEl     = document.getElementById('an-temp');
                    var humidityEl = document.getElementById('an-humidity');
                    var rainfallEl = document.getElementById('an-rainfall');
                    var windEl     = document.getElementById('an-wind');

                    if (tempEl)     tempEl.textContent     = Math.round(weather.main.temp) + '°C';
                    if (humidityEl) humidityEl.textContent  = weather.main.humidity + '%';
                    if (rainfallEl) rainfallEl.textContent  = ((weather.rain && (weather.rain['1h'] || weather.rain['3h'])) || 0) + ' mm';
                    if (windEl)     windEl.textContent      = Math.round(weather.wind.speed * 3.6) + ' km/h';

                    // AQI gauge
                    var aqiIndex = aqiData.list && aqiData.list[0] && aqiData.list[0].main ? aqiData.list[0].main.aqi : 1;
                    var aqiInfo  = AQI_MAP[aqiIndex] || AQI_MAP[1];

                    var valEl   = document.getElementById('an-aqi-value');
                    var lblEl   = document.getElementById('an-aqi-label');
                    var fillEl  = document.getElementById('an-aqi-fill');

                    if (valEl) valEl.textContent = aqiIndex;
                    if (lblEl) lblEl.textContent = aqiInfo.label;
                    if (fillEl) {
                        var widthPct = (aqiIndex / 5) * 100;
                        fillEl.style.width           = widthPct + '%';
                        fillEl.style.backgroundColor = aqiInfo.color;
                        fillEl.style.transition      = 'width 0.6s ease, background-color 0.6s ease';
                    }
                } catch (e) {
                    console.warn('[GeoClixWeather] updateAnalysisWeather DOM error:', e);
                }
            })
            .catch(function (err) {
                console.warn('[GeoClixWeather] updateAnalysisWeather error:', err);
            });
    }

    // ─── Public API ──────────────────────────────────────────────────────
    return {
        fetchWeather: fetchWeather,
        fetchAQI: fetchAQI,
        updateOverviewWeather: updateOverviewWeather,
        updateAnalysisWeather: updateAnalysisWeather
    };
})();

window.GeoClixWeather = GeoClixWeather;
