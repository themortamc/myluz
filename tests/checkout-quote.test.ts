import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/server/env', () => ({ getServerEnv: async () => undefined }));
import { CheckoutError, quoteCheckout } from '../lib/server/checkout';

// Base falsa mínima: soporta from(t).select().in(col, ids) y .maybeSingle().
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const V1 = '33333333-3333-4333-8333-333333333333';
const tables: Record<string, any[]> = {
  products: [
    { id: P1, name: 'Zapatilla', description: null, price: 45000, stock: 5, images: [], category_id: null, has_variants: true, weight_kg: 1 },
    { id: P2, name: 'Ojota', description: null, price: 10000, stock: 1, images: [], category_id: null, has_variants: false, weight_kg: 0.3 },
  ],
  product_variants: [{ id: V1, product_id: P1, group_name: 'Talle', label: '40', image_url: null, stock: 2 }],
  product_reseller_prices: [{ product_id: P1, price: 30000 }],
  categories: [],
  store_settings: [{ descuento_contado: 0.1, cuotas_sin_interes: 3, envio_gratis_desde: 100000 }],
};
function fakeDb() {
  return {
    from(t: string) {
      const rows = tables[t] ?? [];
      const q: any = {
        select: () => q,
        in: async (col: string, ids: string[]) => ({ data: rows.filter((r) => ids.includes(r[col])), error: null }),
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (res: any) => res({ data: rows, error: null }),
      };
      return q;
    },
  } as any;
}

const zapa = (quantity = 1) => ({ product_id: P1, variant_id: V1, quantity });
const ojota = (quantity = 1) => ({ product_id: P2, quantity });

describe('cotización del pedido (servidor)', () => {
  it('transferencia: precio de contado, retiro sin envío', async () => {
    const q = await quoteCheckout(fakeDb(), { items: [zapa(), ojota()], delivery: 'retiro', paymentMethod: 'transferencia' });
    expect(q.subtotal).toBe(55000);
    expect(q.total).toBe(55000);
    expect(q.priceTier).toBe('contado');
    expect(q.installments).toBe(1);
    expect(q.lines[0].variant).toBe('Talle: 40');
  });

  it('tarjeta: precio de lista y 3 cuotas', async () => {
    const q = await quoteCheckout(fakeDb(), { items: [zapa()], delivery: 'retiro', paymentMethod: 'mercadopago_tarjeta' });
    expect(q.lines[0].price).toBe(50000);
    expect(q.priceTier).toBe('lista');
    expect(q.installments).toBe(3);
  });

  it('revendedor aprobado: su precio; sin precio de revendedor paga contado', async () => {
    const q = await quoteCheckout(fakeDb(), { items: [zapa(), ojota()], delivery: 'retiro', paymentMethod: 'transferencia', resellerId: 'r1' });
    expect(q.lines.map((l) => l.price)).toEqual([30000, 10000]);
    expect(q.priceTier).toBe('revendedor');
  });

  it('envío a Mendoza: se cobra debajo de $100.000 y es gratis desde ahí', async () => {
    const chico = await quoteCheckout(fakeDb(), { items: [zapa()], delivery: 'domicilio', postalCode: '5577', paymentMethod: 'transferencia' });
    expect(chico.shippingCost).toBeGreaterThan(0);
    expect(chico.total).toBe(45000 + chico.shippingCost);
    const grande = await quoteCheckout(fakeDb(), { items: [zapa(2), ojota()], delivery: 'domicilio', postalCode: '5577', paymentMethod: 'transferencia' });
    expect(grande.freeShipping).toBe(true);
    expect(grande.shippingCost).toBe(0);
    expect(grande.total).toBe(100000); // justo en el límite: gratis
  });

  it('rechaza envíos fuera de Mendoza', async () => {
    await expect(
      quoteCheckout(fakeDb(), { items: [zapa()], delivery: 'domicilio', postalCode: '1414', paymentMethod: 'transferencia' })
    ).rejects.toThrow(/solo dentro de Mendoza/);
  });

  it('controla stock por talle y exige elegir talle', async () => {
    await expect(quoteCheckout(fakeDb(), { items: [zapa(3)], delivery: 'retiro', paymentMethod: 'transferencia' })).rejects.toBeInstanceOf(CheckoutError);
    await expect(quoteCheckout(fakeDb(), { items: [ojota(2)], delivery: 'retiro', paymentMethod: 'transferencia' })).rejects.toThrow(/stock/);
    await expect(
      quoteCheckout(fakeDb(), { items: [{ product_id: P1, quantity: 1 }], delivery: 'retiro', paymentMethod: 'transferencia' })
    ).rejects.toThrow(/talle/);
  });
});
