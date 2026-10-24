/* Shared light/dark theme controller. Uses the device preference until a
 * visitor deliberately chooses a theme, then remembers that choice. */
(function () {
    'use strict';

    var storageKey = 'geoclix-theme';
    var mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    function preferredTheme() {
        try {
            var saved = localStorage.getItem(storageKey);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch (_) {}
        return mediaQuery && mediaQuery.matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            var nextTheme = theme === 'dark' ? 'light' : 'dark';
            button.setAttribute('aria-pressed', String(theme === 'dark'));
            button.setAttribute('aria-label', 'Switch to ' + nextTheme + ' mode');
            button.title = 'Switch to ' + nextTheme + ' mode';
            button.querySelector('.theme-toggle-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
            button.querySelector('.theme-toggle-label').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
        });
    }

    function init() {
        applyTheme(preferredTheme());
        document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
            button.addEventListener('click', function () {
                var current = document.documentElement.getAttribute('data-theme') || preferredTheme();
                var next = current === 'dark' ? 'light' : 'dark';
                try { localStorage.setItem(storageKey, next); } catch (_) {}
                applyTheme(next);
            });
        });
        if (mediaQuery && mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', function (event) {
                try { if (localStorage.getItem(storageKey)) return; } catch (_) {}
                applyTheme(event.matches ? 'dark' : 'light');
            });
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
