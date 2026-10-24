/**
 * GeoClixTimelapse — Historical Timelapse Playback Module
 * Cycles through years (2016→2026) on the analysis "Now" map,
 * swapping satellite tile providers and re-centering on the selected
 * lat/lng each year to simulate historical imagery playback.
 *
 * @module GeoClixTimelapse
 */
var GeoClixTimelapse = (function () {
    'use strict';

    /** @type {L.Map|null} The "Now" map instance from GeoClixAnalysis */
    var map = null;

    /** @type {number} Stored latitude of selected location */
    var _lat = 22.5;
    /** @type {number} Stored longitude of selected location */
    var _lng = 82.5;
    /** @type {number} Zoom level to use when re-centering */
    var _zoom = 12;

    /** @type {number|null} setInterval id for playback */
    var playbackTimer = null;

    /** @type {boolean} Whether timelapse is currently playing */
    var isPlaying = false;

    /** @type {number} Current year being displayed */
    var currentYear = 2016;

    /** @type {number} Playback interval in milliseconds */
    var playbackInterval = 1000;
    var completionTimer = null;
    var RESTORE_DELAY = 7500;

    var START_YEAR = 2016;
    var END_YEAR   = 2026;

    /** @type {L.TileLayer|null} Current timelapse tile layer */
    var currentTileLayer = null;

    // Track event handlers for cleanup
    var _cleanupFns = [];

    // ─── Tile Helpers ────────────────────────────────────────────────────

    /**
     * Returns a tile URL appropriate for the given year.
     * Pre-2020: ArcGIS World Imagery (older base)
     * 2020+:    Modern High-Resolution Satellite mosaic
     * This creates a visible visual difference between historical and recent imagery.
     * @param {number} year
     * @returns {string}
     */
    function tileUrlForYear(year) {
        if (year < 2020) {
            // Historical: ArcGIS World Imagery (slightly different rendering, warmer tones)
            return (GEOCLIX_CONFIG && GEOCLIX_CONFIG.TIMELAPSE_TILES && GEOCLIX_CONFIG.TIMELAPSE_TILES.historical)
                || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        } else {
            // Recent: Modern Satellite mosaic (crisper, cooler tones)
            return (GEOCLIX_CONFIG && GEOCLIX_CONFIG.TIMELAPSE_TILES && GEOCLIX_CONFIG.TIMELAPSE_TILES.recent)
                || (GEOCLIX_CONFIG && GEOCLIX_CONFIG.SENTINEL2_TILES)
                || 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
        }
    }

    /**
     * Swaps the tile layer to show the given year AND re-centers
     * the map on the originally selected lat/lng.
     * @param {number} year
     */
    function swapTiles(year) {
        if (!map) return;
        try {
            if (currentTileLayer) {
                map.removeLayer(currentTileLayer);
            }
            var tileUrl = tileUrlForYear(year);
            var tileOpts = {
                maxZoom:     (GEOCLIX_CONFIG && GEOCLIX_CONFIG.MAX_ZOOM) || 19,
                attribution: '© Satellite Imagery (' + year + ')',
                className:   'timelapse-tile-fade'
            };
            if (tileUrl.indexOf('google') !== -1) {
                tileOpts.subdomains = ['0', '1', '2', '3'];
                tileOpts.maxZoom = 20;
            }
            currentTileLayer = L.tileLayer(tileUrl, tileOpts);
            currentTileLayer.addTo(map);

            // Re-center on the selected location for this year
            map.setView([_lat, _lng], _zoom, { animate: false });

        } catch (e) {
            console.warn('[GeoClixTimelapse] swapTiles error:', e);
        }
    }

    // ─── UI Update ───────────────────────────────────────────────────────

    /**
     * Updates slider position and year label.
     * @param {number} year
     */
    function updateUI(year) {
        var slider   = document.getElementById('tl-slider');
        var yearDisp = document.getElementById('tl-current-year');
        if (slider)   slider.value        = year;
        if (yearDisp) yearDisp.textContent = year;
    }

    /**
     * Updates the play/pause button icon.
     * @param {boolean} playing
     */
    function updatePlayButton(playing) {
        var btn = document.getElementById('tl-play');
        if (btn) {
            btn.textContent = playing ? '⏸' : '▶';
            btn.title       = playing ? 'Pause' : 'Play';
        }
    }

    // ─── Playback Controls ───────────────────────────────────────────────

    /**
     * Sets the timelapse to a specific year, swapping tiles and recentering.
     * @param {number} year
     */
    function setYear(year) {
        year = Math.max(START_YEAR, Math.min(END_YEAR, year));
        currentYear = year;
        swapTiles(year);
        updateUI(year);
    }

    /**
     * Starts one timelapse run. The comparison is temporarily replaced by the
     * full-width timelapse map and restored 7.5 seconds after completion.
     */
    function play() {
        if (isPlaying) return;
        clearTimeout(completionTimer);
        completionTimer = null;
        setTimelapseMode(true);
        isPlaying = true;
        updatePlayButton(true);

        playbackTimer = setInterval(function () {
            if (currentYear >= END_YEAR) {
                pause(false);
                completionTimer = setTimeout(function () {
                    setTimelapseMode(false);
                    completionTimer = null;
                }, RESTORE_DELAY);
                return;
            }
            setYear(currentYear + 1);
        }, playbackInterval);
    }

    /**
     * Pauses the timelapse playback.
     */
    function pause(restoreComparison) {
        isPlaying = false;
        updatePlayButton(false);
        if (playbackTimer) {
            clearInterval(playbackTimer);
            playbackTimer = null;
        }
        if (restoreComparison !== false) {
            clearTimeout(completionTimer);
            completionTimer = null;
            setTimelapseMode(false);
        }
    }

    function setTimelapseMode(active) {
        var analysisView = document.getElementById('analysis-view');
        if (analysisView) analysisView.classList.toggle('timelapse-active', active);
        setTimeout(function () {
            if (map) map.invalidateSize();
            if (window.GeoClixAnalysis) {
                var maps = GeoClixAnalysis.getAnalysisMaps();
                if (maps.thenMap) maps.thenMap.invalidateSize();
                if (maps.nowMap) maps.nowMap.invalidateSize();
            }
        }, 50);
    }

    /**
     * Sets playback speed (1=slow/2000ms, 10=fast/200ms).
     * @param {number} speed
     */
    function setSpeed(speed) {
        speed = Math.max(1, Math.min(10, speed));
        playbackInterval = 2200 - speed * 200;
        if (isPlaying) { pause(); play(); }
    }

    // ─── Init ────────────────────────────────────────────────────────────

    /**
     * Initialises the timelapse module.
     * @param {L.Map} mapInstance  The analysis "Now" map
     * @param {number} [lat]       Selected latitude (centres timelapse here)
     * @param {number} [lng]       Selected longitude
     */
    function init(mapInstance, lat, lng) {
        map  = mapInstance;
        _lat = (typeof lat === 'number' && !isNaN(lat)) ? lat : 22.5;
        _lng = (typeof lng === 'number' && !isNaN(lng)) ? lng : 82.5;
        _zoom = map ? (map.getZoom() || 12) : 12;

        currentYear = START_YEAR;
        isPlaying   = false;

        var configStart = (GEOCLIX_CONFIG && GEOCLIX_CONFIG.DATA_START_YEAR) || 2016;
        var configEnd   = (GEOCLIX_CONFIG && GEOCLIX_CONFIG.DATA_END_YEAR)   || 2026;
        START_YEAR  = configStart;
        END_YEAR    = configEnd;
        currentYear = START_YEAR;

        updateUI(currentYear);
        updatePlayButton(false);

        // ── Button handlers ──
        var playBtn = document.getElementById('tl-play');
        var prevBtn = document.getElementById('tl-prev');
        var nextBtn = document.getElementById('tl-next');
        var slider  = document.getElementById('tl-slider');

        if (playBtn) {
            var playHandler = function () { isPlaying ? pause() : play(); };
            playBtn.addEventListener('click', playHandler);
            _cleanupFns.push(function () { playBtn.removeEventListener('click', playHandler); });
        }

        if (prevBtn) {
            var prevHandler = function () {
                pause();
                setYear(currentYear - 1 < START_YEAR ? END_YEAR : currentYear - 1);
            };
            prevBtn.addEventListener('click', prevHandler);
            _cleanupFns.push(function () { prevBtn.removeEventListener('click', prevHandler); });
        }

        if (nextBtn) {
            var nextHandler = function () {
                pause();
                setYear(currentYear + 1 > END_YEAR ? START_YEAR : currentYear + 1);
            };
            nextBtn.addEventListener('click', nextHandler);
            _cleanupFns.push(function () { nextBtn.removeEventListener('click', nextHandler); });
        }

        if (slider) {
            slider.min   = START_YEAR;
            slider.max   = END_YEAR;
            slider.value = currentYear;
            var sliderHandler = function () {
                pause();
                setYear(parseInt(slider.value, 10));
            };
            slider.addEventListener('input', sliderHandler);
            _cleanupFns.push(function () { slider.removeEventListener('input', sliderHandler); });
        }

        console.info('[GeoClixTimelapse] Initialised at', _lat, _lng, '| years', START_YEAR, '→', END_YEAR);
    }

    // ─── Destroy ─────────────────────────────────────────────────────────

    function destroyTimelapse() {
        pause();
        _cleanupFns.forEach(function (fn) { try { fn(); } catch (_) {} });
        _cleanupFns = [];

        if (currentTileLayer && map) {
            try { map.removeLayer(currentTileLayer); } catch (_) {}
        }
        currentTileLayer = null;
        map = null;
        setTimelapseMode(false);
    }

    // ─── Public API ──────────────────────────────────────────────────────
    return {
        init:    init,
        play:    play,
        pause:   pause,
        setYear: setYear,
        destroy: destroyTimelapse
    };
})();

window.GeoClixTimelapse = GeoClixTimelapse;
