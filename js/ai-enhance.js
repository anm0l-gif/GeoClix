/**
 * GeoClixEnhance — AI Super-Resolution Enhance Module
 * Applies a visual enhancement preview to satellite tiles; it is not
 * super-resolution or model inference.
 * Uses CSS filter enhancement (contrast + sharpness) instead of
 * zoom-offset trick, preventing tile distortion/pixelation.
 *
 * @module GeoClixEnhance
 */
var GeoClixEnhance = (function () {
    'use strict';

    /** @type {L.Map|null} Reference to the "Now" analysis map */
    var map = null;

    /** @type {boolean} Whether enhancement is currently applied */
    var isEnhanced = false;

    /** @type {HTMLElement|null} The map container element */
    var mapContainer = null;
    var enhanceClickHandler = null;

    // SVG sharpening filter ID
    var SVG_FILTER_ID = 'geoclix-sharpen-filter';

    // CSS filter applied to the map pane when enhanced
    var ENHANCE_FILTER = 'contrast(1.18) saturate(1.22) brightness(1.04)';
    var NORMAL_FILTER  = '';

    // ── Progress Messages ────────────────────────────────────────────────

    var PROGRESS_MESSAGES = [
        'Analyzing satellite tiles…',
        'Preparing image preview…',
        'Adjusting contrast and colour…',
        'Applying visual sharpening…',
        'Sharpening fine details…',
        'Enhanced ✓ — visual preview applied'
    ];

    // ─── DOM Helpers ─────────────────────────────────────────────────────

    function getElements() {
        return {
            btn:     document.getElementById('enhance-btn'),
            text:    document.querySelector('#enhance-btn .enhance-btn-text'),
            spinner: document.getElementById('enhance-spinner'),
            status:  document.getElementById('enhance-status')
        };
    }

    function toggleSpinner(show) {
        var els = getElements();
        if (els.spinner) els.spinner.classList.toggle('hidden', !show);
        if (els.text)    els.text.style.opacity = show ? '0.3' : '1';
    }

    function setStatus(msg) {
        var els = getElements();
        if (els.status) els.status.textContent = msg;
    }

    function setButtonLabel(label) {
        var els = getElements();
        if (els.text) els.text.textContent = label;
    }

    // ─── SVG Sharpening Filter ───────────────────────────────────────────

    /**
     * Injects an SVG feConvolveMatrix sharpening filter into the document.
     * This is a proper sharpening convolution kernel (unsharp-mask style).
     */
    function injectSharpenFilter() {
        if (document.getElementById(SVG_FILTER_ID)) return; // already injected

        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('xmlns', svgNS);
        svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden';

        var defs = document.createElementNS(svgNS, 'defs');
        var filter = document.createElementNS(svgNS, 'filter');
        filter.setAttribute('id', SVG_FILTER_ID);
        filter.setAttribute('color-interpolation-filters', 'sRGB');

        // Unsharp mask: sharpen kernel
        var convolve = document.createElementNS(svgNS, 'feConvolveMatrix');
        convolve.setAttribute('order', '3');
        convolve.setAttribute('kernelMatrix', '0 -0.5 0   -0.5 3 -0.5   0 -0.5 0');
        convolve.setAttribute('divisor', '1');
        convolve.setAttribute('bias', '0');
        convolve.setAttribute('preserveAlpha', 'true');

        filter.appendChild(convolve);
        defs.appendChild(filter);
        svg.appendChild(defs);
        document.body.appendChild(svg);
    }

    /**
     * Applies the SVG sharpen filter and CSS enhancements to the map container.
     */
    function applyEnhancement() {
        if (!mapContainer) return;
        // CSS brightness/contrast/saturation boost
        mapContainer.style.filter = ENHANCE_FILTER;
        // SVG sharpening via filter URL (Leaflet renders into a pane div)
        var pane = mapContainer.querySelector('.leaflet-tile-pane');
        if (pane) {
            pane.style.filter = 'url(#' + SVG_FILTER_ID + ')';
        }
    }

    /**
     * Removes all enhancement filters.
     */
    function removeEnhancement() {
        if (!mapContainer) return;
        mapContainer.style.filter = NORMAL_FILTER;
        var pane = mapContainer.querySelector('.leaflet-tile-pane');
        if (pane) {
            pane.style.filter = '';
        }
    }

    // ─── Simulated Processing ────────────────────────────────────────────

    function simulateProcessing() {
        return new Promise(function (resolve) {
            var i = 0;
            var interval = setInterval(function () {
                if (i < PROGRESS_MESSAGES.length) {
                    setStatus(PROGRESS_MESSAGES[i]);
                    i++;
                } else {
                    clearInterval(interval);
                    resolve();
                }
            }, 450);
        });
    }

    // ─── Enhance / Reset ─────────────────────────────────────────────────

    function enhance() {
        if (isEnhanced || !map) return Promise.resolve();

        var els = getElements();
        if (els.btn) els.btn.disabled = true;
        toggleSpinner(true);
        setStatus('');

        return simulateProcessing().then(function () {
            try {
                applyEnhancement();
                isEnhanced = true;
                toggleSpinner(false);
                setButtonLabel('Reset to Original');
                if (els.btn) els.btn.disabled = false;
                console.info('[GeoClixEnhance] CSS filter enhancement applied');
            } catch (e) {
                console.warn('[GeoClixEnhance] enhance error:', e);
                toggleSpinner(false);
                setStatus('Enhancement failed — try again');
                if (els.btn) els.btn.disabled = false;
            }
        });
    }

    function reset() {
        if (!isEnhanced || !map) return;
        try {
            removeEnhancement();
            isEnhanced = false;
            setButtonLabel('Upscale Imagery');
            setStatus('');
            console.info('[GeoClixEnhance] Reset to original resolution');
        } catch (e) {
            console.warn('[GeoClixEnhance] reset error:', e);
        }
    }

    // ─── Init ────────────────────────────────────────────────────────────

    function init(mapInstance) {
        map = mapInstance;
        isEnhanced = false;

        // Get the map container element for filter application
        if (map && map.getContainer) {
            mapContainer = map.getContainer();
        } else {
            mapContainer = document.getElementById('now-map');
        }

        // Inject the SVG sharpening filter into the DOM (once)
        injectSharpenFilter();

        var els = getElements();
        if (els.btn) {
            if (enhanceClickHandler) els.btn.removeEventListener('click', enhanceClickHandler);
            enhanceClickHandler = function () {
                if (isEnhanced) { reset(); } else { enhance(); }
            };
            els.btn.addEventListener('click', enhanceClickHandler);
        }

        setButtonLabel('Upscale Imagery');
        setStatus('');
        console.info('[GeoClixEnhance] Initialised with CSS filter approach');
    }

    function destroy() {
        reset();
        var els = getElements();
        if (els.btn && enhanceClickHandler) els.btn.removeEventListener('click', enhanceClickHandler);
        enhanceClickHandler = null;
        map = null;
        mapContainer = null;
    }

    // ─── Public API ──────────────────────────────────────────────────────
    return {
        init:    init,
        enhance: enhance,
        reset:   reset,
        destroy: destroy
    };
})();

window.GeoClixEnhance = GeoClixEnhance;
