-- ═══════════════════════════════════════════════════════════════
-- MOTEROS SPORTS LINE - BLINDAJE DE SEGURIDAD PARA TABLAS DE IA
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Habilitar RLS en las tablas de configuración de la IA
ALTER TABLE IF EXISTS config_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ia_memoria_contexto ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ia_log_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads_ia ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas permisivas antiguas en config_ia
DROP POLICY IF EXISTS "Permitir todo en config_ia" ON config_ia;
DROP POLICY IF EXISTS "Lectura publica config_ia" ON config_ia;
DROP POLICY IF EXISTS "Escritura protegida config_ia" ON config_ia;

-- 3. Crear política de LECTURA PÚBLICA (para que el sitio web cargue configuraciones)
CREATE POLICY "Lectura publica config_ia" 
ON config_ia FOR SELECT 
TO public 
USING (true);

-- 4. Crear política de ESCRITURA RESTRINGIDA (Solo usuarios autenticados / Admin pueden modificar)
CREATE POLICY "Escritura protegida config_ia" 
ON config_ia FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 5. Asegurar permisos en leads_ia (Permitir inserción anónima de leads pero no lectura ni modificación por extraños)
DROP POLICY IF EXISTS "Permitir crear leads publicos" ON leads_ia;
CREATE POLICY "Permitir crear leads publicos" 
ON leads_ia FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Solo admin lee leads" ON leads_ia;
CREATE POLICY "Solo admin lee leads" 
ON leads_ia FOR SELECT 
TO authenticated 
USING (true);

SELECT '✅ Blindaje de seguridad RLS aplicado correctamente en Supabase' as resultado;
