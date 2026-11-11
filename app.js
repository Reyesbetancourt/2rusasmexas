(() => {
  const C = window.CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const params = new URLSearchParams(location.search);
  const canal = (params.get("utm_source") || params.get("c") || "web").toLowerCase().slice(0, 20);
  const ref = [params.get("utm_campaign"), params.get("utm_content"), params.get("ref")].filter(Boolean).join("|").slice(0, 120) || null;

  function sesion() {
    let s = null;
    try { s = localStorage.getItem("rm_sesion"); } catch {}
    if (!s) {
      s = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9-]/g, "");
      try { localStorage.setItem("rm_sesion", s); } catch {}
    }
    return s;
  }
  const SES = sesion();
  const codigoLocal = "ZV-" + (canal.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "WEB") + "-" + SES.replace(/-/g, "").slice(0, 4).toUpperCase();
  const waLink = (texto) => `https://wa.me/${C.ZVEZDA_WA}?text=${encodeURIComponent(texto)}`;

  // ---------- Catálogo ----------
  let catalogo = [];
  const REG = ["Todos", "Rusia", "Cáucaso", "Bálticos", "Escandinavia", "Europa del Este", "Asia Central", "Medio Oriente", "Atlántico Norte"];
  function pintarFiltros(activo) {
    const presentes = new Set(catalogo.map((p) => p.region));
    $("#filtros").innerHTML = REG.filter((r) => r === "Todos" || presentes.has(r))
      .map((r) => `<button type="button" aria-pressed="${r === activo}" data-reg="${esc(r)}">${esc(r)}</button>`).join("");
  }
  function pintarGrid(reg) {
    const lista = catalogo.filter((p) => reg === "Todos" || p.region === reg);
    $("#grid").innerHTML = lista.map((p) => `
      <button class="card" type="button" data-slug="${esc(p.slug)}">
        <span class="reg">${esc(p.region)}</span>
        <h3>${esc(p.nombre)}</h3>
        <span class="dur">${p.dias ? esc(p.dias) + " días" : ""}${p.noches ? " · " + esc(p.noches) + " noches" : ""}</span>
        <span class="cds">${esc((p.ciudades || []).join(" · "))}</span>
        <span class="sal">${esc(p.salidas || "")}</span>
      </button>`).join("");
  }
  function abrirFicha(slug) {
    const p = catalogo.find((x) => x.slug === slug); if (!p) return;
    const d = $("#ficha");
    d.innerHTML = `<div class="ficha">
      <span class="reg" style="color:var(--rosa);font-weight:700;font-size:.8rem;text-transform:uppercase">${esc(p.region)}</span>
      <h3>${esc(p.nombre)}</h3>
      <p>${esc(p.resumen || "")}</p>
      <p><strong>${esc(p.dias)} días</strong> · ${esc((p.ciudades || []).join(" · "))}<br><small>${esc(p.salidas || "")}</small></p>
      ${(p.destacados || []).length ? `<h4>Lo mejor</h4><ul>${p.destacados.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${(p.itinerario || []).length ? `<details><summary>Itinerario día por día</summary><ul>${p.itinerario.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>` : ""}
      <p style="font-size:.85rem;color:var(--tinta2)">Itinerario referencial de Viajes Zvezda. Precio, fechas e inclusiones se confirman al cotizar; vuelos internacionales aparte.</p>
      <div class="acciones">
        <button class="btn" data-preguntar="${esc(p.slug)}">Preguntarle a Nadia</button>
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(`Hola Viajes Zvezda, vengo de parte de 2RusasMexas. Código: ${codigoLocal}\nMe interesa: ${p.nombre}`)}">Cotizar por WhatsApp</a>
        <a class="btn btn-ghost" href="${BASE}viajes/${esc(p.slug)}.html">Ver página</a>
        <button class="btn btn-ghost" data-cerrar-ficha>Cerrar</button>
      </div></div>`;
    d.showModal();
  }
  const BASE = document.body.dataset.base || "";
  fetch(BASE + "catalogo.json").then((r) => r.json()).then((j) => {
    catalogo = j;
    if ($("#grid")) { pintarFiltros("Todos"); pintarGrid("Todos"); }
  }).catch(() => { if ($("#grid")) $("#grid").innerHTML = '<p class="cargando">No pudimos cargar los destinos. Pregúntale a Nadia 👇</p>'; });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-reg],[data-slug],[data-abrir-chat],[data-preguntar],[data-cerrar-ficha]");
    if (!t) return;
    if (t.dataset.reg) { pintarFiltros(t.dataset.reg); pintarGrid(t.dataset.reg); }
    else if (t.dataset.slug) abrirFicha(t.dataset.slug);
    else if (t.hasAttribute("data-cerrar-ficha")) $("#ficha").close();
    else if (t.dataset.preguntar) {
      const p = catalogo.find((x) => x.slug === t.dataset.preguntar); $("#ficha").close(); abrirChat();
      enviar(`Hola, me interesa el paquete ${p ? p.nombre : t.dataset.preguntar}. ¿Me cuentas más?`);
    } else abrirChat();
  });

  // ---------- Chat ----------
  const chat = $("#chat"), msgs = $("#msgs");
  let historial = [];
  try { historial = JSON.parse(sessionStorage.getItem("rm_chat") || "[]"); } catch {}
  const guardar = () => { try { sessionStorage.setItem("rm_chat", JSON.stringify(historial.slice(-40))); } catch {} };

  function burbuja(quien, texto, wa) {
    const el = document.createElement("div");
    el.className = "m " + quien;
    el.textContent = texto;
    if (wa) {
      const a = document.createElement("a");
      a.className = "btn btn-wa btn-sm"; a.href = wa; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "Enviar mi ficha a Viajes Zvezda por WhatsApp";
      el.appendChild(document.createElement("br")); el.appendChild(a);
    }
    msgs.appendChild(el); msgs.scrollTop = msgs.scrollHeight; return el;
  }
  function abrirChat() {
    chat.classList.add("abierto"); chat.setAttribute("aria-hidden", "false");
    if (!msgs.children.length) {
      if (historial.length) historial.forEach((h) => burbuja(h.q, h.t, h.wa));
      else burbuja("ella", "Hola, soy Nadia, la asistente virtual de 2RusasMexas ✨ ¿A dónde te gustaría viajar?");
    }
    setTimeout(() => $("#txt").focus(), 150);
  }
  $("#cerrar").addEventListener("click", () => { chat.classList.remove("abierto"); chat.setAttribute("aria-hidden", "true"); });

  let ocupado = false;
  async function enviar(texto) {
    texto = texto.trim(); if (!texto || ocupado) return;
    ocupado = true; burbuja("yo", texto); historial.push({ q: "yo", t: texto });
    const esp = burbuja("ella escribiendo", "Nadia está escribiendo…");
    let r = null;
    if (C.FUNCION_URL) {
      try {
        const res = await fetch(C.FUNCION_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(C.SUPABASE_ANON ? { Authorization: `Bearer ${C.SUPABASE_ANON}`, apikey: C.SUPABASE_ANON } : {}) },
          body: JSON.stringify({ sesion: SES, mensaje: texto, canal, ref }),
        });
        r = await res.json();
      } catch { r = null; }
    }
    if (!r || !r.respuesta) {
      r = { respuesta: "Para darte la mejor información te paso directo con un asesor de Viajes Zvezda. Toca el botón y envía tu mensaje 👇",
            whatsapp: waLink(`Hola Viajes Zvezda, vengo de parte de 2RusasMexas. Código: ${codigoLocal}\n${texto}`) };
    }
    esp.remove(); burbuja("ella", r.respuesta, r.whatsapp);
    historial.push({ q: "ella", t: r.respuesta, wa: r.whatsapp || null }); guardar(); ocupado = false;
  }
  $("#form").addEventListener("submit", (e) => { e.preventDefault(); const i = $("#txt"); enviar(i.value); i.value = ""; });
})();
