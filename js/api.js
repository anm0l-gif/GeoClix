/**
 * GeoClixAPI — Frontend Client for GeoClix REST API
 * Connects the UI to the Node.js backend server.
 * Fetches real-time Sentinel-2 / Sentinel-1 SAR alerts, FIRMS fire hotspots,
 * weather telemetry, and triggers ESRGAN super-resolution upscaling.
 *
 * @module GeoClixAPI
 */
var GeoClixAPI = (function () {
    'use strict';

    // Auto-detect backend API host (defaults to same origin)
    var API_BASE = (window.location.origin && window.location.origin !== 'null' && window.location.origin !== 'file://')
        ? window.location.origin + '/api'
        : 'http://localhost:8080/api';

    var isConnected = false;

    /**
     * Internal fetch helper with JSON parsing and fallback error handling.
     * @param {string} endpoint
     * @param {object} [options]
     * @returns {Promise<any>}
     */
    function request(endpoint, options) {
        options = options || {};
        options.headers = options.headers || {};
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
            options.headers['Content-Type'] = 'application/json';
        }

        var url = API_BASE + endpoint;
        return fetch(url, options)
            .then(function (res) {
                if (!res.ok) {
                    throw new Error('API request failed: ' + res.status + ' ' + res.statusText);
                }
                isConnected = true;
                updateConnectivityBadge(true);
                return res.json();
            })
            .catch(function (err) {
                console.warn('[GeoClixAPI] Request error on ' + endpoint + ':', err.message);
                updateConnectivityBadge(false);
                throw err;
            });
    }

    /**
     * Updates the UI status pill showing API connectivity.
     */
    function updateConnectivityBadge(connected) {
        var badges = document.querySelectorAll('.api-status-badge');
        badges.forEach(function (badge) {
            if (connected) {
                badge.innerHTML = '<span class="live-dot" style="background:#10b981;"></span> <span>API: CONNECTED (200 OK)</span>';
                badge.style.color = '#10b981';
                badge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            } else {
                badge.innerHTML = '<span class="live-dot" style="background:#f59e0b;"></span> <span>API: OFFLINE CACHE</span>';
                badge.style.color = '#f59e0b';
                badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
            }
        });
    }

    /**
     * Checks backend server status.
     * @returns {Promise<object>}
     */
    function getStatus() {
        return request('/status');
    }

    /**
     * Fetches all real-time forest loss alerts across India.
     * @returns {Promise<Array<object>>}
     */
    function getAlerts() {
        return request('/alerts')
            .then(function (data) {
                return data.alerts || [];
            });
    }

    /**
     * Fetches detailed data for a specific alert zone.
     * @param {string} id
     * @returns {Promise<object>}
     */
    function getAlertById(id) {
        return request('/alerts/' + encodeURIComponent(id));
    }

    /**
     * Fetches weather and cloud cover telemetry for coordinates.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<object>}
     */
    function getWeather(lat, lng) {
        return request('/weather?lat=' + lat + '&lng=' + lng);
    }

    /**
     * Fetches NASA FIRMS thermal fire anomalies.
     * @returns {Promise<Array<object>>}
     */
    function getFires() {
        return request('/fires')
            .then(function (data) {
                return data.fires || [];
            });
    }

    /**
     * Requests ESRGAN 4x super-resolution upscaling from backend.
     * @param {number} lat
     * @param {number} lng
     * @returns {Promise<object>}
     */
    function enhanceResolution(lat, lng) {
        return request('/enhance', {
            method: 'POST',
            body: { lat: lat, lng: lng, resolution: '2.5m' }
        });
    }

    /**
     * Fetches national summary statistics.
     * @returns {Promise<object>}
     */
    function getStats() {
        return request('/stats');
    }

    // Auto-ping backend on module load
    setTimeout(function () {
        getStatus().catch(function () {});
    }, 500);

    return {
        getStatus: getStatus,
        getAlerts: getAlerts,
        getAlertById: getAlertById,
        getWeather: getWeather,
        getFires: getFires,
        enhanceResolution: enhanceResolution,
        getStats: getStats,
        isConnected: function () { return isConnected; }
    };
})();

window.GeoClixAPI = GeoClixAPI;