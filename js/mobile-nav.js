// ═══════════════════════════════════════════
// NAVEGACIÓN MÓVIL - Compartido entre páginas
// ═══════════════════════════════════════════

function toggleMobileMenu() {
    var nav = document.getElementById('mobileNav');
    var btn = document.getElementById('menuToggle');
    if (nav) nav.classList.toggle('active');
    if (btn) btn.classList.toggle('active');
}

// Preloader hide
window.addEventListener('load', function () {
    var preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(function () { preloader.style.display = 'none'; }, 300);
    }
});
