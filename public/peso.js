// Peso ESTIMADO del paquete por producto, para el envío (nadie carga peso ni medidas).
// Misma idea que todoymas/lib/shipping-weights.ts: reglas por palabra del NOMBRE y, si ninguna
// aplica, un promedio por CATEGORÍA. Son kg facturables del paquete embalado (incluyen caja y el
// volumen de lo voluminoso), redondeados hacia arriba: mejor cobrar un poco de más que poner plata.
// Para ajustar: agregar o cambiar una regla. Gana la PRIMERA que coincide (las específicas primero).
(function (root) {
  "use strict";
  var norm = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };
  var REGLAS = [
    // Voluminosos (se cobran por volumen, no por lo que pesan)
    [/balde|bidon|tacho|canasto|cesto/, 6],
    [/escoba|secador de piso|lampazo|mopa|palo/, 3],
    [/silla|banqueta|reposera|estanteria|organizador|perchero/, 5],
    [/mochila|valija|bolso/, 1.5],
    // Electro y cocina
    [/air ?fryer|freidora|microondas|horno/, 6],
    [/batidora|licuadora|procesadora|cafetera electrica/, 3],
    [/pava|hervidor|plancha|tostadora|sandwichera/, 1.5],
    [/sarten|olla|cacerola|bateria de cocina/, 1.5],
    [/juego de vasos|set de vasos|copas|vajilla|platos/, 2],
    [/cuchillo|cubiertos/, 1],
    [/termo|botella|jarra|tupper|hermetico/, 1],
    // Librería
    [/resma/, 2.5],
    [/cuaderno|carpeta|block|repuesto/, 0.6],
    [/lapiz|lapices|marcador|resaltador|birome|lapicera|goma|regla/, 0.3],
    // Perfumería y cuidado personal
    [/set de regalo|kit|estuche/, 1],
    [/shampoo|acondicionador|crema|jabon liquido|gel/, 1],
    [/perfume|colonia|desodorante|fragancia/, 0.5],
    // Zapatería
    [/bota|botin|borcego/, 1.5],
    [/zapatilla|zapato/, 1.2],
    [/ojota|sandalia|pantufla/, 0.6],
    // Juguetería
    [/auto a control|rodado|triciclo|pileta/, 2],
    [/juego de mesa|bloques|rompecabezas|muneca|peluche/, 1],
    [/pelota/, 0.6],
    // Electrónica chica
    [/parlante|auricular/, 0.8],
    [/cargador|cable|adaptador|pila|memoria/, 0.3],
    // Limpieza (líquidos pesan)
    [/lavandina|detergente|limpiador|suavizante|jabon en polvo/, 2],
    [/esponja|trapo|guante|rejilla/, 0.4],
    // Regalería
    [/reloj de pared|portarretrato|cuadro|espejo/, 1.2],
    [/vela|taza|mate/, 1],
  ];
  // Promedio por categoría (id) cuando ninguna regla aplica.
  var CATEGORIA = { bazar: 1.5, perfumeria: 0.6, zapateria: 1.2, libreria: 0.6, jugueteria: 1, electronica: 0.8, limpieza: 1.5, regaleria: 1 };
  var POR_DEFECTO = 1; // producto y categoría desconocidos: 1 kg (cubre la mayoría de los paquetes chicos)

  function pesoEstimadoKg(nombre, categoria) {
    var n = norm(nombre);
    for (var i = 0; i < REGLAS.length; i++) if (REGLAS[i][0].test(n)) return REGLAS[i][1];
    var c = CATEGORIA[norm(categoria).trim()];
    return c != null ? c : POR_DEFECTO;
  }
  var api = { pesoEstimadoKg: pesoEstimadoKg, REGLAS: REGLAS, CATEGORIA: CATEGORIA, POR_DEFECTO: POR_DEFECTO };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Peso = api;
})(this);
