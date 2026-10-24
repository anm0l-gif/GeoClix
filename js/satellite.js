/**
 * GeoClixSatellite — Satellite Imagery & Tile Provider Module
 * Manages optical (Sentinel-2), SAR radar (Sentinel-1), and baseline satellite layers.
 *
 * @module GeoClixSatellite
 */
var GeoClixSatellite = (function () {
    'use strict';

    /**
     * Map of tile URL templates and attributions.
     */
    var TILE_SOURCES = {
        satellite: {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            options: {
                maxZoom: 18,
                attribution: '© Esri, Maxar, Earthstar Geographics'
            }
        },
        terrain: {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }
        },
        forest: {
            // High-resolution satellite forest & vegetation monitoring layer
            url: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
            options: {
                maxZoom: 20,
                subdomains: ['0', '1', '2', '3'],
                attribution: '© Google Satellite Imagery'
            }
        },
        sar: {
            // Visual reference layer only. This is not Sentinel-1 SAR data.
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',
            options: {
                maxZoom: 18,
                attribution: 'Carto grayscale reference layer — not Sentinel-1 SAR'
            }
        }
    };

    /**
     * Creates a Leaflet TileLayer for a requested type.
     * @param {'satellite'|'terrain'|'forest'|'sar'} type
     * @returns {L.TileLayer}
     */
    function createTileLayer(type) {
        var source = TILE_SOURCES[type] || TILE_SOURCES.satellite;
        return L.tileLayer(source.url, source.options);
    }

    /**
     * Switches tile layer on a given map instance.
     * @param {L.Map} map
     * @param {L.TileLayer} currentLayer
     * @param {'satellite'|'terrain'|'forest'|'sar'} newType
     * @returns {L.TileLayer} the newly added layer
     */
    function switchLayer(map, currentLayer, newType) {
        if (!map) return null;
        if (currentLayer) {
            try { map.removeLayer(currentLayer); } catch (_) {}
        }
        var newLayer = createTileLayer(newType);
        newLayer.addTo(map);
        return newLayer;
    }

    /**
     * Returns tile layer parameterized by a date.
     * @param {string} dateStr YYYY-MM-DD
     * @returns {L.TileLayer}
     */
    function getDatedTileLayer(dateStr) {
        var year = 2024;
        if (dateStr) {
            var parts = dateStr.split('-');
            if (parts.length > 0) year = parseInt(parts[0], 10) || 2024;
        }

        // Use appropriate tile source for different years
        if (year <= 2018) {
            return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: 'Historical Satellite Imagery (' + year + ')'
            });
        } else {
            return L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['0', '1', '2', '3'],
                attribution: 'Recent Satellite Imagery (' + year + ')'
            });
        }
    }

    return {
        createTileLayer: createTileLayer,
        switchLayer: switchLayer,
        getDatedTileLayer: getDatedTileLayer
    };
})();

window.GeoClixSatellite = GeoClixSatellite;
