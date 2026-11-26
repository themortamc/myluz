"use strict";
// Prototipo de myluz: todo corre en el navegador con datos de ejemplo. No hay servidor ni datos reales.

const CONFIG = {
  descMayorista: 0.25,     // descuento base de mayoristas sobre el precio de lista
  minimoMayorista: 80000,  // compra mínima de ejemplo
  alias: "alias.del.negocio",
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const guardar = (k, v) => { try { localStorage.setItem("myluz:" + k, JSON.stringify(v)); } catch {} };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem("myluz:" + k)) ?? def; } catch { return def; } };

// Mayoristas de ejemplo (el panel los aprueba y les pone su descuento)
let mayoristas = leer("mayoristas", [
  { id: 1, nombre: "Distribuidora Andes", email: "mayorista@demo.com", cuit: "30-00000000-1", estado: "aprobado", desc: 25 },
  { id: 2, nombre: "Kiosco El Sol", email: "kiosco@demo.com", cuit: "20-00000000-2", estado: "aprobado", desc: 30 },
  { id: 3, nombre: "Bazar La Esquina", email: "bazar@demo.com", cuit: "27-00000000-3", estado: "pendiente", desc: 25 },
]);
let productos = window.PRODUCTOS.slice();
let carro = leer("carro", {});
let sesion = leer("sesion", null); // id de mayorista logueado
let filtro = { cat: "todas", q: "", orden: "rel" };
// shortcut: login de muestra en el navegador (el prototipo no tiene datos reales); en la tienda real va con Supabase Auth.
const ADMIN_DEMO = { usuario: "admin", pass: "demo" };
let admin = leer("admin", false);
let ocultos = new Set(leer("ocultos", [])); // códigos que el negocio ocultó desde el panel

const cliente = () => mayoristas.find((m) => m.id === sesion && m.estado === "aprobado") || null;
const catDe = (id) => window.CATEGORIAS.find((c) => c.id === id) || { nombre: id, color: "#eee" };

// Precios: el público ve el precio de lista. El mayorista ve el de lista tachado y su precio (descuento real).
function precios(p) {
  const m = cliente();
  if (m) return { tachado: p.precio, final: p.precio * (1 - m.desc / 100), etiqueta: `-${m.desc}% mayorista`, may: true };
  return { tachado: null, final: p.precio, etiqueta: null, may: false };
}

function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2200); }

function pintarCats() {
  const cats = [{ id: "todas", nombre: "Todo" }, ...window.CATEGORIAS];
  $("#cats").innerHTML = cats.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${filtro.cat === c.id}">${esc(c.nombre)}</button>`).join("");
}

function pintarIntro() {
  const m = cliente();
  $("#intro").innerHTML = m
    ? `<div class="hero may"><div class="hero-txt"><span class="eyebrow">Cuenta mayorista</span><h1>Hola, ${esc(m.nombre)}</h1>
       <p>Estás viendo tus precios mayoristas en toda la tienda. Compra mínima: ${pesos(CONFIG.minimoMayorista)}.</p>
       <div class="chips"><span class="chip may">Tu descuento: ${m.desc}% sobre lista</span><span class="chip">Envíos a toda Mendoza</span></div></div></div>`
    : `<div class="hero"><div class="hero-txt"><span class="eyebrow">Multirubro en Junín, Mendoza</span>
       <h1>Todo para tu casa,<br>en un solo lugar</h1>
       <p>Bazar, perfumería, zapatería, librería, juguetería y mucho más. Pedí online y recibilo en toda Mendoza o retiralo en el local.</p>
       <div class="hero-cta"><a class="btn-p" href="#grilla">Ver productos</a><button class="btn-l" type="button" id="btn-may-hero">Soy mayorista o revendedor</button></div></div>
       <ul class="beneficios">
         <li><b>Envíos a toda Mendoza</b><span>Por Correo Argentino</span></li>
         <li><b>Retiro en el local</b><span>Junín, Mendoza</span></li>
         <li><b>Pagás como quieras</b><span>Transferencia o tarjeta</span></li>
         <li><b>Precios mayoristas</b><span>Con cuenta aprobada</span></li>
       </ul></div>
       <h2 class="titulo">Comprá por categoría</h2>
       <div class="cat-tiles">${window.CATEGORIAS.map((c) => { const p = productos.find((x) => x.codigo === c.foto) || productos.find((x) => x.categoria === c.id);
         return `<button type="button" class="tile" data-cat="${c.id}">${p ? `<img src="img/p/${esc(p.codigo)}.webp" alt="" loading="lazy" width="600" height="450">` : ""}<span>${esc(c.nombre)}</span></button>`; }).join("")}</div>`;
  $("#btn-cuenta").textContent = m ? m.nombre.split(" ")[0] + " · salir" : "Soy mayorista";
  $("#btn-cuenta").classList.toggle("may", !!m);
}

function lista() {
  const q = filtro.q.trim().toLowerCase();
  let l = productos.filter((p) => !ocultos.has(p.codigo) && (filtro.cat === "todas" || p.categoria === filtro.cat) && (!q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)));
  if (filtro.orden === "asc") l.sort((a, b) => a.precio - b.precio);
  if (filtro.orden === "desc") l.sort((a, b) => b.precio - a.precio);
  if (filtro.orden === "az") l.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return l;
}

function tarjeta(p) {
  const c = catDe(p.categoria), pr = precios(p), sin = p.stock <= 0, url = `#p/${encodeURIComponent(p.codigo)}`;
  return `<article class="card${sin ? " agotado" : ""}">
      <a class="foto" href="${url}" style="background:${c.color}" tabindex="-1" aria-hidden="true"><img src="img/p/${esc(p.codigo)}.webp" alt="" loading="lazy" width="600" height="450" onerror="this.remove()">
        ${pr.etiqueta ? `<em class="tag may">${pr.etiqueta}</em>` : ""}${sin ? `<em class="sin">Sin stock</em>` : ""}</a>
      <div class="info"><span class="cod">${esc(c.nombre)}${!sin && p.stock < 5 ? ` · <b class="pocas">Últimas ${p.stock}</b>` : ""}</span><h3 class="nom"><a href="${url}">${esc(p.nombre)}</a></h3>
        <div class="precios">${pr.tachado ? `<div class="tachado">${pesos(pr.tachado)}</div>` : ""}<div class="precio">${pesos(pr.final)}</div>
        ${pr.may ? `<div class="sub">Precio mayorista</div>` : ""}</div>
        <button class="add" type="button" data-add="${esc(p.codigo)}" ${sin ? "disabled" : ""} aria-label="Agregar ${esc(p.nombre)}">${sin ? "Sin stock" : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Agregar`}</button></div>
    </article>`;
}

function pintarFicha(cod) {
  const p = productos.find((x) => x.codigo === cod && !ocultos.has(x.codigo)), el = $("#vista-producto");
  if (!p) { el.innerHTML = `<div class="ficha-vacia"><h1>Este producto no está disponible</h1><p class="nota">Puede que se haya agotado o que el negocio lo haya sacado de la tienda.</p><a class="btn-p" href="#">Ver todos los productos</a></div>`; return; }
  const c = catDe(p.categoria), pr = precios(p), sin = p.stock <= 0;
  const rel = productos.filter((x) => x.categoria === p.categoria && x.codigo !== p.codigo && !ocultos.has(x.codigo)).slice(0, 4);
  document.title = `${p.nombre} · myluz`;
  el.innerHTML = `<nav class="migas" aria-label="Ruta"><a href="#">Inicio</a><span>/</span><a href="#" data-cat-ficha="${c.id}">${esc(c.nombre)}</a><span>/</span><span aria-current="page">${esc(p.nombre)}</span></nav>
    <div class="ficha-grid">
      <div class="ficha-foto" style="background:${c.color}"><img src="img/p/${esc(p.codigo)}.webp" alt="${esc(p.nombre)}" width="600" height="450" onerror="this.remove()">${pr.etiqueta ? `<em class="tag may">${pr.etiqueta}</em>` : ""}</div>
      <div class="ficha-info">
        <span class="cod">${esc(c.nombre)} · Cód. ${esc(p.codigo)}</span>
        <h1>${esc(p.nombre)}</h1>
        <div class="precios">${pr.tachado ? `<div class="tachado">${pesos(pr.tachado)}</div>` : ""}<div class="precio grande">${pesos(pr.final)}</div>${pr.may ? `<div class="sub">Tu precio mayorista</div>` : ""}</div>
        <p class="disp ${sin ? "no" : p.stock < 5 ? "pocas" : "si"}">${sin ? "Sin stock por ahora" : p.stock < 5 ? `Quedan ${p.stock} unidades` : "Disponible"}</p>
        ${sin ? "" : `<div class="comprar"><div class="qty grande" role="group" aria-label="Cantidad"><button type="button" data-cant="-1" aria-label="Restar uno">−</button><output id="cant">1</output><button type="button" data-cant="1" aria-label="Sumar uno">+</button></div>
          <button class="cta" type="button" data-add-ficha="${esc(p.codigo)}">Agregar al pedido</button></div>`}
        <div class="desc"><h2>Descripción</h2><p>${esc(p.descripcion || "Sin descripción por ahora.")}</p></div>
        <ul class="ficha-extra">
          <li><b>Envío a toda Mendoza</b><span>Por Correo Argentino. El costo se calcula según el destino.</span></li>
          <li><b>Retiro en el local</b><span>Junín, Mendoza. Te avisamos cuando esté listo.</span></li>
          <li><b>Pagás como quieras</b><span>Transferencia o tarjeta de crédito y débito.</span></li>
        </ul>
      </div>
    </div>
    ${rel.length ? `<h2 class="titulo">También en ${esc(c.nombre)}</h2><div class="grilla rel">${rel.map(tarjeta).join("")}</div>` : ""}`;
}

function pintarGrilla() {
  const l = lista();
  $("#conteo").textContent = `${l.length} producto${l.length === 1 ? "" : "s"}`;
  $("#grilla").innerHTML = l.length ? l.map((p) => tarjeta(p)).join("") : `<p class="vacio">No encontramos productos con esa búsqueda.</p>`;
}

function totales() {
  const items = Object.entries(carro).map(([cod, n]) => ({ p: productos.find((x) => x.codigo === cod), n })).filter((i) => i.p);
  const lista = items.reduce((s, i) => s + i.p.precio * i.n, 0);
  const final = items.reduce((s, i) => s + precios(i.p).final * i.n, 0);
  return { items, lista, final, cant: items.reduce((s, i) => s + i.n, 0) };
}

function pintarCarro() {
  const t = totales(), m = cliente();
  $("#carro-n").textContent = t.cant;
  $("#carro-items").innerHTML = t.items.length ? t.items.map(({ p, n }) => `<div class="item"><b>${esc(p.nombre)}</b>
      <div class="qty"><button type="button" data-menos="${esc(p.codigo)}" aria-label="Quitar uno">−</button><span>${n}</span><button type="button" data-mas="${esc(p.codigo)}" aria-label="Sumar uno">+</button></div>
      <span class="sub">${pesos(precios(p).final)} c/u</span></div>`).join("") : `<p class="nota">Todavía no agregaste productos.</p>`;
  const falta = m && t.final < CONFIG.minimoMayorista;
  $("#carro-pie").innerHTML = t.items.length ? `
    ${m ? `<div class="fila"><span>Precio de lista</span><span class="tachado">${pesos(t.lista)}</span></div>` : ""}
    <div class="fila total"><span>${m ? "Total mayorista" : "Total"}</span><span>${pesos(t.final)}</span></div>
    ${falta ? `<div class="alerta">Te faltan ${pesos(CONFIG.minimoMayorista - t.final)} para la compra mínima mayorista.</div>` : ""}
    <button class="cta" type="button" id="ir-checkout" ${falta ? "disabled" : ""}>Finalizar compra</button>` : "";
  guardar("carro", carro);
}

function abrirCarro(v) { $("#cajon").hidden = !v; }

function dlgCuenta(modo = "ingresar") {
  const d = $("#dlg-cuenta");
  d.innerHTML = `<form class="dlg" method="dialog">
    <h2>Mayoristas y revendedores</h2>
    <div class="seg" role="tablist"><button type="button" role="tab" data-modo="ingresar" aria-selected="${modo === "ingresar"}">Ingresar</button><button type="button" role="tab" data-modo="registro" aria-selected="${modo === "registro"}">Registrarme</button></div>
    ${modo === "ingresar" ? `
      <label class="campo">Email<input name="email" type="email" required autocomplete="email"></label>
      <label class="campo">Contraseña<input name="pass" type="password" required autocomplete="current-password"></label>
      <p class="demo">Demo: <b>mayorista@demo.com</b> con cualquier contraseña.</p>
      <button class="cta" value="ingresar">Ingresar</button>`
    : `<p>Completá tus datos. El negocio revisa tu cuenta y, cuando la aprueba, ves los precios mayoristas.</p>
      <label class="campo">Nombre del negocio<input name="nombre" required></label>
      <label class="campo">CUIT<input name="cuit" required inputmode="numeric"></label>
      <label class="campo">Email<input name="email" type="email" required></label>
      <label class="campo">Teléfono<input name="tel" type="tel" required></label>
      <label class="campo">Contraseña<input name="pass" type="password" required minlength="6"></label>
      <button class="cta" value="registro">Enviar solicitud</button>`}
    <button class="btn-g" type="button" data-cerrar-dlg>Cancelar</button></form>`;
  d.showModal();
  const f = $("form", d);
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(f));
    if (modo === "ingresar") {
      const m = mayoristas.find((x) => x.email.toLowerCase() === datos.email.trim().toLowerCase());
      if (!m) return toast("No encontramos esa cuenta");
      if (m.estado !== "aprobado") return toast("Tu cuenta todavía está pendiente de aprobación");
      sesion = m.id; guardar("sesion", sesion); d.close(); refrescar(); toast("Ahora ves tus precios mayoristas");
    } else {
      mayoristas.push({ id: Date.now(), nombre: datos.nombre, email: datos.email, cuit: datos.cuit, estado: "pendiente", desc: CONFIG.descMayorista * 100 });
      guardar("mayoristas", mayoristas); d.close(); toast("¡Listo! Te avisamos cuando aprobemos tu cuenta");
    }
  });
}

function dlgCheckout() {
  const t = totales(), m = cliente(), d = $("#dlg-checkout");
  d.innerHTML = `<form class="dlg" method="dialog">
    <h2>Finalizar compra</h2>
    <label class="campo">Nombre y apellido<input name="nombre" required autocomplete="name" value="${m ? esc(m.nombre) : ""}"></label>
    <label class="campo">WhatsApp<input name="tel" type="tel" required autocomplete="tel"></label>
    <fieldset class="opciones" style="border:0;padding:0;margin:0"><legend class="campo">Entrega</legend>
      <label class="op"><input type="radio" name="entrega" value="correo" checked><span><b>Envío por Correo Argentino</b><small>A toda Mendoza. El costo se calcula según el destino.</small></span></label>
      <label class="op"><input type="radio" name="entrega" value="retiro"><span><b>Retiro en el local</b><small>Junín, Mendoza. Te avisamos cuando esté listo.</small></span></label>
    </fieldset>
    <fieldset class="opciones" style="border:0;padding:0;margin:0"><legend class="campo">Pago</legend>
      <label class="op"><input type="radio" name="pago" value="transf" checked><span><b>Transferencia</b><small>Te mostramos el alias al confirmar.</small></span></label>
      <label class="op"><input type="radio" name="pago" value="tarjeta"><span><b>Tarjeta de crédito o débito</b><small>Pagás en Mercado Pago.</small></span></label>
    </fieldset>
    <div class="fila total"><span>Total</span><span>${pesos(t.final)}</span></div>
    <p class="legal-ok">Al confirmar aceptás los <a href="legales/terminos/" target="_blank">términos y condiciones</a> y la <a href="legales/privacidad/" target="_blank">política de privacidad</a>.</p>
    <button class="cta">Confirmar pedido</button><button class="btn-g" type="button" data-cerrar-dlg>Volver</button></form>`;
  d.showModal();
  $("form", d).addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(e.target));
    const num = "ML-" + String(Date.now()).slice(-5);
    const total = t.final;
    const pedidos = leer("pedidos", []); pedidos.unshift({ num, nombre: datos.nombre, total, pago: datos.pago, entrega: datos.entrega, may: !!m }); guardar("pedidos", pedidos.slice(0, 20));
    d.innerHTML = `<div class="ok-box"><div class="circ">✓</div><h2>¡Pedido ${num} recibido!</h2>
      <p>${datos.pago === "transf" ? `Transferí ${pesos(total)} al alias <b>${CONFIG.alias}</b> y mandanos el comprobante por WhatsApp.` : "En la tienda real, acá se abre Mercado Pago para pagar con tarjeta."}</p>
      <p>Al negocio le llega un aviso con el pedido completo.</p><button class="cta" type="button" data-cerrar-dlg>Seguir comprando</button></div>`;
    carro = {}; pintarCarro(); abrirCarro(false);
  });
}

function pintarProductosPanel() {
  const q = ($("#q-panel")?.value || "").trim().toLowerCase();
  const l = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
  $("#tabla-prod").innerHTML = `<p class="nota">${productos.length - ocultos.size} visibles · ${ocultos.size} ocultos</p>` + l.map((p) => {
    const vis = !ocultos.has(p.codigo);
    return `<div class="reg prod${vis ? "" : " oculto"}"><b>${esc(p.nombre)}</b>
      <div class="der"><span class="sub">${pesos(p.precio)} · stock ${p.stock}</span>
        <label class="switch"><input type="checkbox" data-vis="${esc(p.codigo)}" ${vis ? "checked" : ""}><span>${vis ? "Visible" : "Oculto"}</span></label></div>
      <span class="sub">${esc(p.codigo)} · ${esc(catDe(p.categoria).nombre)}</span></div>`;
  }).join("");
}

function pintarPanel() {
  pintarProductosPanel();
  $("#tabla-may").innerHTML = mayoristas.map((m) => `<div class="reg"><b>${esc(m.nombre)}</b>
    <div class="der"><span class="estado ${m.estado === "aprobado" ? "apr" : "pend"}">${m.estado === "aprobado" ? "Aprobado" : "Pendiente"}</span>
      <label class="sub">Desc. <input class="pct" type="number" min="0" max="80" value="${m.desc}" data-pct="${m.id}" aria-label="Descuento de ${esc(m.nombre)}"> %</label>
      ${m.estado === "aprobado" ? "" : `<button class="mini" type="button" data-aprobar="${m.id}">Aprobar</button>`}</div>
    <span class="sub">${esc(m.email)} · CUIT ${esc(m.cuit)}</span></div>`).join("");
  const ped = leer("pedidos", []);
  $("#tabla-ped").innerHTML = ped.length ? ped.map((p) => `<div class="reg"><b>${esc(p.num)} · ${esc(p.nombre)}</b><div class="der"><b>${pesos(p.total)}</b></div>
    <span class="sub">${p.may ? "Mayorista" : "Minorista"} · ${p.pago === "transf" ? "Transferencia" : "Tarjeta"} · ${p.entrega === "retiro" ? "Retiro en local" : "Correo Argentino"}</span></div>`).join("")
    : `<p class="nota">Todavía no hay pedidos. Hacé uno de prueba en la tienda.</p>`;
}

function importarCSV(texto) {
  const filas = texto.trim().split(/\r?\n/).map((l) => l.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, "")));
  const cab = filas.shift().map((c) => c.toLowerCase());
  const idx = (n) => cab.indexOf(n);
  if (["codigo", "nombre", "precio"].some((n) => idx(n) < 0)) throw new Error("Faltan columnas: codigo, nombre y precio son obligatorias.");
  const nuevos = filas.filter((f) => f[idx("codigo")]).map((f) => ({
    codigo: f[idx("codigo")], nombre: f[idx("nombre")],
    categoria: idx("categoria") >= 0 ? (window.CATEGORIAS.find((c) => c.nombre.toLowerCase() === (f[idx("categoria")] || "").toLowerCase())?.id || "bazar") : "bazar",
    precio: Number(String(f[idx("precio")]).replace(/\./g, "").replace(",", ".")) || 0,
    stock: idx("stock") >= 0 ? Number(f[idx("stock")]) || 0 : 10,
  })).filter((p) => p.precio > 0);
  if (!nuevos.length) throw new Error("No encontramos productos válidos en el archivo.");
  productos = nuevos; return nuevos.length;
}

function ir(vista) {
  $("#vista-tienda").hidden = vista !== "tienda"; $("#vista-panel").hidden = vista !== "panel"; $("#vista-producto").hidden = vista !== "producto";
  if (vista !== "producto") document.title = "myluz · prototipo de tienda online";
  $("#login-panel").hidden = admin; $("#panel-contenido").hidden = !admin;
  if (vista === "panel" && admin) pintarPanel();
  if (vista === "panel" && !admin) setTimeout(() => $("#form-admin [name=usuario]").focus(), 0);
  window.scrollTo(0, 0);
}

function refrescar() { pintarCats(); pintarIntro(); pintarGrilla(); pintarCarro(); if (location.hash.startsWith("#p/")) pintarFicha(decodeURIComponent(location.hash.slice(3))); }

document.addEventListener("click", (e) => {
  const b = e.target.closest("button, a"); if (!b) return;
  if (b.dataset.cat) { filtro.cat = b.dataset.cat; pintarCats(); pintarGrilla(); if (b.classList.contains("tile")) $("#barra").scrollIntoView({ behavior: "smooth" }); }
  else if (b.dataset.cant) { const o = $("#cant"); o.textContent = Math.max(1, Math.min(99, Number(o.textContent) + Number(b.dataset.cant))); }
  else if (b.dataset.addFicha) { const c = b.dataset.addFicha, n = Number($("#cant").textContent); carro[c] = (carro[c] || 0) + n; pintarCarro(); toast(`Agregaste ${n} al pedido`); }
  else if (b.dataset.catFicha) { e.preventDefault(); filtro.cat = b.dataset.catFicha; location.hash = ""; segunHash(); refrescar(); setTimeout(() => $("#barra").scrollIntoView(), 0); }
  else if (b.dataset.add) { carro[b.dataset.add] = (carro[b.dataset.add] || 0) + 1; pintarCarro(); toast("Agregado al pedido"); }
  else if (b.dataset.mas) { carro[b.dataset.mas]++; pintarCarro(); }
  else if (b.dataset.menos) { if (--carro[b.dataset.menos] <= 0) delete carro[b.dataset.menos]; pintarCarro(); }
  else if (b.id === "btn-carro") abrirCarro(true);
  else if (b.hasAttribute("data-cerrar")) abrirCarro(false);
  else if (b.id === "ir-checkout") dlgCheckout();
  else if (b.id === "btn-may-hero" || b.id === "btn-may-pie") dlgCuenta();
  else if (b.id === "btn-cuenta") { if (cliente()) { sesion = null; guardar("sesion", null); refrescar(); toast("Saliste de la cuenta mayorista"); } else dlgCuenta(); }
  else if (b.dataset.modo) dlgCuenta(b.dataset.modo);
  else if (b.hasAttribute("data-cerrar-dlg")) b.closest("dialog").close();
  else if (b.dataset.ir) { e.preventDefault(); history.replaceState(null, "", b.dataset.ir === "panel" ? "#panel" : location.pathname); ir(b.dataset.ir); }
  else if (b.dataset.tab) { $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b)); $$("[data-panel]").forEach((s) => (s.hidden = s.dataset.panel !== b.dataset.tab)); }
  else if (b.dataset.aprobar) { const m = mayoristas.find((x) => x.id == b.dataset.aprobar); m.estado = "aprobado"; guardar("mayoristas", mayoristas); pintarPanel(); toast(`${m.nombre} ya ve precios mayoristas`); }
});
$("#cajon").addEventListener("click", (e) => { if (e.target.id === "cajon") abrirCarro(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrirCarro(false); });
document.addEventListener("change", (e) => {
  if (e.target.dataset.pct) { const m = mayoristas.find((x) => x.id == e.target.dataset.pct); m.desc = Math.max(0, Math.min(80, Number(e.target.value) || 0)); guardar("mayoristas", mayoristas); toast(`Descuento de ${m.nombre}: ${m.desc}%`); }
  if (e.target.dataset.vis) {
    const c = e.target.dataset.vis; e.target.checked ? ocultos.delete(c) : ocultos.add(c);
    guardar("ocultos", [...ocultos]); delete carro[c]; pintarProductosPanel(); pintarGrilla(); pintarCarro();
    toast(e.target.checked ? "El producto se ve en la tienda" : "Producto oculto en la tienda");
  }
  if (e.target.id === "orden") { filtro.orden = e.target.value; pintarGrilla(); }
  if (e.target.id === "csv" && e.target.files[0]) {
    e.target.files[0].text().then((t) => { try { const n = importarCSV(t); $("#imp-res").textContent = `Se cargaron ${n} productos. Volvé a la tienda para verlos.`; carro = {}; refrescar(); } catch (err) { $("#imp-res").textContent = err.message; } });
  }
});
$("#form-admin").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const ok = d.usuario.trim().toLowerCase() === ADMIN_DEMO.usuario && d.pass === ADMIN_DEMO.pass;
  $("#admin-error").hidden = ok;
  if (!ok) return;
  admin = true; guardar("admin", true); e.target.reset(); ir("panel"); toast("Bienvenido al panel");
});
$("#admin-salir").addEventListener("click", () => { admin = false; guardar("admin", false); ir("panel"); toast("Saliste del panel"); });
$("#q").addEventListener("input", (e) => { filtro.q = e.target.value; pintarGrilla(); });
$("#q-panel").addEventListener("input", pintarProductosPanel);

refrescar();
function segunHash() {
  const h = location.hash;
  if (h === "#panel") return ir("panel");
  if (h.startsWith("#p/")) { pintarFicha(decodeURIComponent(h.slice(3))); return ir("producto"); }
  ir("tienda");
}
if (location.hash === "#panel" || location.hash.startsWith("#p/")) segunHash();
window.addEventListener("hashchange", segunHash);
