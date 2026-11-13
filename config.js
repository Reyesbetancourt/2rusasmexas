// Configuración pública del sitio (nada secreto aquí).
window.CONFIG = {
  // URL de la Edge Function. Vacío = modo sin IA (el chat pasa directo a WhatsApp con código).
  FUNCION_URL: "https://coyupcnxdozgyiuoxzov.supabase.co/functions/v1/asesora-viajes",
  // No hace falta: la función es pública (verify_jwt off) y las tablas tienen RLS sin políticas.
  SUPABASE_ANON: "",
  ZVEZDA_WA: "525539177590",
};
