// Costo de envío por Correo Argentino (Clásico, MiCorreo).
// COPIA FIEL de todoymas/lib/shipping.ts (mismas tablas y reglas, con las mismas pruebas
// en tests/envio.test.mjs). Si cambian las tarifas, actualizar en los dos proyectos.
//
// Cómo cobra Correo: la ZONA depende de la provincia de destino (Mendoza = zona 2); el PESO
// FACTURABLE es el mayor entre el real y el volumétrico (L×A×H/6000, o /4000 si los tres lados
// suman más de 200 cm); el precio sale de una tabla por escalones de peso, distinta para
// domicilio y sucursal. Más de 25 kg va en varios bultos. Se redondea hacia arriba a $10.
// Fuente: tarifas de lista de MiCorreo, noviembre 2026. Los "(est.)" se estimaron.
(function (root) {
  "use strict";
  var RATES_UPDATED_AT = "2026-11";
  var EXTRA_MARGIN_PERCENT = 0;
  var DEFAULT_ITEM_WEIGHT_KG = 0.5;
  var MAX_PACKAGE_KG = 25;
  // [zona 1, zona 2, zona 3]
  var RATE_TABLE = [
    { upToKg: 0.5, domicilio: [9492, 10335, 10396], sucursal: [6480, 7118, 7357] },
    { upToKg: 1, domicilio: [10227, 11140, 11221], sucursal: [6739, 7415, 7745] },
    { upToKg: 2, domicilio: [10529, 11505, 12000], sucursal: [8000, 8638, 9500] }, // Z3 dom., Z1/Z3 suc. (est.)
    { upToKg: 3, domicilio: [11118, 12541, 13379], sucursal: [8768, 9946, 11274] },
    { upToKg: 5, domicilio: [16914, 18953, 20907], sucursal: [14050, 16927, 19862] },
    { upToKg: 10, domicilio: [22623, 26948, 32402], sucursal: [18800, 24100, 30800] }, // sucursal (est.)
    { upToKg: 15, domicilio: [35053, 41800, 50300], sucursal: [29200, 37300, 47700] }, // Z2/Z3 (est.)
    { upToKg: 20, domicilio: [42165, 50300, 60400], sucursal: [35100, 44900, 57400] }, // Z2/Z3 (est.)
    { upToKg: 25, domicilio: [49400, 58900, 70700], sucursal: [41500, 53000, 67800] }, // (est.)
  ];
  var PROVINCE_ZONE = {
    "ciudad autonoma de buenos aires": 1, "buenos aires": 1, cordoba: 1, "entre rios": 1, "la pampa": 1, "santa fe": 1,
    catamarca: 2, chaco: 2, corrientes: 2, formosa: 2, "la rioja": 2, mendoza: 2, misiones: 2, neuquen: 2,
    "rio negro": 2, "san juan": 2, "san luis": 2, "santiago del estero": 2, tucuman: 2,
    chubut: 3, jujuy: 3, salta: 3, "santa cruz": 3, "tierra del fuego": 3,
  };
  var CPA_LETTER_PROVINCE = {
    A: "salta", B: "buenos aires", C: "ciudad autonoma de buenos aires", D: "san luis", E: "entre rios", F: "la rioja",
    G: "santiago del estero", H: "chaco", J: "san juan", K: "catamarca", L: "la pampa", M: "mendoza", N: "misiones",
    P: "formosa", Q: "neuquen", R: "rio negro", S: "santa fe", T: "tucuman", U: "chubut", V: "tierra del fuego",
    W: "corrientes", X: "cordoba", Y: "jujuy", Z: "santa cruz",
  };
  function ShippingError(msg) { var e = new Error(msg); e.name = "ShippingError"; return e; }
  function normalize(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(); }

  function zoneFromProvince(province) {
    if (typeof province !== "string" || !province.trim()) return null;
    return PROVINCE_ZONE[normalize(province)] || null;
  }
  function parsePostalCode(raw) {
    if (typeof raw !== "string" && typeof raw !== "number") return null;
    var cp = String(raw).replace(/\s+/g, "").toUpperCase();
    var m = /^([A-Z])?(\d{4})([A-Z]{3})?$/.exec(cp);
    if (!m) return null;
    var digits = parseInt(m[2], 10);
    if (digits < 1000) return null;
    return { digits: digits, letter: m[1] || null };
  }
  function resolveZone(postalCode, province) {
    var cp = parsePostalCode(postalCode);
    if (!cp) throw ShippingError("Código postal inválido. Escribí los 4 números (ej: 5577).");
    var provinceZone = zoneFromProvince(typeof province === "string" ? province : null);
    if (!provinceZone) throw ShippingError("Elegí una provincia válida.");
    if (cp.letter) {
      var letterProvince = CPA_LETTER_PROVINCE[cp.letter];
      if (!letterProvince || letterProvince !== normalize(province)) {
        throw ShippingError("El código postal no corresponde a la provincia elegida. Revisalos.");
      }
      return provinceZone;
    }
    var n = cp.digits;
    var cpIsZone3 = (n >= 9000 && n <= 9499) || (n >= 4400 && n <= 4699);
    return cpIsZone3 ? 3 : provinceZone;
  }
  function positive(v) { var n = Number(v); return v !== null && v !== undefined && isFinite(n) && n > 0 ? n : null; }
  function billableWeightKg(items) {
    var real = 0, volumetric = 0;
    items.forEach(function (item) {
      var qty = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0;
      if (!qty) return;
      real += (positive(item.weightKg) || DEFAULT_ITEM_WEIGHT_KG) * qty;
      var l = positive(item.lengthCm), w = positive(item.widthCm), h = positive(item.heightCm);
      if (l && w && h) volumetric += ((l * w * h) / (l + w + h > 200 ? 4000 : 6000)) * qty;
    });
    return Math.round(Math.max(real, volumetric) * 1000) / 1000;
  }
  function packagePrice(weightKg, zone, service) {
    var tier = RATE_TABLE.find(function (t) { return weightKg <= t.upToKg; }) || RATE_TABLE[RATE_TABLE.length - 1];
    return tier[service][zone - 1];
  }
  function correoPrice(weightKg, zone, service) {
    var remaining = Math.max(weightKg, 0.001), price = 0;
    while (remaining > MAX_PACKAGE_KG) { price += packagePrice(MAX_PACKAGE_KG, zone, service); remaining -= MAX_PACKAGE_KG; }
    price += packagePrice(remaining, zone, service);
    return Math.ceil((price * (1 + EXTRA_MARGIN_PERCENT / 100)) / 10) * 10;
  }
  function calculateShipping(input) {
    var zone = resolveZone(input.postalCode, input.province);
    if (!Array.isArray(input.items) || input.items.length === 0) throw ShippingError("El carrito está vacío.");
    var weightKg = billableWeightKg(input.items);
    if (weightKg <= 0) throw ShippingError("El carrito está vacío.");
    return { zone: zone, weightKg: weightKg, domicilio: correoPrice(weightKg, zone, "domicilio"), sucursal: correoPrice(weightKg, zone, "sucursal") };
  }
  // myluz envía solo dentro de Mendoza: los CP de Mendoza son 5500–5699 (letra M en el CPA).
  function cotizarMendoza(postalCode, items) {
    var cp = parsePostalCode(postalCode);
    if (!cp) throw ShippingError("Código postal inválido. Escribí los 4 números (ej: 5577).");
    if ((cp.letter && cp.letter !== "M") || cp.digits < 5500 || cp.digits > 5699) {
      throw ShippingError("Por ahora enviamos solo dentro de Mendoza. Si tu código postal es de Mendoza, escribinos por WhatsApp.");
    }
    return calculateShipping({ postalCode: postalCode, province: "Mendoza", items: items });
  }
  var api = { RATES_UPDATED_AT: RATES_UPDATED_AT, RATE_TABLE: RATE_TABLE, resolveZone: resolveZone, parsePostalCode: parsePostalCode,
    billableWeightKg: billableWeightKg, correoPrice: correoPrice, calculateShipping: calculateShipping, cotizarMendoza: cotizarMendoza };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Envio = api;
})(this);
