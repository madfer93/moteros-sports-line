// ═══════════════════════════════════════════════════════════════
// FEEDBACK Y COMENTARIOS - MOTEROS SPORTS LINE
// ═══════════════════════════════════════════════════════════════

async function cargarFeedback() {
    await Promise.all([
        cargarComentariosBlog(),
        cargarResenasProductos()
    ]);
}

async function cargarComentariosBlog() {
    const tbody = document.getElementById('tbodyComentarios');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Cargando comentarios...</td></tr>';

    try {
        const { data, error } = await supabaseClient
            .from('blog_comentarios')
            .select('*, posts:post_id(titulo)')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay comentarios</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(c => `
            <tr>
                <td>${formatearFecha(c.created_at)}</td>
                <td>${c.nombre_usuario || 'Anónimo'}</td>
                <td style="max-width:300px;">${c.comentario}</td>
                <td>${c.posts?.titulo || 'Post eliminado'}</td>
                <td><span class="badge ${c.aprobado ? 'badge-success' : 'badge-warning'}">${c.aprobado ? 'Aprobado' : 'Pendiente'}</span></td>
                <td>
                    ${!c.aprobado ? `<button class="btn btn-sm btn-success" onclick="aprobarComentario('${c.id}')">✓ Aprobar</button>` : ''}
                    <button class="btn btn-sm btn-danger" onclick="eliminarComentario('${c.id}')">🗑️</button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error cargando comentarios:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar comentarios</td></tr>';
    }
}

async function cargarResenasProductos() {
    const tbody = document.getElementById('tbodyResenasProductos');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Cargando reseñas...</td></tr>';

    try {
        // Cargar reseñas
        const { data: resenas, error } = await supabaseClient
            .from('producto_resenas')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!resenas || resenas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay reseñas</td></tr>';
            return;
        }

        // Obtener IDs únicos de productos
        const productIds = [...new Set(resenas.map(r => r.id_producto))];

        // Cargar productos
        const { data: productos } = await supabaseClient
            .from('productos')
            .select('id, nombre')
            .in('id', productIds);

        // Crear mapa de productos
        const productosMap = {};
        if (productos) {
            productos.forEach(p => {
                productosMap[p.id] = p.nombre;
            });
        }

        tbody.innerHTML = resenas.map(r => {
            const estrellas = '⭐'.repeat(parseInt(r.estrellas || 0));
            const nombreProducto = productosMap[r.id_producto] || 'Producto eliminado';
            return `
            <tr>
                <td>${formatearFecha(r.created_at)}</td>
                <td>${nombreProducto}</td>
                <td>${r.nombre_cliente || 'Anónimo'}</td>
                <td>${estrellas} (${r.estrellas})</td>
                <td style="max-width:300px;">${r.comentario || '-'}</td>
                <td><span class="badge ${r.aprobado ? 'badge-success' : 'badge-warning'}">${r.aprobado ? 'Aprobado' : 'Pendiente'}</span></td>
                <td>
                    ${r.aprobado
                    ? `<button class="btn btn-sm btn-warning" onclick="rechazarResena('${r.id}')" title="Rechazar">❌ Rechazar</button>`
                    : `<button class="btn btn-sm btn-success" onclick="aprobarResena('${r.id}')" title="Aprobar">✅​ Aprobar</button>`
                }
                    <button class="btn btn-sm btn-danger" onclick="eliminarResena('${r.id}')" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
        }).join('');

    } catch (error) {
        console.error('Error cargando reseñas:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar reseñas</td></tr>';
    }
}

async function aprobarComentario(id) {
    try {
        const { error } = await supabaseClient
            .from('blog_comentarios')
            .update({ aprobado: true })
            .eq('id', id);

        if (error) throw error;
        showToast('Comentario aprobado', 'success');
        cargarComentariosBlog();
    } catch (error) {
        showToast('Error al aprobar comentario', 'error');
    }
}

async function eliminarComentario(id) {
    if (!confirm('¿Eliminar este comentario?')) return;

    try {
        const { error } = await supabaseClient
            .from('blog_comentarios')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showToast('Comentario eliminado', 'success');
        cargarComentariosBlog();
    } catch (error) {
        showToast('Error al eliminar comentario', 'error');
    }
}

async function aprobarResena(id) {
    try {
        const { error } = await supabaseClient
            .from('producto_resenas')
            .update({ aprobado: true })
            .eq('id', id);

        if (error) throw error;
        showToast('Reseña aprobada', 'success');
        cargarResenasProductos();
    } catch (error) {
        showToast('Error al aprobar reseña', 'error');
    }
}

async function rechazarResena(id) {
    try {
        const { error } = await supabaseClient
            .from('producto_resenas')
            .update({ aprobado: false })
            .eq('id', id);

        if (error) throw error;
        showToast('Reseña rechazada', 'warning');
        cargarResenasProductos();
    } catch (error) {
        showToast('Error al rechazar reseña', 'error');
    }
}

async function eliminarResena(id) {
    if (!confirm('¿Eliminar esta reseña?')) return;

    try {
        const { error } = await supabaseClient
            .from('producto_resenas')
            .delete()
            .eq('id', id);

        if (error) throw error;
        showToast('Reseña eliminada', 'success');
        cargarResenasProductos();
    } catch (error) {
        showToast('Error al eliminar reseña', 'error');
    }
}

// Exportar funciones globalmente
window.cargarFeedback = cargarFeedback;
window.aprobarComentario = aprobarComentario;
window.eliminarComentario = eliminarComentario;
window.aprobarResena = aprobarResena;
window.rechazarResena = rechazarResena;
window.eliminarResena = eliminarResena;
