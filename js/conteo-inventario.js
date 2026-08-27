// ═══════════════════════════════════════════════════════════════
// MOTEROS SPORTS LINE - MÓDULO DE CONTEO FÍSICO CIEGO Y AUDITORÍA
// ═══════════════════════════════════════════════════════════════

/**
 * Estado global del módulo de conteo
 */
window.estadoConteo = {
    sedeSeleccionada: 'Bodega',
    operario: '',
    sesionId: '',
    productosCatalogo: [],
    conteosRealizados: {}, // Clave: `${id_producto}_${color}_${talla}` -> { contada, timestamp, operario }
    inventarioSistemaCache: {}, // Solo accesible para conciliación admin
    filtroBusqueda: '',
    filtroCategoria: '',
    filtroEstadoConteo: 'todos' // 'todos', 'contados', 'pendientes'
};

const PLACEHOLDER_CONTEO = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22100%22%20height%3D%22100%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20fill%3D%22%23f1f5f9%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22%2394a3b8%22%20font-family%3D%22sans-serif%22%20font-size%3D%2212%22%20font-weight%3D%22bold%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%220.3em%22%3ESin%20Foto%3C%2Ftext%3E%3C%2Fsvg%3E";

/**
 * Inicializar una nueva sesión de conteo
 */
function iniciarSesionConteo() {
    const sede = document.getElementById('conteoSelectSede')?.value || 'Bodega';
    const operario = document.getElementById('conteoInputOperario')?.value.trim();

    if (!operario) {
        alert('Por favor ingresa el nombre de la persona o equipo que realiza el conteo.');
        document.getElementById('conteoInputOperario')?.focus();
        return;
    }

    window.estadoConteo.sedeSeleccionada = sede;
    window.estadoConteo.operario = operario;
    window.estadoConteo.sesionId = `JORNADA_${sede.toUpperCase()}_${new Date().toISOString().slice(0, 10)}_${Date.now().toString(36)}`;
    
    // Cargar conteos previos guardados localmente para esta sede hoy
    const keyStorage = `conteo_ciego_${sede}_${new Date().toISOString().slice(0, 10)}`;
    const guardados = localStorage.getItem(keyStorage);
    if (guardados) {
        try {
            window.estadoConteo.conteosRealizados = JSON.parse(guardados);
        } catch (e) {
            window.estadoConteo.conteosRealizados = {};
        }
    } else {
        window.estadoConteo.conteosRealizados = {};
    }

    document.getElementById('conteoConfigCard').style.display = 'none';
    document.getElementById('conteoAreaTrabajo').style.display = 'block';
    document.getElementById('conteoBadgeSede').textContent = `📍 ${sede}`;
    document.getElementById('conteoBadgeOperario').textContent = `👤 ${operario}`;

    cargarProductosParaConteo();
}

/**
 * Cargar catálogo de productos para el conteo ciego
 */
async function cargarProductosParaConteo() {
    const contenedor = document.getElementById('conteoGridItems');
    if (!contenedor) return;

    contenedor.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 0.5rem; color: #64748b;">Cargando catálogo para conteo ciego...</p></div>';

    try {
        const client = window.supabaseClient;
        if (!client) throw new Error('Cliente Supabase no disponible');

        // 1. Obtener productos activos
        const { data: productos, error: errProd } = await client
            .from('productos')
            .select('id, id_producto, nombre, referencia, marca, categoria, subcategoria, url_imagen, variantes, tallas, precio, precio_compra')
            .order('nombre', { ascending: true });

        if (errProd) throw errProd;

        // Desglosar productos en ítems contables por color y talla
        const itemsContables = [];
        (productos || []).forEach(p => {
            const variantes = Array.isArray(p.variantes) && p.variantes.length > 0
                ? p.variantes
                : [{ color: 'Único', url: p.url_imagen || '' }];

            const tallas = Array.isArray(p.tallas) && p.tallas.length > 0
                ? p.tallas
                : ['Única'];

            variantes.forEach(v => {
                const colorNombre = v.color || 'Único';
                const fotoUrl = v.url || p.url_imagen || PLACEHOLDER_CONTEO;

                tallas.forEach(t => {
                    const tallaNombre = t || 'Única';
                    const itemKey = `${p.id}_${colorNombre}_${tallaNombre}`;

                    itemsContables.push({
                        key: itemKey,
                        producto_id: p.id,
                        id_producto: p.id_producto || p.id,
                        nombre: p.nombre,
                        referencia: p.referencia || '',
                        marca: p.marca || '',
                        categoria: p.categoria || '',
                        subcategoria: p.subcategoria || '',
                        color: colorNombre,
                        talla: tallaNombre,
                        foto: fotoUrl,
                        precio: p.precio || 0,
                        precio_compra: p.precio_compra || 0
                    });
                });
            });
        });

        window.estadoConteo.productosCatalogo = itemsContables;
        poblarCategoriasConteo(productos);
        renderizarTarjetasConteo();
        actualizarResumenProgreso();

    } catch (e) {
        console.error('Error cargando catálogo para conteo:', e);
        contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">❌ Error cargando catálogo: ${e.message}</div>`;
    }
}

/**
 * Llena el selector de categorías del filtro
 */
function poblarCategoriasConteo(productos) {
    const select = document.getElementById('conteoFiltroCategoria');
    if (!select) return;

    const cats = new Set();
    (productos || []).forEach(p => {
        if (p.categoria) cats.add(p.categoria);
    });

    select.innerHTML = '<option value="">Todas las Categorías</option>';
    Array.from(cats).sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}

/**
 * Renderiza las tarjetas de conteo ciego
 * NOTA DE SEGURIDAD: Ningún dato de stock de sistema se imprime en el HTML de estas tarjetas.
 */
function renderizarTarjetasConteo() {
    const contenedor = document.getElementById('conteoGridItems');
    if (!contenedor) return;

    const busqueda = (window.estadoConteo.filtroBusqueda || '').toLowerCase().trim();
    const categoria = window.estadoConteo.filtroCategoria || '';
    const estadoFiltro = window.estadoConteo.filtroEstadoConteo || 'todos';

    const itemsFiltrados = window.estadoConteo.productosCatalogo.filter(item => {
        // Filtro de búsqueda
        if (busqueda) {
            const matchNombre = (item.nombre || '').toLowerCase().includes(busqueda);
            const matchRef = (item.referencia || '').toLowerCase().includes(busqueda);
            const matchColor = (item.color || '').toLowerCase().includes(busqueda);
            const matchTalla = (item.talla || '').toLowerCase().includes(busqueda);
            const matchMarca = (item.marca || '').toLowerCase().includes(busqueda);
            if (!matchNombre && !matchRef && !matchColor && !matchTalla && !matchMarca) return false;
        }

        // Filtro de categoría
        if (categoria && item.categoria !== categoria) return false;

        // Filtro de estado de conteo
        const yaContado = window.estadoConteo.conteosRealizados.hasOwnProperty(item.key);
        if (estadoFiltro === 'contados' && !yaContado) return false;
        if (estadoFiltro === 'pendientes' && yaContado) return false;

        return true;
    });

    if (itemsFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: white; border-radius: 1rem; border: 1px dashed #cbd5e1;">
                <p style="font-size: 1.25rem; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">🔍 No se encontraron productos</p>
                <p style="font-size: 0.9rem; color: #94a3b8;">Prueba con otros términos de búsqueda o filtros.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = itemsFiltrados.map(item => {
        const registro = window.estadoConteo.conteosRealizados[item.key];
        const estaContado = !!registro;
        const valorContado = estaContado ? registro.contada : '';

        return `
            <div class="card-conteo-ciego ${estaContado ? 'item-contado-exito' : ''}" id="card_${item.key.replace(/[^a-zA-Z0-9]/g, '_')}" style="background: white; border-radius: 1rem; border: 2px solid ${estaContado ? '#10b981' : '#e2e8f0'}; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s;">
                
                <!-- Encabezado del producto: Foto Grande (85px) + Datos -->
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div style="width: 85px; height: 85px; background: #f8fafc; border-radius: 0.75rem; border: 1px solid #cbd5e1; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                        <img src="${item.foto}" alt="${item.nombre}" style="width: 100%; height: 100%; object-fit: contain; padding: 2px;" onerror="this.src='${PLACEHOLDER_CONTEO}'">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 0.35rem;">${item.categoria || 'General'}</span>
                            ${item.referencia ? `<span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">REF: ${item.referencia}</span>` : ''}
                        </div>
                        <h4 style="margin: 0.35rem 0 0.2rem 0; font-size: 1rem; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.nombre}">${item.nombre}</h4>
                        <div style="display: flex; gap: 0.75rem; font-size: 0.85rem; color: #334155; font-weight: 600;">
                            <span>🎨 ${item.color}</span>
                            <span>📏 ${item.talla}</span>
                        </div>
                    </div>
                </div>

                <!-- Bloque de Ingreso de Conteo Físico Ciego -->
                <div style="background: ${estaContado ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${estaContado ? '#bbf7d0' : '#e2e8f0'}; border-radius: 0.75rem; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.65rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="margin: 0; font-size: 0.85rem; font-weight: 700; color: ${estaContado ? '#166534' : '#334155'};">
                            ${estaContado ? '✅ Contado Físicamente:' : '🔢 ¿Cuántas unidades hay físicamente?'}
                        </label>
                        ${estaContado ? `<span style="font-size: 0.75rem; color: #15803d; font-weight: 600;">Guardado</span>` : ''}
                    </div>

                    <!-- Input Numérico Grande con Botones Rápidos -->
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <input type="number" min="0" step="1" 
                            id="input_${item.key.replace(/[^a-zA-Z0-9]/g, '_')}" 
                            class="form-control input-conteo-cantidad" 
                            placeholder="0" 
                            value="${valorContado}" 
                            style="font-size: 1.25rem; font-weight: 800; text-align: center; height: 46px; border: 2px solid ${estaContado ? '#10b981' : '#94a3b8'}; border-radius: 0.65rem;"
                            onkeydown="if(event.key==='Enter'){ guardarConteoItem('${item.key}'); }">
                        
                        <button type="button" class="btn btn-primary" onclick="guardarConteoItem('${item.key}')" style="height: 46px; padding: 0 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; border-radius: 0.65rem;">
                            💾 Guardar
                        </button>
                    </div>

                    <!-- Botones Rápidos de Incremento Táctil -->
                    <div style="display: flex; gap: 0.35rem; justify-content: space-between;">
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="sumarAlInput('${item.key}', 1)" style="flex: 1; font-weight: 700; padding: 0.35rem;">+1</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="sumarAlInput('${item.key}', 5)" style="flex: 1; font-weight: 700; padding: 0.35rem;">+5</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="sumarAlInput('${item.key}', 10)" style="flex: 1; font-weight: 700; padding: 0.35rem;">+10</button>
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="setearCero('${item.key}')" style="flex: 1; font-weight: 700; padding: 0.35rem;" title="Marcar 0 unidades">0</button>
                    </div>
                </div>

            </div>
        `;
    }).join('');
}

/**
 * Suma cantidades táctiles al input de conteo
 */
function sumarAlInput(itemKey, cantidad) {
    const inputId = `input_${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    const actual = parseInt(input.value) || 0;
    input.value = actual + cantidad;
}

/**
 * Setea en cero el input
 */
function setearCero(itemKey) {
    const inputId = `input_${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) return;
    input.value = 0;
}

/**
 * Guarda el conteo de un ítem individual
 */
function guardarConteoItem(itemKey) {
    const inputId = `input_${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const input = document.getElementById(inputId);
    if (!input) return;

    const valorStr = input.value.trim();
    if (valorStr === '') {
        alert('Por favor ingresa un número de unidades contadas (o 0 si no hay existencias).');
        input.focus();
        return;
    }

    const cantidadContada = parseInt(valorStr);
    if (isNaN(cantidadContada) || cantidadContada < 0) {
        alert('Ingresa una cantidad válida mayor o igual a 0.');
        input.focus();
        return;
    }

    window.estadoConteo.conteosRealizados[itemKey] = {
        contada: cantidadContada,
        timestamp: new Date().toISOString(),
        operario: window.estadoConteo.operario || 'Operario'
    };

    // Persistir en LocalStorage
    const keyStorage = `conteo_ciego_${window.estadoConteo.sedeSeleccionada}_${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(keyStorage, JSON.stringify(window.estadoConteo.conteosRealizados));

    // Feedback visual en la tarjeta
    const cardId = `card_${itemKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const card = document.getElementById(cardId);
    if (card) {
        card.style.borderColor = '#10b981';
        card.classList.add('item-contado-exito');
    }

    actualizarResumenProgreso();
}

/**
 * Actualiza la barra y números de progreso del conteo
 */
function actualizarResumenProgreso() {
    const totalItems = window.estadoConteo.productosCatalogo.length;
    const contados = Object.keys(window.estadoConteo.conteosRealizados).length;
    const pendientes = Math.max(0, totalItems - contados);
    const porcentaje = totalItems > 0 ? Math.round((contados / totalItems) * 100) : 0;

    const elTotal = document.getElementById('conteoProgresoTotal');
    const elContados = document.getElementById('conteoProgresoContados');
    const elPendientes = document.getElementById('conteoProgresoPendientes');
    const elPorcentaje = document.getElementById('conteoProgresoPorcentaje');
    const elBarra = document.getElementById('conteoBarraProgreso');

    if (elTotal) elTotal.textContent = totalItems;
    if (elContados) elContados.textContent = contados;
    if (elPendientes) elPendientes.textContent = pendientes;
    if (elPorcentaje) elPorcentaje.textContent = `${porcentaje}%`;
    if (elBarra) elBarra.style.width = `${porcentaje}%`;
}

/**
 * Filtra los productos en tiempo real por búsqueda y estado
 */
function filtrarConteo() {
    window.estadoConteo.filtroBusqueda = document.getElementById('conteoInputBuscar')?.value || '';
    window.estadoConteo.filtroCategoria = document.getElementById('conteoFiltroCategoria')?.value || '';
    window.estadoConteo.filtroEstadoConteo = document.getElementById('conteoFiltroEstado')?.value || 'todos';
    renderizarTarjetasConteo();
}

// ═══════════════════════════════════════════════════════════════
// CONSOLA DE AUDITORÍA Y CONCILIACIÓN TOTAL (VISTA ADMINISTRADOR)
// ═══════════════════════════════════════════════════════════════

/**
 * Carga los datos reales de stock en sistema y realiza la conciliación contra el conteo físico
 */
async function cargarConciliacionAuditoria() {
    const sede = document.getElementById('conciliacionSelectSede')?.value || window.estadoConteo.sedeSeleccionada || 'Bodega';
    const tbody = document.getElementById('tbodyConciliacion');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 2rem;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 0.5rem; color: #64748b;">Consultando inventario en Supabase y comparando con conteo físico...</p></td></tr>';

    try {
        const client = window.supabaseClient;
        if (!client) throw new Error('Cliente Supabase no disponible');

        // 1. Cargar productos y variantes
        const { data: productos, error: errP } = await client
            .from('productos')
            .select('id, id_producto, nombre, referencia, marca, categoria, precio, precio_compra, variantes, tallas');
        if (errP) throw errP;

        // 2. Cargar stock en la sede seleccionada
        let stockSistemaMap = new Map(); // Clave: `${id_producto}_${color}_${talla}` -> cantidad

        if (sede === 'Alcalá') {
            const { data: invAlc } = await client.from('inventario_alcala').select('*');
            (invAlc || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else if (sede === 'Local 01') {
            const { data: inv01 } = await client.from('inventario_01').select('*');
            (inv01 || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else if (sede === 'Jordán') {
            const { data: invJor } = await client.from('inventario_jordan').select('*');
            (invJor || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        } else {
            // Bodega
            const { data: invBod } = await client.from('inventario').select('*').eq('local_id', 'Bodega');
            (invBod || []).forEach(r => {
                const k = `${r.id_producto || r.producto_id}_${r.color || 'Único'}_${r.talla || 'Única'}`;
                stockSistemaMap.set(k, (stockSistemaMap.get(k) || 0) + (parseInt(r.cantidad) || 0));
            });
        }

        // Cargar conteos guardados localmente para esta sede
        const keyStorage = `conteo_ciego_${sede}_${new Date().toISOString().slice(0, 10)}`;
        const conteosSede = JSON.parse(localStorage.getItem(keyStorage) || '{}');

        // Armar tabla de conciliación
        const filasConciliacion = [];
        let totalExactos = 0;
        let totalFaltantes = 0;
        let totalSobrantes = 0;
        let impactoFinanciero = 0;

        (productos || []).forEach(p => {
            const variantes = Array.isArray(p.variantes) && p.variantes.length > 0 ? p.variantes : [{ color: 'Único' }];
            const tallas = Array.isArray(p.tallas) && p.tallas.length > 0 ? p.tallas : ['Única'];

            variantes.forEach(v => {
                const color = v.color || 'Único';
                tallas.forEach(t => {
                    const talla = t || 'Única';
                    const key = `${p.id}_${color}_${talla}`;

                    // Buscar stock en sistema (por ID o ID_PRODUCTO)
                    const keySlug = `${p.id_producto}_${color}_${talla}`;
                    const sistemaCant = stockSistemaMap.get(key) || stockSistemaMap.get(keySlug) || 0;

                    const registroConteo = conteosSede[key];
                    const fueContado = !!registroConteo;
                    const fisicoCant = fueContado ? registroConteo.contada : null;

                    let diferencia = null;
                    let estadoCuadre = 'Pendiente';

                    if (fueContado) {
                        diferencia = fisicoCant - sistemaCant;
                        if (diferencia === 0) {
                            estadoCuadre = 'Exacto';
                            totalExactos++;
                        } else if (diferencia < 0) {
                            estadoCuadre = 'Faltante';
                            totalFaltantes += Math.abs(diferencia);
                            impactoFinanciero += (diferencia * (p.precio_compra || p.precio || 0));
                        } else {
                            estadoCuadre = 'Sobrante';
                            totalSobrantes += diferencia;
                            impactoFinanciero += (diferencia * (p.precio_compra || p.precio || 0));
                        }
                    }

                    filasConciliacion.push({
                        producto_id: p.id,
                        id_producto: p.id_producto || p.id,
                        nombre: p.nombre,
                        referencia: p.referencia || '',
                        color,
                        talla,
                        costo: p.precio_compra || 0,
                        precio: p.precio || 0,
                        sistema: sistemaCant,
                        fisico: fisicoCant,
                        diferencia,
                        estadoCuadre,
                        operario: registroConteo ? registroConteo.operario : '',
                        timestamp: registroConteo ? registroConteo.timestamp : ''
                    });
                });
            });
        });

        window.filasConciliacionActual = filasConciliacion;

        // Actualizar tarjetas de KPI
        document.getElementById('kpiExactos').textContent = totalExactos;
        document.getElementById('kpiFaltantes').textContent = totalFaltantes;
        document.getElementById('kpiSobrantes').textContent = totalSobrantes;
        document.getElementById('kpiImpacto').textContent = `$${Math.abs(Math.round(impactoFinanciero)).toLocaleString('es-CO')}`;
        document.getElementById('kpiImpacto').style.color = impactoFinanciero < 0 ? '#ef4444' : (impactoFinanciero > 0 ? '#10b981' : '#475569');

        renderizarTablaConciliacion(filasConciliacion);

    } catch (e) {
        console.error('Error en conciliación de auditoría:', e);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: #ef4444; padding: 2rem;">❌ Error: ${e.message}</td></tr>`;
    }
}

/**
 * Renderiza las filas de la tabla de conciliación
 */
function renderizarTablaConciliacion(filas) {
    const tbody = document.getElementById('tbodyConciliacion');
    if (!tbody) return;

    const filtro = document.getElementById('conciliacionFiltroDiscrepancia')?.value || 'todos';

    const filtradas = filas.filter(f => {
        if (filtro === 'descuadres') return f.estadoCuadre === 'Faltante' || f.estadoCuadre === 'Sobrante';
        if (filtro === 'faltantes') return f.estadoCuadre === 'Faltante';
        if (filtro === 'sobrantes') return f.estadoCuadre === 'Sobrante';
        if (filtro === 'exactos') return f.estadoCuadre === 'Exacto';
        if (filtro === 'pendientes') return f.estadoCuadre === 'Pendiente';
        return true;
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 2rem; color: #94a3b8;">No hay registros que coincidan con este filtro.</td></tr>';
        return;
    }

    tbody.innerHTML = filtradas.map(f => {
        let badgeEstado = '';
        let rowClass = '';

        if (f.estadoCuadre === 'Exacto') {
            badgeEstado = '<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">✅ Exacto (0)</span>';
        } else if (f.estadoCuadre === 'Faltante') {
            badgeEstado = `<span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">🔻 Faltante (${f.diferencia})</span>`;
            rowClass = 'style="background: #fff5f5;"';
        } else if (f.estadoCuadre === 'Sobrante') {
            badgeEstado = `<span class="badge" style="background: #fef9c3; color: #854d0e; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">🔺 Sobrante (+${f.diferencia})</span>`;
            rowClass = 'style="background: #fefce8;"';
        } else {
            badgeEstado = '<span class="badge" style="background: #f1f5f9; color: #64748b; font-weight: 600; padding: 0.35rem 0.65rem; border-radius: 0.5rem;">⏳ No Contado</span>';
        }

        const difValor = f.diferencia !== null ? (f.diferencia * (f.costo || f.precio || 0)) : 0;
        const difValorFormateado = f.diferencia !== null ? `$${Math.abs(Math.round(difValor)).toLocaleString('es-CO')}` : '-';

        return `
            <tr ${rowClass}>
                <td style="font-weight: 700; color: #0f172a;">${f.nombre}</td>
                <td style="color: #64748b; font-size: 0.85rem;">${f.referencia || '-'}</td>
                <td><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-weight: 600;">${f.color}</span></td>
                <td><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 0.3rem; font-weight: 600;">${f.talla}</span></td>
                <td style="text-align: center; font-weight: 800; font-size: 1.05rem; color: #1e293b;">${f.sistema}</td>
                <td style="text-align: center; font-weight: 800; font-size: 1.05rem; color: #2563eb;">${f.fisico !== null ? f.fisico : '<span style="color: #94a3b8;">-</span>'}</td>
                <td style="text-align: center;">${badgeEstado}</td>
                <td style="text-align: right; font-weight: 700; color: ${difValor < 0 ? '#dc2626' : (difValor > 0 ? '#16a34a' : '#64748b')};">${difValorFormateado}</td>
                <td style="font-size: 0.8rem; color: #64748b;">${f.operario || '-'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Aplica el ajuste automático auditado en las tablas de inventario de Supabase
 */
async function aplicarAjusteInventarioAuditado() {
    const sede = document.getElementById('conciliacionSelectSede')?.value || 'Bodega';
    const filas = (window.filasConciliacionActual || []).filter(f => f.estadoCuadre === 'Faltante' || f.estadoCuadre === 'Sobrante');

    if (filas.length === 0) {
        alert('No hay descuadres pendientes por ajustar para esta sede.');
        return;
    }

    const confirmar = confirm(`¿Estás seguro de APLICAR EL AJUSTE AUTOMÁTICO a ${filas.length} ítems con descuadre en ${sede}?\n\nEsta acción modificará el inventario del sistema para igualarlo al conteo físico y creará el registro formal en la Auditoría.`);
    if (!confirmar) return;

    const btn = document.getElementById('btnAplicarAjusteAuditado');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aplicando Ajustes en Supabase...';
    }

    try {
        const client = window.supabaseClient;
        let ajustados = 0;

        for (const item of filas) {
            const nuevaCantidad = item.fisico;
            const cantAnterior = item.sistema;

            // 1. Actualizar tabla correspondiente
            if (sede === 'Alcalá') {
                await client.from('inventario_alcala')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else if (sede === 'Local 01') {
                await client.from('inventario_01')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else if (sede === 'Jordán') {
                await client.from('inventario_jordan')
                    .upsert({ id_producto: item.id_producto, talla: item.talla, color: item.color, cantidad: nuevaCantidad }, { onConflict: 'id_producto,talla,color' });
            } else {
                await client.from('inventario')
                    .upsert({ id_producto: item.id_producto, local_id: 'Bodega', talla: item.talla, color: item.color, cantidad: nuevaCantidad, ultima_actualizacion: new Date().toISOString() }, { onConflict: 'id_producto,local_id,talla,color' });
            }

            // 2. Registrar en Auditoría Formal
            if (typeof registrarAuditoriaInventario === 'function') {
                await registrarAuditoriaInventario({
                    producto_id: item.producto_id,
                    producto_nombre: item.nombre,
                    producto_codigo: item.referencia,
                    empleado_nombre: item.operario || 'Auditoría Inventario Ciego',
                    tipo_accion: 'Ajuste Toma Física Ciega',
                    local: sede,
                    talla_color: `${item.color} / ${item.talla}`,
                    cantidad_anterior: cantAnterior,
                    cantidad_nueva: nuevaCantidad,
                    detalles: {
                        motivo: 'Cuadre de inventario físico vs sistema',
                        diferencia: item.diferencia,
                        impacto_financiero: item.diferencia * item.costo
                    }
                });
            }

            ajustados++;
        }

        alert(`✅ Éxito: Se ajustaron ${ajustados} ítems en ${sede} y se registraron en la Auditoría.`);
        cargarConciliacionAuditoria();

    } catch (e) {
        console.error('Error aplicando ajustes:', e);
        alert(`❌ Error aplicando ajuste: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '⚡ Aplicar Ajuste de Inventario con Auditoría';
        }
    }
}

/**
 * Exporta el reporte de conciliación a CSV
 */
function exportarConciliacionCSV() {
    const filas = window.filasConciliacionActual || [];
    if (filas.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    const sede = document.getElementById('conciliacionSelectSede')?.value || 'Bodega';
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Producto,Referencia,Color,Talla,Stock_Sistema,Conteo_Fisico,Diferencia,Estado,Valor_Descuadre_COP,Operario\n";

    filas.forEach(f => {
        const val = f.diferencia !== null ? (f.diferencia * (f.costo || f.precio || 0)) : 0;
        csvContent += `"${f.nombre.replace(/"/g, '""')}","${f.referencia}","${f.color}","${f.talla}",${f.sistema},${f.fisico !== null ? f.fisico : ''},${f.diferencia !== null ? f.diferencia : ''},"${f.estadoCuadre}",${val},"${f.operario}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Auditoria_Inventario_${sede}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Exponer funciones globales
window.iniciarSesionConteo = iniciarSesionConteo;
window.cargarProductosParaConteo = cargarProductosParaConteo;
window.sumarAlInput = sumarAlInput;
window.setearCero = setearCero;
window.guardarConteoItem = guardarConteoItem;
window.filtrarConteo = filtrarConteo;
window.cargarConciliacionAuditoria = cargarConciliacionAuditoria;
window.renderizarTablaConciliacion = renderizarTablaConciliacion;
window.aplicarAjusteInventarioAuditado = aplicarAjusteInventarioAuditado;
window.exportarConciliacionCSV = exportarConciliacionCSV;
