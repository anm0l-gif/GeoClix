/**
 * GeoClix Configuration
 * ──────────────────────────────────────────────────────────────────────────
 * SECURITY NOTE
 * ──────────────────────────────────────────────────────────────────────────
 * Never put private API keys in this file or any other browser-delivered
 * asset.  Values in frontend JavaScript are public to every visitor.  For
 * production, route authenticated calls through a server-side proxy and
 * expose only the proxy URL to the browser.
 *
 * 1. OPENWEATHER_API_KEY
 *    → https://home.openweathermap.org/api_keys
 *    Sign up free → go to "API Keys" tab → copy the default key.
 *    Free tier: 1,000 calls/day. No credit card needed.
 *
 * 2. FIRMS_API_KEY
 *    → https://firms.modaps.eosdis.nasa.gov/api/area/
 *    Click "Get API Key" at the top → enter your email → instant.
 *    Free tier: Unlimited calls.
 *
 * 3. SENTINEL_HUB_INSTANCE_ID
 *    → https://apps.sentinel-hub.com/dashboard
 *    Register (free research account) → Configuration → "+" New Configuration
 *    → copy the Instance ID shown.
 *    Free tier: 30,000 processing units/month.
 *
 * Leave any key as '' to run in DEMO MODE (mock data used as fallback).
 * ──────────────────────────────────────────────────────────────────────────
 */
const GEOCLIX_RUNTIME_CONFIG = window.GEOCLIX_RUNTIME_CONFIG || {};

const GEOCLIX_CONFIG = {
    // These remain empty in the static app. Do not set them in a checked-in
    // file: a client-side key is not secret. Use a server-side proxy instead.
    OPENWEATHER_API_KEY: '',
    FIRMS_API_KEY: '',

    // Open Elevation API — Free, no key needed
    ELEVATION_API: 'https://api.open-elevation.com/api/v1/lookup',

    PLANET_API_KEY: '',
    SENTINEL_HUB_INSTANCE_ID: '',

    // A deployment may inject this non-secret URL at runtime. The proxy owns
    // provider keys, rate limiting, caching, and request validation.
    API_PROXY_BASE: GEOCLIX_RUNTIME_CONFIG.API_PROXY_BASE || '',

    // Map defaults — Center of India
    DEFAULT_CENTER: [22.5, 82.5],
    DEFAULT_ZOOM: 5,
    MIN_ZOOM: 4,
    MAX_ZOOM: 18,

    // India bounding box [SW, NE]
    INDIA_BOUNDS: [[6.5, 68.0], [35.5, 97.5]],

    // Tile servers (all free, no key required)
    TILES: {
        satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        terrain: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        topo: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
    },

    // Sentinel-2 / Modern High-Resolution Satellite Mosaic (fast, global CDN, no key needed)
    SENTINEL2_TILES: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',

    // Historical vs Recent imagery for comparison & timelapse (pre-2020 uses ArcGIS, 2020+ uses modern satellite pass)
    TIMELAPSE_TILES: {
        historical: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        recent: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
    },

    // Data time range
    DATA_START_YEAR: 2016,
    DATA_END_YEAR: 2026,

    // Auto-refresh intervals (ms)
    WEATHER_UPDATE_INTERVAL: 300000,  // 5 minutes
    FIRE_UPDATE_INTERVAL: 3600000, // 1 hour

    // Demo mode: automatically true when API keys are missing
    get DEMO_MODE() {
        return !this.OPENWEATHER_API_KEY && !this.FIRMS_API_KEY;
    }
};
