"use strict";
// Prototipo de myluz: todo corre en el navegador con datos de ejemplo. No hay servidor ni datos reales.

const CONFIG = {
  envioGratisDesde: 100000, // pedido del dueño (27/11): envío gratis desde $100.000
  alias: "alias.del.negocio",
};

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");
const guardar = (k, v) => { try { localStorage.setItem("myluz:" + k, JSON.stringify(v)); } catch {} };
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem("myluz:" + k)) ?? def; } catch { return def; } };

// Mayoristas de ejemplo (el panel los aprueba y les pone su descuento)
let mayoristas = leer("revendedores", [
  { id: 1, nombre: "Distribuidora Andes", email: "revendedor@demo.com", cuit: "30-00000000-1", estado: "aprobado" },
  { id: 2, nombre: "Kiosco El Sol", email: "kiosco@demo.com", cuit: "20-00000000-2", estado: "aprobado" },
  { id: 3, nombre: "Bazar La Esquina", email: "bazar@demo.com", cuit: "27-00000000-3", estado: "pendiente" },
]);
let productos = window.PRODUCTOS.slice();
let carro = leer("carro", {});
let sesion = leer("sesion", null); // id de mayorista logueado
let filtro = { cat: "todas", q: "", orden: "rel" };
// shortcut: login de muestra en el navegador (el prototipo no tiene datos reales); en la tienda real va con Supabase Auth.
const ADMIN_DEMO = { usuario: "admin", pass: "demo" };
let admin = leer("admin", false);
// Stock visible por producto (panel): vacío = se muestra el stock real; 0 = el producto no aparece en la tienda.
// Nunca se muestra más que el stock real, para no vender lo que no hay.
let stockVis = leer("stockVisible", {});
// Precio fijo de revendedor por producto: viene en los datos y el negocio lo puede cambiar desde el panel.
let preciosRev = leer("preciosRev", {});
const precioRevDe = (p) => preciosRev[p.codigo] ?? p.precioRev ?? p.precio; // sin precio de revendedor cargado, ve el de contado
// Sin stock visible cargado se muestra "Disponible" sin número (pedido del dueño); con número, nunca más que el real.
const stockDe = (p) => (stockVis[p.codigo] == null ? (p.stock > 0 ? Infinity : 0) : Math.min(stockVis[p.codigo], p.stock));
const visible = (p) => stockVis[p.codigo] !== 0;

const cliente = () => mayoristas.find((m) => m.id === sesion && m.estado === "aprobado") || null;
const catDe = (id) => window.CATEGORIAS.find((c) => c.id === id) || { nombre: id, color: "#eee" };

// Precios: p.precio es el precio de contado (transferencia o efectivo) que carga el negocio.
// El público ve el precio de lista (tarjeta, cuotas sin interés) y el de contado con el descuento (public/precio.js).
// El mayorista ve el de contado tachado y su precio (descuento real sobre el contado).
const pctTransf = Math.round(window.Precio.DESCUENTO * 100);
function precios(p) {
  const m = cliente();
  if (m) return { tachado: p.precio, final: precioRevDe(p), tarjeta: precioRevDe(p), etiqueta: "Revendedor", may: true };
  const lista = window.Precio.precioLista(p.precio);
  return { tachado: null, final: p.precio, tarjeta: lista, cuota: window.Precio.valorCuota(lista), etiqueta: null, may: false };
}
// Bloque de precios del público: lista + cuotas + contado con descuento.
const preciosPublico = (pr, grande) => {
  const antes = window.Precio.precioTachado(pr.tarjeta), off = Math.round((1 - pr.tarjeta / antes) * 100);
  return `<div class="antes"><span class="tachado">${pesos(antes)}</span> <span class="off rojo">${off}% off</span></div>
  <div class="precio${grande ? " grande" : ""}">${pesos(pr.tarjeta)}</div>
  <div class="cuotas">${window.Precio.CUOTAS} cuotas sin interés de ${pesos(pr.cuota)}</div>
  <div class="contado"><b>${pesos(pr.final)}</b> ${grande ? "con transferencia o efectivo" : "en efectivo o transf."} <span class="off">${pctTransf}% off</span></div>`;
};

function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2200); }

function pintarCats() {
  const cats = [{ id: "todas", nombre: "Todo" }, ...window.CATEGORIAS];
  $("#cats").innerHTML = cats.map((c) => `<button type="button" data-cat="${c.id}" aria-pressed="${filtro.cat === c.id}">${esc(c.nombre)}</button>`).join("");
}

function pintarIntro() {
  const m = cliente();
  $("#intro").innerHTML = m
    ? `<div class="hero may"><div class="hero-txt"><span class="eyebrow">Cuenta de revendedor</span><h1>Hola, ${esc(m.nombre)}</h1>
       <p>Estás viendo tus precios de revendedor en toda la tienda.</p>
       <div class="chips"><span class="chip may">Precios fijos de revendedor</span><span class="chip">Envíos a toda Mendoza</span></div></div></div>`
    : `<div class="hero"><div class="hero-txt"><span class="eyebrow">Multirubro en Junín, Mendoza</span>
       <h1>Todo para tu casa,<br>en un solo lugar</h1>
       <p>Bazar, perfumería, zapatería, librería, juguetería y mucho más. Pedí online y recibilo en toda Mendoza o retiralo en el local.</p>
       <div class="hero-cta"><a class="btn-p" href="#grilla">Ver productos</a><button class="btn-l" type="button" id="btn-may-hero">Soy revendedor</button></div></div>
       <ul class="beneficios">
         <li><b>Envío gratis desde ${pesos(CONFIG.envioGratisDesde)}</b><span>A toda Mendoza por Correo Argentino</span></li>
         <li><b>Retiro en el local</b><span>Junín, Mendoza</span></li>
         <li><b>3 cuotas sin interés</b><span>o ${pctTransf}% off con transferencia o efectivo</span></li>
         <li><b>Precios para revendedores</b><span>Con cuenta aprobada</span></li>
       </ul></div>
       <h2 class="titulo">Comprá por categoría</h2>
       <div class="cat-tiles">${window.CATEGORIAS.map((c) => { const p = productos.find((x) => x.codigo === c.foto) || productos.find((x) => x.categoria === c.id);
         return `<button type="button" class="tile" data-cat="${c.id}">${p ? `<img src="img/p/${esc(p.codigo)}.webp" alt="" loading="lazy" width="600" height="450">` : ""}<span>${esc(c.nombre)}</span></button>`; }).join("")}</div>`;
  $("#btn-cuenta").textContent = m ? m.nombre.split(" ")[0] + " · salir" : "Soy revendedor";
  $("#btn-cuenta").classList.toggle("may", !!m);
}

function lista() {
  const q = filtro.q.trim().toLowerCase();
  let l = productos.filter((p) => visible(p) && (filtro.cat === "todas" || p.categoria === filtro.cat) && (!q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)));
  if (filtro.orden === "asc") l.sort((a, b) => a.precio - b.precio);
  if (filtro.orden === "desc") l.sort((a, b) => b.precio - a.precio);
  if (filtro.orden === "az") l.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return l;
}

function tarjeta(p) {
  const c = catDe(p.categoria), pr = precios(p), st = stockDe(p), sin = st <= 0, url = `#p/${encodeURIComponent(p.codigo)}`;
  return `<article class="card${sin ? " agotado" : ""}">
      <a class="foto" href="${url}" style="background:${c.color}" tabindex="-1" aria-hidden="true"><img src="img/p/${esc(p.codigo)}.webp" alt="" loading="lazy" width="600" height="450">
        ${pr.etiqueta ? `<em class="tag may">${pr.etiqueta}</em>` : ""}${sin ? `<em class="sin">Sin stock</em>` : ""}</a>
      <div class="info"><span class="cod">${esc(c.nombre)}${!sin && st < 5 ? ` · <b class="pocas">Últimas ${st}</b>` : ""}</span><h3 class="nom"><a href="${url}">${esc(p.nombre)}</a></h3>
        <div class="precios">${pr.may ? `<div class="tachado">${pesos(pr.tachado)}</div><div class="precio">${pesos(pr.final)}</div><div class="sub">Precio de revendedor</div>` : preciosPublico(pr)}</div>
        <button class="add" type="button" data-add="${esc(p.codigo)}" ${sin ? "disabled" : ""} aria-label="Agregar ${esc(p.nombre)}">${sin ? "Sin stock" : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Agregar`}</button></div>
    </article>`;
}

function pintarFicha(cod) {
  const p = productos.find((x) => x.codigo === cod && visible(x)), el = $("#vista-producto");
  if (!p) { el.innerHTML = `<div class="ficha-vacia"><h1>Este producto no está disponible</h1><p class="nota">Puede que se haya agotado o que el negocio lo haya sacado de la tienda.</p><a class="btn-p" href="#">Ver todos los productos</a></div>`; return; }
  const c = catDe(p.categoria), pr = precios(p), st = stockDe(p), sin = st <= 0;
  const rel = productos.filter((x) => x.categoria === p.categoria && x.codigo !== p.codigo && visible(x)).slice(0, 4);
  document.title = `${p.nombre} · myluz`;
  el.innerHTML = `<nav class="migas" aria-label="Ruta"><a href="#">Inicio</a><span>/</span><a href="#" data-cat-ficha="${c.id}">${esc(c.nombre)}</a><span>/</span><span aria-current="page">${esc(p.nombre)}</span></nav>
    <div class="ficha-grid">
      <div class="ficha-foto" style="background:${c.color}"><img src="img/p/${esc(p.codigo)}.webp" alt="${esc(p.nombre)}" width="600" height="450">${pr.etiqueta ? `<em class="tag may">${pr.etiqueta}</em>` : ""}</div>
      <div class="ficha-info">
        <span class="cod">${esc(c.nombre)} · Cód. ${esc(p.codigo)}</span>
        <h1>${esc(p.nombre)}</h1>
        <div class="precios">${pr.may ? `<div class="tachado">${pesos(pr.tachado)}</div><div class="precio grande">${pesos(pr.final)}</div><div class="sub">Tu precio de revendedor</div>` : preciosPublico(pr, true)}</div>
        <p class="disp ${sin ? "no" : st < 5 ? "pocas" : "si"}">${sin ? "Sin stock por ahora" : st < 5 ? `Quedan ${st} unidades` : "Disponible"}</p>
        ${sin ? "" : `<div class="comprar"><div class="qty grande" role="group" aria-label="Cantidad"><button type="button" data-cant="-1" aria-label="Restar uno">−</button><output id="cant">1</output><button type="button" data-cant="1" aria-label="Sumar uno">+</button></div>
          <button class="cta" type="button" data-add-ficha="${esc(p.codigo)}">Agregar al pedido</button></div>`}
        <div class="desc"><h2>Descripción</h2><p>${esc(p.descripcion || "Sin descripción por ahora.")}</p></div>
        <ul class="ficha-extra">
          <li><b>Envío a toda Mendoza</b><span>Gratis en compras desde ${pesos(CONFIG.envioGratisDesde)}. Por Correo Argentino, a domicilio o a sucursal. El costo se calcula con tu código postal al finalizar la compra.</span></li>
          <li><b>Retiro en el local</b><span>Junín, Mendoza. Te avisamos cuando esté listo.</span></li>
          <li><b>Pagás como quieras</b><span>Tarjeta en hasta ${window.Precio.CUOTAS} cuotas sin interés, o ${pctTransf}% off con transferencia o efectivo.</span></li>
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
  const tarjeta = items.reduce((s, i) => s + precios(i.p).tarjeta * i.n, 0);
  return { items, lista, final, tarjeta, cant: items.reduce((s, i) => s + i.n, 0) };
}

// Peso estimado por nombre y categoría (public/peso.js). Si un producto trae peso cargado, manda ese.
function itemsEnvio(t) {
  return t.items.map(({ p, n }) => ({ quantity: n, weightKg: p.peso || window.Peso.pesoEstimadoKg(p.nombre, p.categoria) }));
}

function pintarCarro() {
  const t = totales(), m = cliente();
  $("#carro-n").textContent = t.cant;
  $("#carro-items").innerHTML = t.items.length ? t.items.map(({ p, n }) => `<div class="item"><b>${esc(p.nombre)}</b>
      <div class="qty"><button type="button" data-menos="${esc(p.codigo)}" aria-label="Quitar uno">−</button><span>${n}</span><button type="button" data-mas="${esc(p.codigo)}" aria-label="Sumar uno">+</button></div>
      <span class="sub">${pesos(precios(p).final)} c/u</span></div>`).join("") : `<p class="nota">Todavía no agregaste productos.</p>`;
  $("#carro-pie").innerHTML = t.items.length ? `
    ${m ? `<div class="fila"><span>Precio de contado</span><span class="tachado">${pesos(t.lista)}</span></div>` : ""}
    ${m ? `<div class="fila total"><span>Total revendedor</span><span>${pesos(t.final)}</span></div>`
      : `<div class="fila total"><span>Total con tarjeta</span><span>${pesos(t.tarjeta)}</span></div>
    <div class="fila"><span>${window.Precio.CUOTAS} cuotas sin interés de</span><span>${pesos(window.Precio.valorCuota(t.tarjeta))}</span></div>
    <div class="fila contado"><span>Con transferencia o efectivo (${pctTransf}% off)</span><b>${pesos(t.final)}</b></div>`}
    <button class="cta" type="button" id="ir-checkout">Finalizar compra</button>` : "";
  guardar("carro", carro);
}

function abrirCarro(v) { $("#cajon").hidden = !v; }

function dlgCuenta(modo = "ingresar") {
  const d = $("#dlg-cuenta");
  d.innerHTML = `<form class="dlg" method="dialog">
    <h2>Revendedores</h2>
    <div class="seg" role="tablist"><button type="button" role="tab" data-modo="ingresar" aria-selected="${modo === "ingresar"}">Ingresar</button><button type="button" role="tab" data-modo="registro" aria-selected="${modo === "registro"}">Registrarme</button></div>
    ${modo === "ingresar" ? `
      <label class="campo">Email<input name="email" type="email" required autocomplete="email"></label>
      <label class="campo">Contraseña<input name="pass" type="password" required autocomplete="current-password"></label>
      <p class="demo">Demo: <b>revendedor@demo.com</b> con cualquier contraseña.</p>
      <button class="cta" value="ingresar">Ingresar</button>`
    : `<p>Completá tus datos. El negocio revisa tu cuenta y, cuando la aprueba, ves tus precios de revendedor.</p>
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
      sesion = m.id; guardar("sesion", sesion); d.close(); refrescar(); toast("Ahora ves tus precios de revendedor");
    } else {
      mayoristas.push({ id: Date.now(), nombre: datos.nombre, email: datos.email, cuit: datos.cuit, estado: "pendiente" });
      guardar("revendedores", mayoristas); d.close(); toast("¡Listo! Te avisamos cuando aprobemos tu cuenta");
    }
  });
}

function dlgCheckout() {
  const t = totales(), m = cliente(), d = $("#dlg-checkout");
  let cotizacion = null; // { domicilio, sucursal, weightKg } de Correo Argentino
  d.innerHTML = `<form class="dlg" method="dialog" novalidate>
    <h2>Finalizar compra</h2>
    <label class="campo">Nombre y apellido<input name="nombre" required autocomplete="name" value="${m ? esc(m.nombre) : ""}"></label>
    <label class="campo">WhatsApp<input name="tel" type="tel" required autocomplete="tel"></label>
    <fieldset class="opciones" style="border:0;padding:0;margin:0"><legend class="campo">Entrega</legend>
      <label class="op"><input type="radio" name="entrega" value="correo" checked><span><b>Envío por Correo Argentino</b><small>A toda Mendoza.</small></span></label>
      <label class="op"><input type="radio" name="entrega" value="retiro"><span><b>Retiro en el local</b><small>Junín, Mendoza. Sin costo. Te avisamos cuando esté listo.</small></span></label>
    </fieldset>
    <div class="envio-box" id="envio-box">
      <label class="campo">Código postal<input name="cp" inputmode="numeric" autocomplete="postal-code" placeholder="Ej.: 5577" maxlength="9"></label>
      <p class="envio-msg" id="envio-msg" aria-live="polite">Escribí tu código postal para calcular el envío.</p>
      <div class="opciones" id="envio-ops" hidden>
        <label class="op"><input type="radio" name="servicio" value="domicilio" checked><span><b>A domicilio · <span id="p-dom"></span></b><small>Te lo lleva el correo a tu casa.</small></span></label>
        <label class="op"><input type="radio" name="servicio" value="sucursal"><span><b>A sucursal · <span id="p-suc"></span></b><small>Lo retirás en la sucursal de Correo más cercana.</small></span></label>
      </div>
    </div>
    <fieldset class="opciones" style="border:0;padding:0;margin:0"><legend class="campo">Pago</legend>
      <label class="op"><input type="radio" name="pago" value="transf" checked><span><b>Transferencia o efectivo${m ? "" : ` · ${pctTransf}% off`}</b><small>Te mostramos el alias al confirmar. En efectivo, si retirás en el local.</small></span></label>
      <label class="op"><input type="radio" name="pago" value="tarjeta"><span><b>Tarjeta de crédito o débito</b><small>${m ? "Pagás en Mercado Pago." : `En Mercado Pago, hasta ${window.Precio.CUOTAS} cuotas sin interés.`}</small></span></label>
    </fieldset>
    <div class="resumen"><div class="fila"><span>Productos</span><span id="r-prod">${pesos(t.final)}</span></div>
      <div class="fila"><span>Envío</span><span id="r-envio">—</span></div>
      <div class="fila total"><span>Total</span><span id="r-total">${pesos(t.final)}</span></div></div>
    <p class="legal-ok">Al confirmar aceptás los <a href="legales/terminos/" target="_blank">términos y condiciones</a> y la <a href="legales/privacidad/" target="_blank">política de privacidad</a>.</p>
    <p class="error" id="chk-error" role="alert" hidden></p>
    <button class="cta">Confirmar pedido</button><button class="btn-g" type="button" data-cerrar-dlg>Volver</button></form>`;
  d.showModal();
  const f = $("form", d);
  // Con tarjeta se cobra el precio de lista; con transferencia o efectivo, el de contado.
  const subtotal = () => (new FormData(f).get("pago") === "tarjeta" ? t.tarjeta : t.final);
  const costoEnvio = () => {
    const fd = new FormData(f);
    if (fd.get("entrega") !== "correo") return 0;
    if (!cotizacion) return null;
    return subtotal() >= CONFIG.envioGratisDesde ? 0 : cotizacion[fd.get("servicio")];
  };
  const actualizar = () => {
    const fd = new FormData(f), correo = fd.get("entrega") === "correo";
    $("#envio-box", d).hidden = !correo;
    const cp = String(fd.get("cp") || "").trim();
    cotizacion = null;
    if (correo && cp.replace(/\s/g, "").length >= 4) {
      try {
        cotizacion = window.Envio.cotizarMendoza(cp, itemsEnvio(t));
        $("#p-dom", d).textContent = pesos(cotizacion.domicilio);
        $("#p-suc", d).textContent = pesos(cotizacion.sucursal);
        $("#envio-msg", d).textContent = `Costo estimado para un paquete de unos ${String(cotizacion.weightKg).replace(".", ",")} kg, con la tarifa de Correo Argentino (${window.Envio.RATES_UPDATED_AT}).`;
      } catch (err) { $("#envio-msg", d).textContent = err.message; }
    } else if (correo) $("#envio-msg", d).textContent = "Escribí tu código postal para calcular el envío.";
    $("#envio-ops", d).hidden = !cotizacion;
    const envio = costoEnvio(), prod = subtotal();
    $("#r-prod", d).textContent = pesos(prod);
    $("#r-envio", d).textContent = !correo ? "Sin costo (retiro)" : envio == null ? "—" : envio === 0 ? `Gratis (compra desde ${pesos(CONFIG.envioGratisDesde)})` : pesos(envio);
    $("#r-total", d).textContent = pesos(prod + (envio || 0));
  };
  f.addEventListener("input", actualizar);
  f.addEventListener("change", actualizar);
  actualizar();
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(f));
    const envio = costoEnvio(), err = $("#chk-error", d);
    const falta = !String(datos.nombre || "").trim() ? "Escribí tu nombre." : !String(datos.tel || "").trim() ? "Escribí tu WhatsApp." : envio == null ? "Escribí un código postal de Mendoza válido para calcular el envío." : "";
    err.hidden = !falta; err.textContent = falta;
    if (falta) return;
    const num = "ML-" + String(Date.now()).slice(-5);
    const total = subtotal() + envio;
    const pedidos = leer("pedidos", []); pedidos.unshift({ num, nombre: datos.nombre, total, envio, pago: datos.pago, entrega: datos.entrega, may: !!m }); guardar("pedidos", pedidos.slice(0, 20));
    d.innerHTML = `<div class="ok-box"><div class="circ">✓</div><h2>¡Pedido ${num} recibido!</h2>
      <p>Total ${pesos(total)}${envio ? ` (incluye envío ${pesos(envio)})` : ""}.</p>
      <p>${datos.pago === "transf" ? `Transferí ${pesos(total)} al alias <b>${CONFIG.alias}</b> y mandanos el comprobante por WhatsApp.` : "En la tienda real, acá se abre Mercado Pago para pagar con tarjeta."}</p>
      <p>Al negocio le llega un aviso con el pedido completo.</p><button class="cta" type="button" data-cerrar-dlg>Seguir comprando</button></div>`;
    carro = {}; pintarCarro(); abrirCarro(false);
  });
}

function pintarProductosPanel() {
  const q = ($("#q-panel")?.value || "").trim().toLowerCase();
  const l = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
  const ocultosN = productos.filter((p) => !visible(p)).length;
  $("#tabla-prod").innerHTML = `<p class="nota">${productos.length - ocultosN} visibles · ${ocultosN} ocultos. <b>Stock visible</b>: lo que ve el cliente. Vacío = "Disponible" sin número; 0 = el producto no aparece en la tienda.</p>` + l.map((p) => {
    const vis = visible(p), v = stockVis[p.codigo];
    return `<div class="reg prod${vis ? "" : " oculto"}"><b>${esc(p.nombre)}</b>
      <div class="der"><span class="sub">Contado ${pesos(p.precio)} · lista ${pesos(window.Precio.precioLista(p.precio))} · stock real ${p.stock}</span>
        <label class="stock-vis">Revendedor $<input type="number" min="1" step="1" inputmode="numeric" data-prec-rev="${esc(p.codigo)}" value="${precioRevDe(p)}" aria-label="Precio de revendedor de ${esc(p.nombre)}"></label>
        <label class="stock-vis">Stock visible<input type="number" min="0" step="1" inputmode="numeric" data-stock-vis="${esc(p.codigo)}" value="${v == null ? "" : v}" placeholder="Disponible"></label></div>
      <span class="sub">${esc(p.codigo)} · ${esc(catDe(p.categoria).nombre)}</span></div>`;
  }).join("");
}

function pintarPanel() {
  pintarProductosPanel();
  $("#tabla-may").innerHTML = mayoristas.map((m) => `<div class="reg"><b>${esc(m.nombre)}</b>
    <div class="der"><span class="estado ${m.estado === "aprobado" ? "apr" : "pend"}">${m.estado === "aprobado" ? "Aprobado" : "Pendiente"}</span>
      ${m.estado === "aprobado" ? "" : `<button class="mini" type="button" data-aprobar="${m.id}">Aprobar</button>`}</div>
    <span class="sub">${esc(m.email)} · CUIT ${esc(m.cuit)}</span></div>`).join("");
  const ped = leer("pedidos", []);
  $("#tabla-ped").innerHTML = ped.length ? ped.map((p) => `<div class="reg"><b>${esc(p.num)} · ${esc(p.nombre)}</b><div class="der"><b>${pesos(p.total)}</b></div>
    <span class="sub">${p.may ? "Revendedor" : "Minorista"} · ${p.pago === "transf" ? "Transferencia" : "Tarjeta"} · ${p.entrega === "retiro" ? "Retiro en local" : `Correo Argentino ${pesos(p.envio || 0)}`}</span></div>`).join("")
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
    precioRev: idx("precio_revendedor") >= 0 ? Number(String(f[idx("precio_revendedor")]).replace(/\./g, "").replace(",", ".")) || undefined : undefined,
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
  else if (b.dataset.cant) { const o = $("#cant"); const p = productos.find((x) => x.codigo === decodeURIComponent(location.hash.slice(3))); o.textContent = Math.max(1, Math.min(p ? stockDe(p) : 99, 99, Number(o.textContent) + Number(b.dataset.cant))); }
  else if (b.dataset.addFicha) { const c = b.dataset.addFicha, n = Number($("#cant").textContent); const p = productos.find((x) => x.codigo === c), tope = stockDe(p), antes = carro[c] || 0; carro[c] = Math.min(tope, antes + n); pintarCarro(); toast(carro[c] - antes < n ? `Solo hay ${tope} disponibles` : `Agregaste ${n} al pedido`); }
  else if (b.dataset.catFicha) { e.preventDefault(); filtro.cat = b.dataset.catFicha; location.hash = ""; segunHash(); refrescar(); setTimeout(() => $("#barra").scrollIntoView(), 0); }
  else if (b.dataset.add) { const c = b.dataset.add, tope = stockDe(productos.find((x) => x.codigo === c)); if ((carro[c] || 0) >= tope) return toast(`Solo hay ${tope} disponibles`); carro[c] = (carro[c] || 0) + 1; pintarCarro(); toast("Agregado al pedido"); }
  else if (b.dataset.mas) { const c = b.dataset.mas, tope = stockDe(productos.find((x) => x.codigo === c)); if (carro[c] >= tope) return toast(`Solo hay ${tope} disponibles`); carro[c]++; pintarCarro(); }
  else if (b.dataset.menos) { if (--carro[b.dataset.menos] <= 0) delete carro[b.dataset.menos]; pintarCarro(); }
  else if (b.id === "btn-carro") abrirCarro(true);
  else if (b.hasAttribute("data-cerrar")) abrirCarro(false);
  else if (b.id === "ir-checkout") dlgCheckout();
  else if (b.id === "btn-may-hero" || b.id === "btn-may-pie") dlgCuenta();
  else if (b.id === "btn-cuenta") { if (cliente()) { sesion = null; guardar("sesion", null); refrescar(); toast("Saliste de tu cuenta de revendedor"); } else dlgCuenta(); }
  else if (b.dataset.modo) dlgCuenta(b.dataset.modo);
  else if (b.hasAttribute("data-cerrar-dlg")) b.closest("dialog").close();
  else if (b.dataset.ir) { e.preventDefault(); history.replaceState(null, "", b.dataset.ir === "panel" ? "#panel" : location.pathname); ir(b.dataset.ir); }
  else if (b.dataset.tab) { $$(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b)); $$("[data-panel]").forEach((s) => (s.hidden = s.dataset.panel !== b.dataset.tab)); }
  else if (b.dataset.aprobar) { const m = mayoristas.find((x) => x.id == b.dataset.aprobar); m.estado = "aprobado"; guardar("revendedores", mayoristas); pintarPanel(); toast(`${m.nombre} ya ve sus precios de revendedor`); }
});
$("#cajon").addEventListener("click", (e) => { if (e.target.id === "cajon") abrirCarro(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") abrirCarro(false); });
document.addEventListener("change", (e) => {
  if (e.target.dataset.precRev) {
    const c = e.target.dataset.precRev, v = Math.round(Number(e.target.value)), p = productos.find((x) => x.codigo === c);
    if (v > 0) preciosRev[c] = v; else delete preciosRev[c];
    guardar("preciosRev", preciosRev); pintarProductosPanel(); pintarGrilla(); pintarCarro();
    toast(`${p.nombre}: precio de revendedor ${pesos(precioRevDe(p))}`);
  }
  if (e.target.dataset.stockVis != null) {
    const c = e.target.dataset.stockVis, raw = e.target.value.trim(), p = productos.find((x) => x.codigo === c);
    if (raw === "") delete stockVis[c]; else stockVis[c] = Math.max(0, Math.floor(Number(raw)) || 0);
    guardar("stockVisible", stockVis);
    const st = stockDe(p);
    if (!visible(p) || st <= 0) delete carro[c]; else if (carro[c] > st) carro[c] = st;
    pintarProductosPanel(); pintarGrilla(); pintarCarro();
    toast(raw === "" ? `${p.nombre}: muestra el stock real (${p.stock})` : stockVis[c] === 0 ? "Producto oculto en la tienda" : `${p.nombre}: se muestran ${st} unidades${stockVis[c] > p.stock ? " (no puede superar el stock real)" : ""}`);
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

// Si falta una foto, se ve el color de la categoría (sin handlers inline: la CSP los bloquea).
document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
refrescar();
function segunHash() {
  const h = location.hash;
  if (h === "#panel") return ir("panel");
  if (h.startsWith("#p/")) { pintarFicha(decodeURIComponent(h.slice(3))); return ir("producto"); }
  ir("tienda");
}
if (location.hash === "#panel" || location.hash.startsWith("#p/")) segunHash();
window.addEventListener("hashchange", segunHash);
