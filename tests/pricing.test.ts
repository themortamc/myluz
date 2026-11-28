import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, envioGratis, precioLista, rulesFromSettings, unitPrice, valorCuota } from '../lib/pricing';

describe('precio de lista (tarjeta)', () => {
  it('ejemplo de Marcelo: contado $1.000 → lista $1.120, 3 cuotas de $374', () => {
    expect(precioLista(1000)).toBe(1120);
    expect(valorCuota(1120)).toBe(374);
  });

  it('con el descuento sobre la lista nunca se paga menos que el contado ni $10 de más', () => {
    for (let c = 1; c <= 300000; c += 137) {
      const l = precioLista(c);
      const conDesc = l * (1 - DEFAULT_RULES.descuentoContado);
      expect(conDesc).toBeGreaterThanOrEqual(c - 1e-6);
      expect(conDesc - c).toBeLessThan(10);
      expect(l % 10).toBe(0);
    }
  });

  it('casos borde', () => {
    expect(precioLista(900)).toBe(1000); // 900 / 0,9 da 1000,0000000001 en coma flotante
    expect(precioLista(1000, 0.15)).toBe(1180);
    expect(precioLista(0)).toBe(0);
    expect(() => precioLista(1000, 1)).toThrow();
    expect(valorCuota(0)).toBe(0);
  });
});

describe('precio unitario que se cobra', () => {
  it('cliente final: contado con transferencia/efectivo, lista con tarjeta', () => {
    expect(unitPrice(1000, null, 'contado')).toEqual({ price: 1000, tier: 'contado' });
    expect(unitPrice(1000, null, 'tarjeta')).toEqual({ price: 1120, tier: 'lista' });
  });

  it('revendedor: su precio fijo; con tarjeta, la lista sobre su precio', () => {
    expect(unitPrice(1000, 700, 'contado')).toEqual({ price: 700, tier: 'revendedor' });
    expect(unitPrice(1000, 700, 'tarjeta')).toEqual({ price: 780, tier: 'revendedor' });
  });

  it('producto sin precio de revendedor: el revendedor paga como cliente final', () => {
    expect(unitPrice(1000, null, 'contado').price).toBe(1000);
    expect(unitPrice(1000, 0, 'contado').price).toBe(1000);
  });
});

describe('reglas de la tienda', () => {
  it('envío gratis desde $100.000', () => {
    expect(envioGratis(99999)).toBe(false);
    expect(envioGratis(100000)).toBe(true);
    expect(envioGratis(1e9, { ...DEFAULT_RULES, envioGratisDesde: null })).toBe(false);
  });

  it('lee store_settings y descarta valores inválidos', () => {
    expect(rulesFromSettings(null)).toEqual(DEFAULT_RULES);
    expect(rulesFromSettings({ descuento_contado: '0.150', cuotas_sin_interes: 6, envio_gratis_desde: '80000.00' })).toEqual({
      descuentoContado: 0.15,
      cuotasSinInteres: 6,
      envioGratisDesde: 80000,
    });
    expect(rulesFromSettings({ descuento_contado: 2, cuotas_sin_interes: 0, envio_gratis_desde: null })).toEqual({
      ...DEFAULT_RULES,
      envioGratisDesde: null,
    });
  });
});
