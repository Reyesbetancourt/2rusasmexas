(() => {
  window.RM_LISTO = true; // la página quita las animaciones de entrada si este archivo no llega a cargar
  const C = window.CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const BASE = document.body.dataset.base || "";
  const PAQUETE = document.body.dataset.paquete || "";

  // ---------- Atribución: el primer canal/campaña se conserva aunque navegue entre páginas ----------
  const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const poner = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const params = new URLSearchParams(location.search);
  const canalUrl = (params.get("utm_source") || params.get("c") || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  const refUrl = [params.get("utm_campaign"), params.get("utm_content"), params.get("ref")].filter(Boolean).join("|").slice(0, 120);
  if (canalUrl && !leer("rm_canal")) { poner("rm_canal", canalUrl); if (refUrl) poner("rm_ref", refUrl); }
  const canal = leer("rm_canal") || canalUrl || "web";
  const ref = leer("rm_ref") || refUrl || null;

  let SES = leer("rm_sesion");
  if (!SES) {
    SES = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9-]/g, "");
    poner("rm_sesion", SES);
  }
  const codigoLocal = "ZV-" + (canal.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "WEB") + "-" + SES.replace(/-/g, "").slice(0, 4).toUpperCase();
  const waLink = (texto) => `https://wa.me/${C.ZVEZDA_WA}?text=${encodeURIComponent(texto)}`;

  // Nombres de los viajes (para el chat): el de esta página viene en el HTML; los demás, del catálogo.
  let catalogo = [];
  fetch(BASE + "catalogo.json").then((r) => r.json()).then((j) => { catalogo = j; }).catch(() => {});
  const nombre = (slug) => (slug === PAQUETE && document.body.dataset.nombre) || (catalogo.find((p) => p.slug === slug) || {}).nombre || slug.replace(/-/g, " ");

  // ---------- Navegación: sombra al bajar y menú del celular ----------
  const nav = $("#nav"), menu = $("#menu"), botonMenu = $(".nav-menu");
  const alBajar = () => nav && nav.classList.toggle("fija", scrollY > 12);
  addEventListener("scroll", alBajar, { passive: true }); alBajar();
  const ponerMenu = (abrir) => {
    menu.classList.toggle("abierto", abrir);
    botonMenu.setAttribute("aria-expanded", String(abrir));
    botonMenu.setAttribute("aria-label", abrir ? "Cerrar menú" : "Abrir menú");
    document.body.style.overflow = abrir ? "hidden" : "";
  };
  if (menu && botonMenu) {
    botonMenu.addEventListener("click", () => ponerMenu(!menu.classList.contains("abierto")));
    menu.addEventListener("click", (e) => { if (e.target.closest("a,button")) ponerMenu(false); });
  }

  // ---------- Aparición suave al hacer scroll ----------
  const mostrar = (el) => {
    el.classList.add("visto");
    const fin = (ev) => {
      if (ev.target !== el || ev.propertyName !== "opacity") return;
      el.classList.remove("rev", "visto"); el.removeEventListener("transitionend", fin);
    };
    el.addEventListener("transitionend", fin);
  };
  // Se revisa por posición en cada scroll (no depende de IntersectionObserver): nada se queda oculto.
  let porVer = $$(".rev"), enCola = false;
  const revisar = () => {
    enCola = false;
    const alto = innerHeight;
    porVer = porVer.filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return true;            // oculto por un filtro: se revisa después
      if (r.top > alto * 0.95) return true;              // todavía abajo de la pantalla
      mostrar(el); return false;
    });
    if (!porVer.length) { removeEventListener("scroll", pedir); removeEventListener("resize", pedir); }
  };
  const pedir = () => { if (!enCola) { enCola = true; requestAnimationFrame(revisar); } };
  addEventListener("scroll", pedir, { passive: true }); addEventListener("resize", pedir); addEventListener("load", pedir);
  revisar();

  // ---------- Filtros de destinos ----------
  const grid = $("#grid"), filtros = $("#filtros"), conteo = $("#conteo");
  if (grid && filtros) {
    const cards = [...grid.querySelectorAll(".card")];
    const ORDEN = ["Rusia", "Cáucaso", "Bálticos", "Escandinavia", "Europa del Este", "Asia Central", "Medio Oriente", "Atlántico Norte"];
    const regiones = ["Todos", ...ORDEN.filter((r) => cards.some((c) => c.dataset.region === r))];
    filtros.replaceChildren(...regiones.map((r) => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = r; b.dataset.reg = r; b.setAttribute("aria-pressed", String(r === "Todos"));
      return b;
    }));
    filtros.addEventListener("click", (e) => {
      const b = e.target.closest("[data-reg]"); if (!b) return;
      const activo = b.dataset.reg;
      filtros.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      let n = 0;
      cards.forEach((c) => { const ver = activo === "Todos" || c.dataset.region === activo; c.hidden = !ver; if (ver) n++; });
      if (conteo) conteo.textContent = `${n} ${n === 1 ? "viaje" : "viajes"}`;
      // Al filtrar, las tarjetas entran con su propia animación: ya no esperan a la de scroll
      cards.forEach((c) => c.classList.remove("rev", "visto"));
      grid.classList.remove("filtrado"); void grid.offsetWidth; grid.classList.add("filtrado");
    });
  }

  // ---------- Chat con Nadia ----------
  const chat = $("#chat"), msgs = $("#msgs"), rapidas = $("#rapidas");
  let historial = [];
  try { historial = JSON.parse(sessionStorage.getItem("rm_chat") || "[]"); } catch {}
  const guardar = () => { try { sessionStorage.setItem("rm_chat", JSON.stringify(historial.slice(-40))); } catch {} };

  function burbuja(quien, texto, wa) {
    const el = document.createElement("div");
    el.className = "m " + quien;
    // Texto seguro (sin innerHTML): **negritas** y enlaces https clicables
    String(texto).split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).forEach((parte) => {
      if (!parte) return;
      if (/^\*\*[^*]+\*\*$/.test(parte)) { const b = document.createElement("strong"); b.textContent = parte.slice(2, -2); el.appendChild(b); }
      else if (/^https?:\/\//.test(parte)) { const a = document.createElement("a"); a.href = parte; a.target = "_blank"; a.rel = "noopener"; a.textContent = parte.replace(/^https?:\/\//, ""); el.appendChild(a); }
      else el.appendChild(document.createTextNode(parte));
    });
    if (wa) {
      const a = document.createElement("a");
      a.className = "btn btn-wa btn-sm"; a.href = wa; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Enviar mi ficha a Viajes Zvezda por WhatsApp";
      el.appendChild(document.createElement("br")); el.appendChild(a);
    }
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight; return el;
  }
  function sugerencias() {
    const lista = PAQUETE
      ? ["¿Qué incluye este viaje?", "¿Cuál es la mejor época?", "Quiero cotizarlo"]
      : ["¿Necesito visa?", "¿Qué viaje me recomiendas?", "¿Cuándo es mejor ir?", "¿Cuánto cuesta?"];
    rapidas.replaceChildren(...lista.map((t) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.dataset.rapida = t; return b;
    }));
    rapidas.hidden = historial.some((h) => h.q === "yo");
  }
  function abrirChat() {
    chat.inert = false;
    chat.classList.add("abierto"); chat.setAttribute("aria-hidden", "false");
    document.body.classList.add("chat-abierto");
    if (!msgs.children.length) {
      if (historial.length) historial.forEach((h) => burbuja(h.q, h.t, h.wa));
      else burbuja("ella", PAQUETE
        ? `¡Hola! Soy Nadia 😊 Qué buen ojo: ${nombre(PAQUETE)} es de esos viajes que se quedan contigo. ¿Qué te gustaría saber?`
        : "¡Hola! Soy Nadia 😊 Cuéntame, ¿con qué viaje andas soñando?");
      sugerencias();
    }
    if (matchMedia("(min-width: 701px)").matches) setTimeout(() => $("#txt").focus(), 180);
  }
  function cerrarChat() {
    chat.classList.remove("abierto"); chat.setAttribute("aria-hidden", "true"); chat.inert = true;
    document.body.classList.remove("chat-abierto");
  }
  $("#cerrar").addEventListener("click", cerrarChat);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (chat.classList.contains("abierto")) cerrarChat();
    else if (menu && menu.classList.contains("abierto")) ponerMenu(false);
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-abrir-chat],[data-preguntar],[data-rapida],[data-pregunta]");
    if (!t) return;
    if (t.tagName === "A") e.preventDefault();
    if (t.dataset.rapida) { rapidas.hidden = true; enviar(PAQUETE ? `${t.dataset.rapida} (${nombre(PAQUETE)})` : t.dataset.rapida); return; }
    abrirChat();
    if (t.dataset.pregunta) enviar(t.dataset.pregunta);
    else if (t.dataset.preguntar && !historial.some((h) => h.q === "yo")) enviar(`Hola, me interesa el viaje ${nombre(t.dataset.preguntar)}. ¿Me cuentas más?`);
  });

  // Barra de la portada: lo que la persona escribe ahí abre el chat y se lo manda a Nadia
  const heroForm = $("#hero-form"), heroTxt = $("#hero-txt");
  if (heroForm && heroTxt) {
    heroForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = heroTxt.value.trim(); heroTxt.value = ""; heroTxt.blur();
      abrirChat(); if (t) enviar(t);
    });
    const ejemplos = ["Quiero ver auroras boreales en febrero…", "¿Qué necesito para viajar a Rusia?", "Luna de miel en San Petersburgo…", "Un viaje en tren por Siberia…", "Somos 4 y tenemos 10 días…"];
    let i = 0;
    setInterval(() => { if (document.activeElement !== heroTxt && !heroTxt.value) heroTxt.placeholder = ejemplos[++i % ejemplos.length]; }, 3400);
  }

  let ocupado = false;
  const pendientes = []; // lo que la persona escribe mientras Nadia contesta: se junta y se manda después
  async function enviar(texto, yaMostrado = false) {
    texto = texto.trim(); if (!texto) return;
    rapidas.hidden = true;
    if (!yaMostrado) {
      // Muestra al instante y espera 1.5 s por si la persona sigue escribiendo (junta mensajes seguidos)
      burbuja("yo", texto); historial.push({ q: "yo", t: texto }); guardar();
      pendientes.push(texto);
      clearTimeout(enviar.t);
      if (!ocupado) enviar.t = setTimeout(() => { if (!ocupado && pendientes.length) enviar(pendientes.splice(0).join("\n"), true); }, 1500);
      return;
    }
    ocupado = true;
    const esp = document.createElement("div");
    esp.className = "m ella escribiendo"; esp.setAttribute("aria-label", "Nadia está escribiendo");
    esp.innerHTML = "<span></span><span></span><span></span>";
    msgs.appendChild(esp); msgs.scrollTop = msgs.scrollHeight;
    let r = null;
    if (C.FUNCION_URL) {
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 60000);
        const res = await fetch(C.FUNCION_URL, {
          method: "POST", signal: ctl.signal,
          headers: { "Content-Type": "application/json", ...(C.SUPABASE_ANON ? { Authorization: `Bearer ${C.SUPABASE_ANON}`, apikey: C.SUPABASE_ANON } : {}) },
          body: JSON.stringify({ sesion: SES, mensaje: texto, canal, ref: [ref, PAQUETE && "pag:" + PAQUETE].filter(Boolean).join("|") || null }),
        });
        clearTimeout(to);
        r = await res.json();
      } catch { r = null; }
    }
    if (!r || !r.respuesta) {
      r = { respuesta: "Para darte la mejor información te paso directo con un asesor de Viajes Zvezda. Toca el botón y envía tu mensaje 👇",
            whatsapp: waLink(`Hola Viajes Zvezda, vengo de parte de 2RusasMexas. Código: ${codigoLocal}\n${PAQUETE ? "Me interesa: " + nombre(PAQUETE) + "\n" : ""}${texto}`) };
    }
    esp.remove();
    if (r.respuesta) { burbuja("ella", r.respuesta, r.whatsapp); historial.push({ q: "ella", t: r.respuesta, wa: r.whatsapp || null }); guardar(); }
    ocupado = false;
    if (pendientes.length) enviar(pendientes.splice(0).join("\n"), true);
  }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#txt"); enviar(i.value); i.value = ""; });
})();
