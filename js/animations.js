/**
 * GeoClixAnimations — GSAP & Canvas Visual Effects Module
 * Powers preloader, hero entrance, floating embers canvas,
 * scroll-triggered card reveals, and statistics counters.
 *
 * @module GeoClixAnimations
 */
var GeoClixAnimations = (function () {
    'use strict';

    /**
     * Preloader sequence.
     */
    function playPreloader(onComplete) {
        var preloader = document.getElementById('preloader');
        var fill = document.querySelector('.loader-fill');
        var text = document.querySelector('.loader-text');

        if (!preloader) {
            if (typeof onComplete === 'function') onComplete();
            return;
        }

        var progress = 0;
        var steps = [
            { at: 25, msg: 'Connecting to Copernicus Sentinel-2...' },
            { at: 55, msg: 'Calibrating Sentinel-1 SAR Radar...' },
            { at: 80, msg: 'Analyzing 10-Year LandTrendr Trajectories...' },
            { at: 100, msg: 'AI Cross-Verification Online ✓' }
        ];

        var interval = setInterval(function () {
            progress += 3;
            if (fill) fill.style.width = Math.min(progress, 100) + '%';

            for (var i = 0; i < steps.length; i++) {
                if (progress >= steps[i].at && text) {
                    text.textContent = steps[i].msg;
                }
            }

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(function () {
                    preloader.classList.add('fade-out');
                    setTimeout(function () {
                        preloader.style.display = 'none';
                        if (typeof onComplete === 'function') onComplete();
                    }, 800);
                }, 400);
            }
        }, 50);
    }

    /**
     * Hero entrance animation.
     */
    function playHeroEntrance() {
        if (typeof gsap !== 'undefined') {
            var tl = gsap.timeline();

            tl.from('.hero-subtitle', {
                opacity: 0,
                y: -15,
                duration: 0.6,
                ease: 'power2.out'
            })
            .from('.title-line', {
                opacity: 0,
                y: 30,
                duration: 0.8,
                stagger: 0.18,
                ease: 'power3.out'
            }, '-=0.3')
            .from('.hero-description', {
                opacity: 0,
                y: 20,
                duration: 0.6,
                ease: 'power2.out'
            }, '-=0.4')
            .from('.hero-buttons .btn', {
                opacity: 0,
                scale: 0.9,
                y: 15,
                duration: 0.5,
                stagger: 0.12,
                ease: 'back.out(1.7)'
            }, '-=0.3')
            .from('.satellite-1', {
                opacity: 0,
                x: 80,
                y: -40,
                duration: 1.2,
                ease: 'power3.out'
            }, '-=0.8')
            .from('.alert-card', {
                opacity: 0,
                x: 60,
                scale: 0.9,
                duration: 0.8,
                ease: 'power2.out'
            }, '-=0.6')
            .from('.warning-icon', {
                opacity: 0,
                scale: 0,
                duration: 0.5,
                stagger: 0.15,
                ease: 'back.out(2)'
            }, '-=0.5')
            .from('.hero-stats .stat-item', {
                opacity: 0,
                y: 20,
                duration: 0.6,
                stagger: 0.15,
                ease: 'power2.out',
                onComplete: animateCounters
            }, '-=0.4');
        } else {
            // Fallback without GSAP
            animateCounters();
        }
    }

    /**
     * Numbers count-up animation for stats.
     */
    function animateCounters() {
        var counters = document.querySelectorAll('[data-count]');
        counters.forEach(function (counter) {
            var target = parseInt(counter.getAttribute('data-count'), 10) || 0;
            var current = 0;
            var step = Math.max(1, Math.floor(target / 45));
            var interval = setInterval(function () {
                current += step;
                if (current >= target) {
                    counter.textContent = target.toLocaleString();
                    clearInterval(interval);
                } else {
                    counter.textContent = current.toLocaleString();
                }
            }, 30);
        });
    }

    /**
     * Canvas subtle floating particles for the hero background.
     */
    function initHeroParticles() {
        var canvas = document.getElementById('hero-particles');
        if (!canvas) return;

        var ctx = canvas.getContext('2d');
        var width, height;
        var particles = [];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        for (var i = 0; i < 45; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: Math.random() * 2 + 0.5,
                vx: (Math.random() - 0.5) * 0.4,
                vy: -Math.random() * 0.6 - 0.2, // Drifting upwards like embers
                alpha: Math.random() * 0.7 + 0.2,
                color: Math.random() > 0.6 ? '#4ade80' : '#f59e0b'
            });
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            for (var j = 0; j < particles.length; j++) {
                var p = particles[j];
                p.x += p.vx;
                p.y += p.vy;

                if (p.y < 0) {
                    p.y = height + 10;
                    p.x = Math.random() * width;
                }
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.shadowBlur = 8;
                ctx.shadowColor = p.color;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            requestAnimationFrame(draw);
        }
        draw();
    }

    /**
     * Scroll-triggered reveals.
     */
    function initScrollTriggers() {
        var navbar = document.getElementById('navbar');
        window.addEventListener('scroll', function () {
            if (window.scrollY > 80) {
                if (navbar) navbar.classList.add('scrolled');
            } else {
                if (navbar) navbar.classList.remove('scrolled');
            }
        });

        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
        }
    }

    return {
        playPreloader: playPreloader,
        playHeroEntrance: playHeroEntrance,
        initHeroParticles: initHeroParticles,
        initScrollTriggers: initScrollTriggers
    };
})();

window.GeoClixAnimations = GeoClixAnimations;
