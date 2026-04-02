// ═══════════════════════════════════════════
// NAVEGACIÓN MÓVIL - Compartido entre páginas
// ═══════════════════════════════════════════

function toggleMobileMenu() {
    var nav = document.getElementById('mobileNav');
    var btn = document.getElementById('menuToggle');
    if (nav) nav.classList.toggle('active');
    if (btn) btn.classList.toggle('active');
}

// Lógica de Mega Menú para dispositivos táctiles
document.addEventListener('DOMContentLoaded', function () {
    const mainNav = document.getElementById('mainNav');
    const megaMenu = document.getElementById('megaMenu');

    if (mainNav && megaMenu) {
        // Detectar si es un dispositivo táctil
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

        if (isTouch) {
            mainNav.addEventListener('click', function (e) {
                const trigger = e.target.closest('.nav-item-has-mega');
                if (trigger) {
                    // En móvil, el primer toque expande el menú en lugar de navegar
                    e.preventDefault();
                    e.stopPropagation();
                    megaMenu.classList.toggle('active');
                    
                    // Si se abre, asegurar que el scroll esté arriba
                    if (megaMenu.classList.contains('active')) {
                        megaMenu.scrollTop = 0;
                    }
                }
            });

            // Cerrar el mega menú si se toca fuera
            document.addEventListener('click', function (e) {
                if (!megaMenu.contains(e.target) && !mainNav.contains(e.target)) {
                    megaMenu.classList.remove('active');
                }
            });
        }
    }
});

// Preloader hide
window.addEventListener('load', function () {
    var preloader = document.getElementById('preloader');
    if (preloader) {
        preloader.style.opacity = '0';
        setTimeout(function () { preloader.style.display = 'none'; }, 300);
    }
});
