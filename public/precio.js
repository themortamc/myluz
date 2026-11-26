// Precios según medio de pago (pedido de Marcelo, 2026-11-26).
// El negocio carga UN precio: el de contado (transferencia o efectivo).
// La página muestra el precio de lista (tarjeta, cuotas sin interés) = contado ÷ (1 − descuento),
// redondeado hacia arriba a $10, así "X % off con transferencia" nunca da menos que el contado.
(function (root) {
  "use strict";
  var DESCUENTO = 0.10; // descuento por transferencia o efectivo sobre el precio de lista
  var CUOTAS = 3;       // cuotas sin interés con tarjeta

  function precioLista(contado, descuento) {
    var d = descuento == null ? DESCUENTO : descuento;
    if (!(contado > 0)) return 0;
    if (!(d >= 0 && d < 1)) throw new Error("Descuento inválido");
    return Math.ceil(contado / (1 - d) / 10) * 10;
  }

  function valorCuota(lista, cuotas) {
    return Math.ceil(lista / (cuotas || CUOTAS));
  }

  // shortcut: precio "antes" tachado SOLO para la demo (pedido del dueño). Mostrar un precio anterior que no existió
  // puede ser publicidad engañosa (Ley 24.240 / Ley 22.802); antes de la tienda real hay que definir cómo hacerlo legal.
  var TACHADO = 0.25; // el precio tachado es la lista + 25 %, redondeado hacia arriba a $100
  function precioTachado(lista) {
    return lista > 0 ? Math.ceil(lista * (1 + TACHADO) / 100) * 100 : 0;
  }

  var api = { precioLista: precioLista, valorCuota: valorCuota, precioTachado: precioTachado, DESCUENTO: DESCUENTO, CUOTAS: CUOTAS, TACHADO: TACHADO };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Precio = api;
})(this);
