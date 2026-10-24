/**
 * GeoClixCharts — Chart & Data Visualisation Module
 * Uses Chart.js (global `Chart`) for trend lines and forest dashboards.
 * Generates deterministic, location-specific mock data from coordinates.
 *
 * @module GeoClixCharts
 */
var GeoClixCharts = (function () {
    'use strict';

    /** @type {Chart|null} Singleton chart for the Insights section */
    var insightsChart = null;

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * Simple deterministic hash from lat/lng → integer seed.
     * @param {number} lat
     * @param {number} lng
     * @returns {number}
     */
    function coordSeed(lat, lng) {
        var raw = Math.abs(Math.round(lat * 1000) * 31 + Math.round(lng * 1000) * 17);
        return raw;
    }

    /**
     * Seeded pseudo-random (mulberry32).
     * @param {number} seed
     * @returns {function(): number} Returns [0, 1)
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
     * Generates deterministic but varied yearly data arrays seeded from
     * coordinates.  Returns {gain: number[], loss: number[]} for the
     * default year range.
     * @param {number} lat
     * @param {number} lng
     * @param {number[]} years
     * @returns {{gain: number[], loss: number[]}}
     */
    function generateLocationData(lat, lng, years) {
        var rng = seededRng(coordSeed(lat, lng));

        // Base values influenced by lat (northern hills tend to have more forest)
        var northFactor = Math.max(0, (lat - 10) / 25); // 0 → 1
        var baseGain = 50 + northFactor * 60;  // 50–110
        var baseLoss = 80 - northFactor * 30;  // 50–80

        var gain = [];
        var loss = [];
        for (var i = 0; i < years.length; i++) {
            gain.push(Math.round(baseGain + (rng() - 0.3) * 40));
            loss.push(Math.round(baseLoss + (rng() - 0.4) * 50));
        }
        return { gain: gain, loss: loss };
    }

    // ─── Year Range ──────────────────────────────────────────────────────

    /**
     * Returns array [2016, 2017, …, 2026].
     * @returns {number[]}
     */
    function getYears() {
        var start = (GEOCLIX_CONFIG && GEOCLIX_CONFIG.DATA_START_YEAR) || 2016;
        var end   = (GEOCLIX_CONFIG && GEOCLIX_CONFIG.DATA_END_YEAR)   || 2026;
        var arr = [];
        for (var y = start; y <= end; y++) arr.push(y);
        return arr;
    }

    // ─── Dark‐Theme Defaults ─────────────────────────────────────────────

    /** Shared dark-theme styling for Chart.js */
    var darkTheme = {
        gridColor:  'rgba(31, 47, 31, 0.6)',
        tickColor:  '#e2e8f0',
        fontFamily: "'Inter', 'Space Grotesk', sans-serif"
    };

    // ─── 1. Insights Trend Chart ─────────────────────────────────────────

    /**
     * Creates a line chart on `#insights-trend-chart` showing India-wide
     * Forest Cover (M ha) and Forest Loss (K ha) over 2016–2026.
     * Uses approximate, realistic India forestry data.
     * @returns {Chart|null}
     */
    function initInsightsChart() {
        var canvas = document.getElementById('insights-trend-chart');
        if (!canvas) { console.warn('[GeoClixCharts] #insights-trend-chart not found'); return null; }

        // Destroy previous instance
        if (insightsChart) { destroyChart(insightsChart); insightsChart = null; }

        var years = getYears();

        // Approximate India data: forest cover ~71–72.6 M ha trending up
        var forestCover = [71.0, 71.1, 71.2, 71.3, 71.4, 71.5, 71.7, 71.9, 72.1, 72.3, 72.6];
        // Forest loss ~2000→1400 K ha trending down
        var forestLoss  = [2000, 1920, 1830, 1770, 1700, 1640, 1580, 1530, 1480, 1440, 1400];

        // Trim to match years length
        forestCover = forestCover.slice(0, years.length);
        forestLoss  = forestLoss.slice(0, years.length);

        var ctx = canvas.getContext('2d');

        insightsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years.map(String),
                datasets: [
                    {
                        label: 'Forest Cover (M ha)',
                        data: forestCover,
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.12)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#4ade80',
                        pointBorderColor: '#0f1a0f',
                        pointBorderWidth: 2,
                        borderWidth: 2.5,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Forest Loss (K ha)',
                        data: forestLoss,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#0f1a0f',
                        pointBorderWidth: 2,
                        borderWidth: 2.5,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            font: { family: darkTheme.fontFamily, size: 12 },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 26, 15, 0.95)',
                        titleColor: '#4ade80',
                        bodyColor: '#e2e8f0',
                        borderColor: '#2d4a2d',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid:  { color: darkTheme.gridColor },
                        ticks: { color: darkTheme.tickColor, font: { family: darkTheme.fontFamily } }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Cover (M ha)', color: '#4ade80', font: { family: darkTheme.fontFamily } },
                        grid:  { color: darkTheme.gridColor },
                        ticks: { color: darkTheme.tickColor, font: { family: darkTheme.fontFamily } }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Loss (K ha)', color: '#ef4444', font: { family: darkTheme.fontFamily } },
                        grid:  { drawOnChartArea: false },
                        ticks: { color: darkTheme.tickColor, font: { family: darkTheme.fontFamily } }
                    }
                }
            }
        });

        return insightsChart;
    }

    // ─── 2. Forest Trend Chart (Analysis Sidebar) ────────────────────────

    /**
     * Creates a dual-dataset area chart on `#forest-chart` (analysis sidebar)
     * showing Forest Gain and Forest Loss for a given location.
     * @param {number} lat
     * @param {number} lng
     * @returns {Chart|null}
     */
    function initForestTrendChart(lat, lng) {
        var canvas = document.getElementById('forest-chart');
        if (!canvas) { console.warn('[GeoClixCharts] #forest-chart not found'); return null; }

        var years = getYears();
        var data  = generateLocationData(lat, lng, years);

        var ctx = canvas.getContext('2d');

        var chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years.map(String),
                datasets: [
                    {
                        label: 'Forest Gain',
                        data: data.gain,
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.18)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        pointBackgroundColor: '#4ade80',
                        borderWidth: 2
                    },
                    {
                        label: 'Forest Loss',
                        data: data.loss,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.14)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2,
                        pointBackgroundColor: '#ef4444',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 26, 15, 0.95)',
                        titleColor: '#4ade80',
                        bodyColor: '#e2e8f0',
                        borderColor: '#2d4a2d',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        grid:  { color: darkTheme.gridColor },
                        ticks: { color: darkTheme.tickColor, font: { size: 10, family: darkTheme.fontFamily }, maxRotation: 0 }
                    },
                    y: {
                        grid:  { color: darkTheme.gridColor },
                        ticks: { color: darkTheme.tickColor, font: { size: 10, family: darkTheme.fontFamily } },
                        beginAtZero: true
                    }
                },
                layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } }
            }
        });

        return chart;
    }

    // ─── 3. Destroy Chart Helper ─────────────────────────────────────────

    /**
     * Safely destroys a Chart.js instance.
     * @param {Chart|null} chartInstance
     */
    function destroyChart(chartInstance) {
        try {
            if (chartInstance && typeof chartInstance.destroy === 'function') {
                chartInstance.destroy();
            }
        } catch (e) {
            console.warn('[GeoClixCharts] destroyChart error:', e);
        }
    }

    // ─── 4. Forest Bars (Overview Sidebar) ───────────────────────────────

    /**
     * Updates the overview sidebar progress bars with location-based data.
     * - Forest Cover %   → `#ov-forest-bar` + `#ov-forest-pct`
     * - Tree Health NDVI → `#ov-ndvi-bar`   + `#ov-ndvi-val`
     * - Fire Risk        → `#ov-fire-bar`   + `#ov-fire-risk`
     * @param {number} lat
     * @param {number} lng
     */
    function updateForestBars(lat, lng) {
        try {
            var rng = seededRng(coordSeed(lat, lng) + 7);

            // Forest cover: 20–70%
            var forestPct  = Math.round(20 + rng() * 50);
            // NDVI: 0.30–0.80
            var ndviVal    = (0.3 + rng() * 0.5).toFixed(2);
            var ndviPct    = Math.round(parseFloat(ndviVal) * 100);
            // Fire risk
            var riskRand   = rng();
            var fireRisk, firePct, fireColor;
            if (riskRand < 0.4) {
                fireRisk = 'Low';     firePct = Math.round(10 + rng() * 20); fireColor = '#4ade80';
            } else if (riskRand < 0.75) {
                fireRisk = 'Medium';  firePct = Math.round(35 + rng() * 25); fireColor = '#facc15';
            } else {
                fireRisk = 'High';    firePct = Math.round(65 + rng() * 25); fireColor = '#ef4444';
            }

            // Animate bars
            var forestBar = document.getElementById('ov-forest-bar');
            var forestLbl = document.getElementById('ov-forest-pct');
            var ndviBar   = document.getElementById('ov-ndvi-bar');
            var ndviLbl   = document.getElementById('ov-ndvi-val');
            var fireBar   = document.getElementById('ov-fire-bar');
            var fireLbl   = document.getElementById('ov-fire-risk');

            if (forestBar) {
                forestBar.style.transition = 'width 0.8s ease';
                forestBar.style.width      = forestPct + '%';
            }
            if (forestLbl) forestLbl.textContent = forestPct + '%';

            if (ndviBar) {
                ndviBar.style.transition = 'width 0.8s ease';
                ndviBar.style.width      = ndviPct + '%';
            }
            if (ndviLbl) ndviLbl.textContent = ndviVal;

            if (fireBar) {
                fireBar.style.transition      = 'width 0.8s ease, background-color 0.6s ease';
                fireBar.style.width           = firePct + '%';
                fireBar.style.backgroundColor = fireColor;
            }
            if (fireLbl) fireLbl.textContent = fireRisk;

        } catch (e) {
            console.warn('[GeoClixCharts] updateForestBars error:', e);
        }
    }

    // ─── Public API ──────────────────────────────────────────────────────
    return {
        initInsightsChart:    initInsightsChart,
        initForestTrendChart: initForestTrendChart,
        destroyChart:         destroyChart,
        updateForestBars:     updateForestBars
    };
})();

window.GeoClixCharts = GeoClixCharts;
