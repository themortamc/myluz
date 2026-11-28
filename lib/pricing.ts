// Precios de Myluz (mismas fórmulas que prototipo/public/precio.js).
//
// El negocio carga UN precio por producto: el de CONTADO (transferencia o
// efectivo). El precio de LISTA (tarjeta, cuotas sin interés) se calcula:
//   lista = contado ÷ (1 − descuento), redondeado hacia arriba a $10
// así "X % off pagando por transferencia" nunca da menos que el contado.
//
// Los revendedores aprobados pagan su precio fijo de revendedor (tabla
// product_reseller_prices). Si pagan con tarjeta se les aplica la misma
// fórmula de lista sobre su precio.
//
// Este archivo no toca la base: lo usan el navegador (para mostrar) y el
// servidor (para cobrar), así lo que se ve es lo que se cobra.

export type StoreRules = {
  /** Descuento por transferencia/efectivo sobre la lista (0,10 = 10 %). */
  descuentoContado: number;
  /** Cuotas sin interés con tarjeta. */
  cuotasSinInteres: number;
  /** Envío gratis desde este subtotal (null = nunca). */
  envioGratisDesde: number | null;
};

// Lo acordado con el dueño (y los valores por defecto de store_settings).
export const DEFAULT_RULES: StoreRules = { descuentoContado: 0.1, cuotasSinInteres: 3, envioGratisDesde: 100000 };

export type PriceTier = 'contado' | 'lista' | 'revendedor';
export type PaymentKind = 'tarjeta' | 'contado';

export function precioLista(contado: number, descuento = DEFAULT_RULES.descuentoContado): number {
  if (!(contado > 0)) return 0;
  if (!(descuento >= 0 && descuento < 1)) throw new Error('Descuento inválido');
  // Se redondea a millonésimas antes del techo para que errores de coma flotante
  // (p. ej. 900 / 0.9 = 1000.0000000001) no sumen $10 de más.
  const exacto = Math.round((contado / (1 - descuento)) * 1e6) / 1e6;
  return Math.ceil(exacto / 10) * 10;
}

export function valorCuota(lista: number, cuotas = DEFAULT_RULES.cuotasSinInteres): number {
  if (!(lista > 0)) return 0;
  return Math.ceil(lista / Math.max(1, Math.floor(cuotas)));
}

/** Porcentaje entero para mostrar ("10 % off"). */
export const descuentoPct = (rules: StoreRules) => Math.round(rules.descuentoContado * 100);

/**
 * Precio unitario que se cobra.
 * @param contado precio de contado del producto (products.price)
 * @param revendedor precio de revendedor si el comprador es revendedor aprobado y el producto lo tiene
 */
export function unitPrice(
  contado: number,
  revendedor: number | null | undefined,
  pago: PaymentKind,
  rules: StoreRules = DEFAULT_RULES
): { price: number; tier: PriceTier } {
  const base = revendedor != null && revendedor > 0 ? revendedor : contado;
  const tierBase: PriceTier = revendedor != null && revendedor > 0 ? 'revendedor' : 'contado';
  if (pago === 'tarjeta') return { price: precioLista(base, rules.descuentoContado), tier: tierBase === 'revendedor' ? 'revendedor' : 'lista' };
  return { price: base, tier: tierBase };
}

export function envioGratis(subtotal: number, rules: StoreRules = DEFAULT_RULES): boolean {
  return rules.envioGratisDesde != null && subtotal >= rules.envioGratisDesde;
}

/** Convierte la fila de store_settings (o null) en reglas válidas. */
export function rulesFromSettings(row: Record<string, unknown> | null | undefined): StoreRules {
  if (!row) return { ...DEFAULT_RULES };
  const d = Number(row.descuento_contado);
  const c = Number(row.cuotas_sin_interes);
  const g = row.envio_gratis_desde == null ? null : Number(row.envio_gratis_desde);
  return {
    descuentoContado: Number.isFinite(d) && d >= 0 && d < 1 ? d : DEFAULT_RULES.descuentoContado,
    cuotasSinInteres: Number.isInteger(c) && c >= 1 ? c : DEFAULT_RULES.cuotasSinInteres,
    envioGratisDesde: g == null ? null : Number.isFinite(g) && g >= 0 ? g : DEFAULT_RULES.envioGratisDesde,
  };
}
