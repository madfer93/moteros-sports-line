/**
 * OFFLINE DB - Moteros Sport Line
 * Usa Dexie.js para manejar IndexedDB
 */

const offlineDB = new Dexie('MoterosOfflineDB');

// Definir esquema
offlineDB.version(2).stores({
    productos: 'id, nombre, marca, categoria, id_producto',
    inventario: '++id, id_producto, local, talla, color',
    empleados: 'id, usuario, cedula',
    ventas_pendientes: '++id, fecha, tienda, data, sincronizado',
    cierres_pendientes: '++id, numero_cierre, data, sincronizado'
});

const OfflineManager = {
    // 1. Guardar productos localmente
    async cachearProductos(productos, inventarios) {
        try {
            await offlineDB.productos.clear();
            await offlineDB.productos.bulkAdd(productos);

            await offlineDB.inventario.clear();
            // Aplanar inventarios si vienen en objeto por tienda
            let invPlano = [];
            if (inventarios.alcala) invPlano = [...invPlano, ...inventarios.alcala.map(i => ({ ...i, local: 'Alcalá' }))];
            if (inventarios.local01) invPlano = [...invPlano, ...inventarios.local01.map(i => ({ ...i, local: '01' }))];
            if (inventarios.jordan) invPlano = [...invPlano, ...inventarios.jordan.map(i => ({ ...i, local: 'Jordán' }))];
            if (inventarios.actual) invPlano = [...invPlano, ...inventarios.actual.map(i => ({ ...i, local: 'Actual' }))];

            await offlineDB.inventario.bulkAdd(invPlano);
            console.log('Offline: Productos cacheado con éxito');
        } catch (e) {
            console.error('Error cacheando productos:', e);
        }
    },

    // 2. Cachear empleados para login offline
    async cachearEmpleados(empleados) {
        try {
            await offlineDB.empleados.clear();
            await offlineDB.empleados.bulkAdd(empleados);
        } catch (e) {
            console.error('Error cacheando empleados:', e);
        }
    },

    // 3. Obtener productos offline
    async obtenerProductosOffline() {
        return await offlineDB.productos.toArray();
    },

    async obtenerInventarioOffline(local) {
        if (local === 'Todas') return await offlineDB.inventario.toArray();
        return await offlineDB.inventario.where('local').equals(local).toArray();
    },

    // 4. Encolar venta
    async encolarVenta(ventaData) {
        return await offlineDB.ventas_pendientes.add({
            fecha: new Date().toISOString(),
            tienda: ventaData.local,
            data: ventaData,
            sincronizado: 0
        });
    },

    // 5. Sincronizar hacia Supabase
    async sincronizarPendientes(db) {
        if (!navigator.onLine) return;

        const pendientes = await offlineDB.ventas_pendientes.where('sincronizado').equals(0).toArray();
        if (pendientes.length === 0) return;

        console.log(`Offline: Sincronizando ${pendientes.length} ventas...`);

        for (const p of pendientes) {
            try {
                const { error } = await db.from('ventas').insert(p.data);
                if (!error) {
                    await offlineDB.ventas_pendientes.update(p.id, { sincronizado: 1 });
                }
            } catch (e) {
                console.error('Error sincronizando venta:', e);
            }
        }
    }
};

window.offlineDB = offlineDB;
window.OfflineManager = OfflineManager;
