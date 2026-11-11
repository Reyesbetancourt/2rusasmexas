// Configuración pública del sitio (nada secreto aquí).
window.CONFIG = {
  // URL de la Edge Function. Vacío = modo sin IA (el chat pasa directo a WhatsApp con código).
  FUNCION_URL: "",
  // Llave PUBLICABLE (anon) de Supabase: es pública por diseño; las tablas tienen RLS sin políticas.
  SUPABASE_ANON: "",
  ZVEZDA_WA: "525539177590",
};
