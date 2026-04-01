// ===== UTILITY =====
function scrollTo(sel) {
    document.querySelector(sel).scrollIntoView({ behavior: 'smooth' });
}

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
    });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ===== NAV ACTIVE STATE =====
const sections = document.querySelectorAll('section[id]');
const navBtns = document.querySelectorAll('.nav-btn');
const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            navBtns.forEach(b => b.classList.remove('active'));
            const id = e.target.id;
            navBtns.forEach(b => {
                if (b.getAttribute('onclick')?.includes(id)) b.classList.add('active');
            });
        }
    });
}, { threshold: 0.4 });
sections.forEach(s => navObserver.observe(s));

// ===== HERO CANVAS: Floating context particles =====
(function() {
    const c = document.getElementById('heroCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    let W, H;
    function resize() { W = c.width = c.offsetWidth; H = c.height = c.offsetHeight; }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * 2000, y: Math.random() * 2000,
            vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
            r: 1.5 + Math.random() * 2.5,
            hue: 190 + Math.random() * 80,
            alpha: 0.2 + Math.random() * 0.4
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
            ctx.fill();
        });
        // connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(56, 189, 248, ${0.08 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
})();