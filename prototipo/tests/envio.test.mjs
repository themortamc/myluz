// Mismas pruebas que todoymas/tests/shipping.test.ts + las propias de myluz (solo Mendoza).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const E = createRequire(import.meta.url)("../public/envio.js");
const tira = (fn) => assert.throws(fn, (e) => e.name === "ShippingError");

test("zona sale de la provincia (con o sin tildes)", () => {
  assert.equal(E.resolveZone("5500", "Mendoza"), 2);
  assert.equal(E.resolveZone("1414", "Ciudad Autónoma de Buenos Aires"), 1);
  assert.equal(E.resolveZone("5000", "Córdoba"), 1);
});
test("CP patagónico sin letra nunca cobra menos que zona 3", () => assert.equal(E.resolveZone("9000", "Mendoza"), 3));
test("CPA con letra de otra provincia se rechaza", () => { tira(() => E.resolveZone("X5000ABC", "Mendoza")); assert.equal(E.resolveZone("M5500ABC", "Mendoza"), 2); });
test("rechaza CP o provincia inválidos", () => { tira(() => E.resolveZone("12", "Mendoza")); tira(() => E.resolveZone("5500", "Narnia")); });
test("usa 0,5 kg por unidad si no hay peso cargado", () => assert.equal(E.billableWeightKg([{ quantity: 3 }]), 1.5));
test("cobra el volumétrico si es mayor que el real", () => assert.equal(E.billableWeightKg([{ quantity: 1, weightKg: 1, lengthCm: 30, widthCm: 30, heightCm: 30 }]), 4.5));
test("usa el escalón correcto de la tabla", () => { assert.equal(E.correoPrice(0.5, 2, "domicilio"), 10340); assert.equal(E.correoPrice(0.6, 2, "domicilio"), 11140); });
test("más de 25 kg se divide en bultos", () => assert.equal(E.correoPrice(30, 1, "sucursal"), 41500 + 14050));
test("carrito vacío no cotiza", () => tira(() => E.calculateShipping({ postalCode: "5500", province: "Mendoza", items: [] })));
test("cotiza domicilio y sucursal para Mendoza", () =>
  assert.deepEqual(E.calculateShipping({ postalCode: "5500", province: "Mendoza", items: [{ quantity: 1, weightKg: 0.4 }] }), { zone: 2, weightKg: 0.4, domicilio: 10340, sucursal: 7120 }));

// Propias de myluz
test("myluz: acepta CP de Mendoza (con y sin letra) y siempre es zona 2", () => {
  for (const cp of ["5500", "5577", "5584", "5600", "5613", "5620", "M5577ABC", " 5 5 0 1 "]) assert.equal(E.cotizarMendoza(cp, [{ quantity: 1 }]).zone, 2, cp);
});
test("myluz: rechaza CP de fuera de Mendoza", () => {
  for (const cp of ["5400", "5700", "1414", "9000", "J5400ABC", "M1414ABC", "abc"]) tira(() => E.cotizarMendoza(cp, [{ quantity: 1 }]));
});
test("myluz: escalones exactos zona 2 en los bordes", () => {
  const casos = [[0.5, 10340, 7120], [0.501, 11140, 7420], [1, 11140, 7420], [2, 11510, 8640], [3, 12550, 9950], [5, 18960, 16930], [10, 26950, 24100], [25, 58900, 53000], [25.5, 58900 + 10335, 53000 + 7118]];
  for (const [kg, dom, suc] of casos) {
    assert.equal(E.correoPrice(kg, 2, "domicilio"), Math.ceil(dom / 10) * 10, `dom ${kg}`);
    assert.equal(E.correoPrice(kg, 2, "sucursal"), Math.ceil(suc / 10) * 10, `suc ${kg}`);
  }
});
