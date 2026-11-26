import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const P = req("../public/peso.js");
globalThis.window = {}; req("../public/data.js"); const productos = globalThis.window.PRODUCTOS;

test("reglas por nombre (con y sin tildes, mayúsculas)", () => {
  assert.equal(P.pesoEstimadoKg("Escoba con palo", "limpieza"), 3);
  assert.equal(P.pesoEstimadoKg("Balde con escurridor", "limpieza"), 6);
  assert.equal(P.pesoEstimadoKg("Resma A4 75 g", "libreria"), 2.5);
  assert.equal(P.pesoEstimadoKg("PERFUME femenino 100 ml", "perfumeria"), 0.5);
  assert.equal(P.pesoEstimadoKg("Set de regalo perfume y crema", "perfumeria"), 1);
  assert.equal(P.pesoEstimadoKg("Zapatillas urbanas", "zapateria"), 1.2);
  assert.equal(P.pesoEstimadoKg("Sartén antiadherente 24 cm", "bazar"), 1.5);
});
test("si ninguna regla aplica usa la categoría y después 1 kg", () => {
  assert.equal(P.pesoEstimadoKg("Cosa rara", "Juguetería"), 1);
  assert.equal(P.pesoEstimadoKg("Cosa rara", "perfumeria"), 0.6);
  assert.equal(P.pesoEstimadoKg("Cosa rara", "categoria-nueva"), 1);
  assert.equal(P.pesoEstimadoKg("", null), 1);
});
test("todos los productos de ejemplo tienen un peso razonable (0,2 a 6 kg)", () => {
  for (const p of productos) {
    const kg = P.pesoEstimadoKg(p.nombre, p.categoria);
    assert.ok(kg >= 0.2 && kg <= 6, `${p.codigo} ${p.nombre}: ${kg}`);
  }
});
