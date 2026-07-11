-- ═══════════════════════════════════════════════════════════════
-- MOTEROS SPORTS LINE - SUPABASE SCHEMA UPDATES
-- Fecha: 2026-07-10
-- ═══════════════════════════════════════════════════════════════

-- 1. MODIFICACIONES A TABLAS EXISTENTES
-- Agregar campos para proveedores de servicios en servicios_motero
ALTER TABLE servicios_motero ADD COLUMN IF NOT EXISTS ejecutor_tipo text DEFAULT 'interno';
ALTER TABLE servicios_motero ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES proveedores(id);

-- 2. CREACIÓN DE NUEVAS TABLAS

-- Tabla: recaudo_sistecredito (Auditoría y control de liquidaciones de Sistecrédito)
CREATE TABLE IF NOT EXISTS recaudo_sistecredito (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_nombre text not null,
    monto_total numeric not null,
    retencion numeric default 0,
    monto_neto numeric not null,
    tipo_operacion text not null, -- 'Venta', 'Abono Credito', 'Abono Deudor'
    referencia_id text not null, -- ID de Venta o ID de Pago
    local text not null,
    estado text default 'pendiente', -- 'pendiente', 'recibido'
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Tabla: devoluciones (Auditoría de cambios y devoluciones de mercancía)
CREATE TABLE IF NOT EXISTS devoluciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    id_venta_original text not null,
    producto_devuelto_id text not null,
    cantidad_devuelta numeric not null,
    producto_entregado_id text, -- null si es solo devolución sin cambio
    cantidad_entregada numeric,
    diferencia_dinero numeric default 0, -- positivo si cliente paga saldo, negativo si hay saldo a favor
    motivo text,
    estado_producto_devuelto text default 'bueno', -- 'bueno' (vuelve a stock), 'defectuoso' (se da de baja)
    fotos_evidencia text[], -- urls de fotos en Supabase Storage
    registrado_por text not null,
    local text not null,
    created_at timestamp with time zone default now()
);

-- 3. HABILITACIÓN DE RLS Y POLÍTICAS BÁSICAS
-- Habilitar RLS en las nuevas tablas
ALTER TABLE recaudo_sistecredito ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;

-- Políticas de recaudo_sistecredito
CREATE POLICY "Permitir lectura pública en recaudo_sistecredito" ON recaudo_sistecredito
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública en recaudo_sistecredito" ON recaudo_sistecredito
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública en recaudo_sistecredito" ON recaudo_sistecredito
    FOR UPDATE USING (true) WITH CHECK (true);

-- Políticas de devoluciones
CREATE POLICY "Permitir lectura pública en devoluciones" ON devoluciones
    FOR SELECT USING (true);

CREATE POLICY "Permitir inserción pública en devoluciones" ON devoluciones
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir actualización pública en devoluciones" ON devoluciones
    FOR UPDATE USING (true) WITH CHECK (true);
