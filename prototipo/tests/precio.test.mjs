import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("../public/precio.js");

test("ejemplo de Marcelo: contado $1.000 → lista $1.120 (10 % off da ≥ contado)", () => {
  assert.equal(P.precioLista(1000), 1120);
  assert.equal(P.valorCuota(1120), 374);
});

test("con el descuento sobre la lista, el cliente nunca paga menos que el contado ni más de $10 de diferencia", () => {
  for (let c = 1; c <= 300000; c += 137) {
    const l = P.precioLista(c);
    const conDesc = l * (1 - P.DESCUENTO);
    assert.ok(conDesc >= c - 1e-9, `contado ${c} lista ${l}`);
    assert.ok(conDesc - c < 10, `contado ${c} lista ${l}`);
    assert.equal(l % 10, 0);
  }
});

test("15 % de descuento y casos borde", () => {
  assert.equal(P.precioLista(1000, 0.15), 1180);
  assert.equal(P.precioLista(0), 0);
  assert.throws(() => P.precioLista(1000, 1));
});

test("precio tachado de la demo: siempre mayor que la lista, redondeado a $100", () => {
  assert.equal(P.precioTachado(16560), 20700);
  for (let c = 100; c <= 300000; c += 211) {
    const l = P.precioLista(c), t = P.precioTachado(l);
    assert.ok(t > l && t % 100 === 0, `lista ${l} tachado ${t}`);
  }
});
