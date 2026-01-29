// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - BLOG JS
// Versión: 2.0 OPTIMIZADA | Fecha: 22/12/2025
// Solución: TikTok con preview + botón (no embed lento)
// ═══════════════════════════════════════════════════════════════

const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// ═══════════════════════════════════════════════════════════════
// GENERADOR DE EMBEDS - OPTIMIZADO
// ═══════════════════════════════════════════════════════════════
function getVideoEmbed(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.trim();

    // ─────────────────────────────────────────────────────────────
    // YOUTUBE (normal + Shorts) - Funciona perfecto con iframe
    // ─────────────────────────────────────────────────────────────
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0].split('&')[0];
        } else if (url.includes('shorts/')) {
            videoId = url.split('shorts/')[1].split('?')[0];
        } else {
            const match = url.match(/[?&]v=([^&]+)/);
            videoId = match ? match[1] : '';
        }
        if (videoId) {
            return `
                <div class="video-container video-youtube">
                    <iframe 
                        src="https://www.youtube.com/embed/${videoId}?rel=0" 
                        title="Video de YouTube"
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen
                        loading="lazy">
                    </iframe>
                </div>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TIKTOK - iframe directo (más rápido que el embed oficial)
    // ─────────────────────────────────────────────────────────────
    const tiktokMatch = url.match(/tiktok\.com.*\/video\/(\d+)/);
    if (tiktokMatch) {
        const videoId = tiktokMatch[1];
        return `
            <div class="video-container video-tiktok">
                <iframe 
                    src="https://www.tiktok.com/embed/v2/${videoId}"
                    style="width:100%;height:100%;border:none;"
                    allowfullscreen
                    allow="encrypted-media"
                    loading="lazy">
                </iframe>
            </div>
        `;
    }

    // TikTok sin ID de video (fallback con botón)
    if (url.includes('tiktok.com')) {
        return `
            <div class="video-container video-tiktok-fallback">
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="tiktok-btn">
                    🎵 Ver video en TikTok
                </a>
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────────
    // INSTAGRAM Reels / Posts
    // ─────────────────────────────────────────────────────────────
    if (url.includes('instagram.com') && (url.includes('/reel/') || url.includes('/p/'))) {
        // Extraer el código del post/reel
        const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
        if (match) {
            const code = match[2];
            return `
                <div class="video-container video-instagram">
                    <iframe 
                        src="https://www.instagram.com/p/${code}/embed" 
                        frameborder="0" 
                        scrolling="no" 
                        allowtransparency="true"
                        loading="lazy">
                    </iframe>
                </div>
            `;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FACEBOOK Videos
    // ─────────────────────────────────────────────────────────────
    if (url.includes('facebook.com') && (url.includes('/videos/') || url.includes('/watch/'))) {
        return `
            <div class="video-container video-facebook">
                <iframe 
                    src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false" 
                    frameborder="0" 
                    scrolling="no" 
                    allowfullscreen="true"
                    loading="lazy">
                </iframe>
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────────
    // FALLBACK - Link directo
    // ─────────────────────────────────────────────────────────────
    return `
        <div class="video-container video-fallback">
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="video-link">
                🎬 Ver video en la plataforma original
            </a>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════
// CARGAR POSTS
// ═══════════════════════════════════════════════════════════════
async function cargarPosts() {
    const grid = document.getElementById('postsGrid');

    // Loading state
    grid.innerHTML = `
        <div class="blog-loading">
            <div class="spinner"></div>
            <p>Cargando publicaciones...</p>
        </div>
    `;

    try {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!posts || posts.length === 0) {
            grid.innerHTML = `
                <div class="blog-empty">
                    <div class="blog-empty-icon">📝</div>
                    <h2>Aún no hay publicaciones</h2>
                    <p>¡Pronto compartiremos contenido increíble para la familia motera!</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = posts.map(post => `
            <article class="blog-card">
                ${post.imagen_url && !post.video_url ? `
                    <div class="blog-card-image">
                        <img src="${post.imagen_url}" alt="${post.titulo}" loading="lazy" 
                             onerror="this.style.display='none'">
                    </div>
                ` : ''}
                
                ${post.video_url ? getVideoEmbed(post.video_url) : ''}
                
                <div class="blog-card-content">
                    <h2 class="blog-card-title">${post.titulo}</h2>
                    <p class="blog-card-text">${post.contenido}</p>
                    <div class="blog-card-meta">
                        <span class="blog-card-date">
                            📅 ${new Date(post.created_at).toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })}
                        </span>
                    </div>

                    <!-- SECCIÓN DE COMENTARIOS -->
                    <div class="blog-comments-section">
                        <h3 class="blog-comments-title">💬 Comentarios</h3>
                        
                        <div id="comentarios-${post.id}" class="blog-comments-list">
                            <div class="spinner-small"></div> Cargando comentarios...
                        </div>

                        <form class="blog-comment-form" onsubmit="enviarComentario(event, '${post.id}')">
                            <h4>Deja tu opinión</h4>
                            <div class="form-group">
                                <input type="text" id="nombre-${post.id}" placeholder="Tu nombre *" required>
                            </div>
                            <div class="form-group">
                                <input type="email" id="email-${post.id}" placeholder="Tu email (opcional)">
                            </div>
                            <div class="form-group">
                                <textarea id="comentario-${post.id}" placeholder="Escribe tu comentario... *" required></textarea>
                            </div>
                            <button type="submit" class="blog-comment-submit">Enviar Comentario</button>
                        </form>
                    </div>
                </div>
            </article>
        `).join('');

        // Cargar comentarios para cada post
        if (window.cargarComentariosPost) {
            posts.forEach(post => {
                window.cargarComentariosPost(post.id);
            });
        }

    } catch (err) {
        if (window.registrarLogSistema) window.registrarLogSistema("error_sistema", 'Error cargando posts:', err);
        grid.innerHTML = `
            <div class="blog-error">
                <div class="blog-error-icon">⚠️</div>
                <h3>Error al cargar las publicaciones</h3>
                <p>${err.message}</p>
                <button onclick="cargarPosts()" class="btn-retry">🔄 Reintentar</button>
            </div>
        `;
    }
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

    cargarPosts();
});
