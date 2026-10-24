/**
 * GeoClixApp — Main Application Orchestrator
 * Connects all screens, modules, user interactions, and lifecycle events.
 *
 * @module GeoClixApp
 */
var GeoClixApp = (function () {
    'use strict';

    var currentLat = 22.5;
    var currentLng = 82.5;
    var forestTrendChartInstance = null;

    /**
     * Initializes the entire application on DOM load.
     */
    function init() {
        console.log('🌿 Initializing GeoClix...');

        // 1. Setup Toast notification system
        setupToast();

        // 2. Play Preloader and start Hero Entrance
        if (window.GeoClixAnimations) {
            GeoClixAnimations.playPreloader(function () {
                GeoClixAnimations.playHeroEntrance();
                GeoClixAnimations.initHeroParticles();
                GeoClixAnimations.initScrollTriggers();
            });
        }

        // 3. Initialize Overview Map
        if (window.GeoClixMap) {
            GeoClixMap.init();
        }

        // 4. Initialize Insights 10-Year Trend Chart
        if (window.GeoClixCharts) {
            GeoClixCharts.initInsightsChart();
        }

        // 5. Setup UI Navigation & Event Handlers
        setupNavigation();
        setupAnalysisControls();

        // Set default date inputs
        var today = new Date().toISOString().slice(0, 10);
        var nowDate = document.getElementById('now-date');
        var rangeTo = document.getElementById('range-to');
        if (nowDate) nowDate.value = today;
        if (rangeTo) rangeTo.value = today;
    }

    /**
     * Navigation menu, smooth scrolling & hamburger.
     */
    function setupNavigation() {
        // Nav Links Smooth Scroll
        var navLinks = document.querySelectorAll('.nav-link, .hero-buttons a');
        navLinks.forEach(function (link) {
            link.addEventListener('click', function (e) {
                var targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    var targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        targetEl.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });

        // Get Alerts CTA button
        var getAlertsBtn = document.getElementById('get-alerts-btn');
        if (getAlertsBtn) {
            getAlertsBtn.addEventListener('click', function () {
                window.open('dashboard.html', '_blank');
            });
        }

        // Mobile Hamburger menu
        var hamburger = document.getElementById('hamburger');
        var navLinksContainer = document.querySelector('.nav-links');
        if (hamburger && navLinksContainer) {
            hamburger.addEventListener('click', function () {
                if (navLinksContainer.style.display === 'flex') {
                    navLinksContainer.style.display = 'none';
                } else {
                    navLinksContainer.style.display = 'flex';
                    navLinksContainer.style.flexDirection = 'column';
                    navLinksContainer.style.position = 'absolute';
                    navLinksContainer.style.top = '72px';
                    navLinksContainer.style.left = '16px';
                    navLinksContainer.style.right = '16px';
                    navLinksContainer.style.background = 'rgba(10,15,10,0.95)';
                    navLinksContainer.style.borderRadius = '16px';
                    navLinksContainer.style.padding = '16px';
                }
            });
        }
    }

    /**
     * Setup Detailed Location Analysis View controls.
     */
    function setupAnalysisControls() {
        var closeBtn = document.getElementById('analysis-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeAnalysis);
        }

        // Escape key to exit analysis view
        window.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                closeAnalysis();
            }
        });

        // Date range compare button
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

                showToast('Updated satellite imagery comparison: ' + fromVal + ' → ' + toVal, '🛰️', 3500);
            });
        }
    }

    /**
     * Opens Screen 3 / Detailed Location Analysis for specific coordinates.
     * @param {number} lat
     * @param {number} lng
     */
    async function openAnalysis(lat, lng) {
        currentLat = lat;
        currentLng = lng;

        var analysisView = document.getElementById('analysis-view');
        if (!analysisView) return;

        // Reveal overlay
        analysisView.classList.remove('hidden');

        // 1. Fetch Location info via reverse geocoding
        var regName = document.getElementById('an-region-name');
        var regState = document.getElementById('an-region-state');
        var regArea = document.getElementById('an-region-area');

        if (regName) regName.textContent = 'Locating Area...';

        if (window.GeoClixCoordinates) {
            var info = await GeoClixCoordinates.reverseGeocode(lat, lng);
            if (regName) regName.textContent = info.name;
            if (regState) regState.textContent = info.state + ', ' + info.country;
            if (regArea) regArea.textContent = 'Coordinates: ' + lat.toFixed(4) + '°, ' + lng.toFixed(4) + '°';

            GeoClixCoordinates.updateCoordinateDisplays(lat, lng);
        }

        // 2. Fetch and populate weather / AQI in analysis sidebar
        if (window.GeoClixWeather) {
            GeoClixWeather.updateAnalysisWeather(lat, lng);
        }

        // 3. Render Forest Cover Trend Chart (Gain vs Loss 2016-2026)
        if (window.GeoClixCharts) {
            if (forestTrendChartInstance) {
                GeoClixCharts.destroyChart(forestTrendChartInstance);
            }
            forestTrendChartInstance = GeoClixCharts.initForestTrendChart(lat, lng);
        }

        // 4. Initialize Split-View Satellite Maps
        if (window.GeoClixAnalysis) {
            GeoClixAnalysis.init(lat, lng);

            var maps = GeoClixAnalysis.getAnalysisMaps();
            if (maps && maps.nowMap) {
                // Initialize Timelapse playback with selected coordinates
                if (window.GeoClixTimelapse) {
                    GeoClixTimelapse.init(maps.nowMap, lat, lng);
                }
                // Initialize AI super-resolution enhancement
                if (window.GeoClixEnhance) {
                    GeoClixEnhance.init(maps.nowMap);
                }
            }
        }

        showToast('Viewing Sentinel satellite analysis for selected region', '🛰️', 3000);
    }

    /**
     * Closes the Detailed Analysis View.
     */
    function closeAnalysis() {
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
     * Toast notification utility.
     */
    function setupToast() {
        var toast = document.getElementById('toast');
        var toastClose = document.getElementById('toast-close');
        if (toastClose && toast) {
            toastClose.addEventListener('click', function () {
                toast.classList.add('hidden');
            });
        }
    }

    var toastTimeout = null;
    function showToast(message, icon, duration) {
        var toast = document.getElementById('toast');
        var toastMsg = document.getElementById('toast-message');
        var toastIco = document.getElementById('toast-icon');

        if (!toast || !toastMsg) return;

        if (toastIco) toastIco.textContent = icon || '🌿';
        toastMsg.textContent = message;

        toast.classList.remove('hidden');

        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(function () {
            toast.classList.add('hidden');
        }, duration || 4000);
    }

    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        init: init,
        openAnalysis: openAnalysis,
        closeAnalysis: closeAnalysis,
        showToast: showToast
    };
})();

window.GeoClixApp = GeoClixApp;
