// ═══════════════════════════════════════════════════════════════
// SISTEMA DE COMENTARIOS
// ═══════════════════════════════════════════════════════════════

async function cargarComentariosPost(postId) {
    const container = document.getElementById(`comentarios-${postId}`);
    if (!container) return;

    try {
        const { data: comentarios, error } = await supabaseClient
            .from('blog_comentarios')
            .select('*')
            .eq('post_id', postId)
            .eq('aprobado', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!comentarios || comentarios.length === 0) {
            container.innerHTML = '<div class="blog-comments-empty">Sé el primero en comentar</div>';
            return;
        }

        container.innerHTML = comentarios.map(c => `
            <div class="blog-comment-item">
                <div class="blog-comment-header">
                    <span class="blog-comment-author">${c.nombre_usuario}</span>
                    <span class="blog-comment-date">${new Date(c.created_at).toLocaleDateString('es-CO')}</span>
                </div>
                <p class="blog-comment-text">${c.comentario}</p>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error cargando comentarios:', err);
        container.innerHTML = '<div class="blog-comments-empty">Error al cargar comentarios</div>';
    }
}

async function enviarComentario(event, postId) {
    event.preventDefault();

    const nombre = document.getElementById(`nombre-${postId}`).value.trim();
    const email = document.getElementById(`email-${postId}`).value.trim();
    const comentario = document.getElementById(`comentario-${postId}`).value.trim();

    if (!nombre || !comentario) {
        alert('Por favor completa los campos obligatorios');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('blog_comentarios')
            .insert({
                post_id: postId,
                nombre_usuario: nombre,
                email_usuario: email || null,
                comentario: comentario,
                aprobado: false // Requiere aprobación del admin
            });

        if (error) throw error;

        // Limpiar formulario
        document.getElementById(`nombre-${postId}`).value = '';
        document.getElementById(`email-${postId}`).value = '';
        document.getElementById(`comentario-${postId}`).value = '';

        alert('¡Gracias por tu comentario! Será visible después de ser aprobado por nuestro equipo.');

    } catch (err) {
        console.error('Error enviando comentario:', err);
        // MOSTRAR ERROR REAL AL USUARIO
        alert('Error: ' + (err.message || JSON.stringify(err)));
    }
}

// Exportar funciones globalmente
window.cargarComentariosPost = cargarComentariosPost;
window.enviarComentario = enviarComentario;
