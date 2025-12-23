// js/supabase-client.js - VERSIÓN CORREGIDA

// Crear cliente Supabase global
const supabaseClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_KEY
);

// Exportar como supabaseClient (no sobrescribir supabase)
window.supabaseClient = supabaseClient;

console.log('✅ Supabase Client conectado');