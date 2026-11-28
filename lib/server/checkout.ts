// Armado del pedido del lado del servidor. Todo lo que define cuánto se
// cobra (precios, envío, total) se calcula acá a partir de la base de
// datos: del navegador solo se aceptan ids de producto/variante, cantidades,
// datos de entrega y del cliente. Así nadie puede pagar menos editando el
// pedido en el navegador.
//
// Precios (ver lib/pricing.ts): transferencia/efectivo = contado; tarjeta
// por Mercado Pago = lista en cuotas sin interés; revendedor aprobado = su
// precio fijo (con tarjeta, la lista sobre su precio).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/server/env';
import { quoteMendoza, ShippingError, type ShippingItem, type ShippingQuote, type ShippingService } from '@/lib/shipping';
import { estimateWeightKg } from '@/lib/shipping-weights';
import { envioGratis, rulesFromSettings, unitPrice, type PaymentKind, type PriceTier, type StoreRules } from '@/lib/pricing';

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const PAYMENT_METHODS = ['mercadopago_tarjeta', 'transferencia', 'efectivo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type Delivery = 'retiro' | ShippingService;

export const paymentKind = (m: PaymentMethod): PaymentKind => (m === 'mercadopago_tarjeta' ? 'tarjeta' : 'contado');

export type CartLineInput = { product_id: string; variant_id?: string | null; quantity: number };

export type PricedLine = {
  product_id: string;
  variant_id?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
};

export type LineDetail = { description: string; categoryId: string };

// Mercado Pago aprueba más pagos si cada ítem tiene categoría (item.category_id).
const MP_CATEGORY_BY_STORE: Record<string, string> = {
  calzado: 'fashion',
  zapatillas: 'fashion',
  indumentaria: 'fashion',
  ropa: 'fashion',
  accesorios: 'fashion',
  hogar: 'home',
  bazar: 'home',
};

function mpCategoryFor(categoryName?: string | null): string {
  if (!categoryName) return 'others';
  const key = categoryName.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return MP_CATEGORY_BY_STORE[key] ?? 'others';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getAdminSupabase(): Promise<SupabaseClient> {
  const url = await getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = await getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new CheckoutError('La tienda no está bien configurada para recibir pedidos.', 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getPublicSupabase(): Promise<SupabaseClient> {
  const url = await getServerEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = await getServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) throw new CheckoutError('La tienda no está bien configurada.', 500);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadRules(db: SupabaseClient): Promise<StoreRules> {
  const { data, error } = await db
    .from('store_settings')
    .select('descuento_contado, cuotas_sin_interes, envio_gratis_desde')
    .maybeSingle();
  if (error) throw new CheckoutError('No pudimos leer la configuración de la tienda. Probá de nuevo.', 500);
  return rulesFromSettings(data);
}

export type Reseller = { id: string; email: string; nombre: string | null; telefono: string | null };

// Si el pedido viene con la sesión de un revendedor APROBADO, lo devuelve.
// Sin sesión (cliente final) devuelve null. Una sesión inválida o de un
// revendedor no aprobado también da null: paga como cliente final.
export async function getResellerFromRequest(db: SupabaseClient, request: Request): Promise<Reseller | null> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth?.user) return null;
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, role, estado, nombre, telefono')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'revendedor' || profile.estado !== 'aprobado') return null;
  return { id: profile.id, email: profile.email, nombre: profile.nombre, telefono: profile.telefono };
}

function parseLines(raw: unknown): CartLineInput[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new CheckoutError('El carrito está vacío.');
  if (raw.length > 100) throw new CheckoutError('Demasiados productos en un solo pedido.');
  return raw.map((r: any) => {
    const quantity = Number(r?.quantity);
    if (typeof r?.product_id !== 'string' || !UUID_RE.test(r.product_id)) throw new CheckoutError('Producto inválido en el carrito.');
    if (r.variant_id != null && (typeof r.variant_id !== 'string' || !UUID_RE.test(r.variant_id))) {
      throw new CheckoutError('Variante inválida en el carrito.');
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new CheckoutError('Cantidad inválida en el carrito.');
    return { product_id: r.product_id, variant_id: r.variant_id ?? null, quantity };
  });
}

// Trae de la base nombre, precio, stock, foto y peso/medidas de cada línea.
// `resellerId`: si hay, usa los precios de revendedor (requiere el cliente
// service role, porque esa tabla no se lee sin sesión).
export async function loadCart(
  db: SupabaseClient,
  rawLines: unknown,
  opts: { pago: PaymentKind; rules: StoreRules; resellerId?: string | null; checkStock?: boolean }
) {
  const lines = parseLines(rawLines);
  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const variantIds = Array.from(new Set(lines.map((l) => l.variant_id).filter((v): v is string => !!v)));

  const { data: products, error } = await db
    .from('products')
    .select('id, name, description, price, stock, images, category_id, has_variants, weight_kg, length_cm, width_cm, height_cm')
    .in('id', productIds);
  if (error) throw new CheckoutError('No pudimos leer los productos. Probá de nuevo.', 500);

  // Nombres de categoría, para estimar el peso de los productos sin peso cargado.
  const { data: categories } = await db.from('categories').select('id, name');
  const categoryName = new Map((categories ?? []).map((c: any) => [c.id, c.name as string]));

  let variants: any[] = [];
  if (variantIds.length > 0) {
    const { data, error: vError } = await db
      .from('product_variants')
      .select('id, product_id, group_name, label, image_url, stock')
      .in('id', variantIds);
    if (vError) throw new CheckoutError('No pudimos leer los talles. Probá de nuevo.', 500);
    variants = data ?? [];
  }

  const resellerPrice = new Map<string, number>();
  if (opts.resellerId) {
    const { data, error: rError } = await db.from('product_reseller_prices').select('product_id, price').in('product_id', productIds);
    if (rError) throw new CheckoutError('No pudimos leer los precios de revendedor. Probá de nuevo.', 500);
    for (const r of data ?? []) resellerPrice.set(r.product_id, Number(r.price));
  }

  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));
  const variantById = new Map(variants.map((v: any) => [v.id, v]));

  // Cantidad pedida por producto y por variante (una misma cosa puede venir en varias líneas).
  const wantedByProduct = new Map<string, number>();
  const wantedByVariant = new Map<string, number>();
  for (const l of lines) {
    wantedByProduct.set(l.product_id, (wantedByProduct.get(l.product_id) ?? 0) + l.quantity);
    if (l.variant_id) wantedByVariant.set(l.variant_id, (wantedByVariant.get(l.variant_id) ?? 0) + l.quantity);
  }

  const priced: PricedLine[] = [];
  const shippingItems: ShippingItem[] = [];
  // Datos extra para Mercado Pago (descripción y categoría). No se guardan
  // en el pedido: solo ayudan a que Mercado Pago apruebe más pagos.
  const details: Record<string, LineDetail> = {};
  let anyResellerPrice = false;
  for (const line of lines) {
    const p = byId.get(line.product_id);
    if (!p) throw new CheckoutError('Un producto del carrito ya no está disponible. Sacalo y probá de nuevo.', 409);
    const v = line.variant_id ? variantById.get(line.variant_id) : null;
    if (line.variant_id && (!v || v.product_id !== p.id)) {
      throw new CheckoutError(`El talle elegido de "${p.name}" ya no está disponible.`, 409);
    }
    if (p.has_variants && !v) throw new CheckoutError(`Elegí el talle de "${p.name}".`, 409);
    if (opts.checkStock !== false) {
      const sinStock = v
        ? Number(v.stock) < (wantedByVariant.get(v.id) ?? 0)
        : Number(p.stock) < (wantedByProduct.get(p.id) ?? 0);
      if (sinStock) {
        const que = v ? `"${p.name}" (${v.group_name} ${v.label})` : `"${p.name}"`;
        throw new CheckoutError(`No hay stock suficiente de ${que}. Bajá la cantidad o sacalo del carrito.`, 409);
      }
    }
    const contado = Number(p.price);
    if (!Number.isFinite(contado) || contado <= 0) throw new CheckoutError(`"${p.name}" no tiene un precio válido.`, 409);
    const rev = resellerPrice.get(p.id);
    if (rev != null && rev > 0) anyResellerPrice = true;
    const { price } = unitPrice(contado, rev, opts.pago, opts.rules);
    priced.push({
      product_id: p.id,
      ...(v ? { variant_id: v.id, variant: `${v.group_name}: ${v.label}` } : {}),
      name: p.name,
      price,
      quantity: line.quantity,
      image: v?.image_url || p.images?.[0] || '',
    });
    details[p.id] = {
      description: String(p.description || p.name).replace(/\s+/g, ' ').trim().slice(0, 250),
      categoryId: mpCategoryFor(categoryName.get(p.category_id)),
    };
    shippingItems.push({
      quantity: line.quantity,
      // Peso cargado en el panel si existe; si no, estimado por nombre/categoría.
      weightKg: p.weight_kg ?? estimateWeightKg(p.name, categoryName.get(p.category_id)),
      lengthCm: p.length_cm,
      widthCm: p.width_cm,
      heightCm: p.height_cm,
    });
  }

  const subtotal = round2(priced.reduce((s, l) => s + l.price * l.quantity, 0));
  return { lines: priced, shippingItems, subtotal, details, anyResellerPrice };
}

export function quoteShippingFor(shippingItems: ShippingItem[], postalCode: unknown): ShippingQuote {
  try {
    return quoteMendoza(postalCode, shippingItems);
  } catch (e) {
    if (e instanceof ShippingError) throw new CheckoutError(e.message);
    throw e;
  }
}

export type CheckoutQuote = {
  lines: PricedLine[];
  details: Record<string, LineDetail>;
  subtotal: number;
  shippingCost: number;
  shipping: ShippingQuote | null;
  freeShipping: boolean;
  priceTier: PriceTier;
  installments: number;
  rules: StoreRules;
  total: number;
};

export async function quoteCheckout(
  db: SupabaseClient,
  input: { items: unknown; delivery: Delivery; postalCode?: unknown; paymentMethod: PaymentMethod; resellerId?: string | null }
): Promise<CheckoutQuote> {
  const rules = await loadRules(db);
  const pago = paymentKind(input.paymentMethod);
  const cart = await loadCart(db, input.items, { pago, rules, resellerId: input.resellerId });

  let shipping: ShippingQuote | null = null;
  let shippingCost = 0;
  const freeShipping = input.delivery !== 'retiro' && envioGratis(cart.subtotal, rules);
  if (input.delivery !== 'retiro') {
    shipping = quoteShippingFor(cart.shippingItems, input.postalCode);
    shippingCost = freeShipping ? 0 : shipping[input.delivery];
  }

  const priceTier: PriceTier = cart.anyResellerPrice ? 'revendedor' : pago === 'tarjeta' ? 'lista' : 'contado';
  return {
    lines: cart.lines,
    details: cart.details,
    subtotal: cart.subtotal,
    shippingCost,
    shipping,
    freeShipping,
    priceTier,
    installments: pago === 'tarjeta' ? rules.cuotasSinInteres : 1,
    rules,
    total: round2(cart.subtotal + shippingCost),
  };
}

// ---------------------------------------------------------------- Mercado Pago

// Solo tarjetas. Mercado Pago NO permite excluir "account_money"; se sacan
// los demás medios (efectivo en Rapipago/Pago Fácil, transferencia, etc.).
const ONLY_CARDS_EXCLUDES = [{ id: 'ticket' }, { id: 'bank_transfer' }, { id: 'atm' }];
// Versión mínima, de respaldo si Mercado Pago rechaza la lista completa.
const CARDS_CORE_EXCLUDES = [{ id: 'ticket' }];

function splitName(fullName?: string) {
  if (!fullName || !fullName.trim()) return { first_name: undefined, last_name: undefined };
  const parts = fullName.trim().split(/\s+/);
  const first_name = parts.shift();
  const last_name = parts.length > 0 ? parts.join(' ') : undefined;
  return { first_name, last_name };
}

export async function createMercadoPagoPreference(args: {
  accessToken: string;
  orderId: string;
  quote: CheckoutQuote;
  siteUrl: string;
  payer: { name?: string; email?: string; phone?: string };
}): Promise<{ preferenceId: string; initPoint: string }> {
  const { accessToken, orderId, quote, siteUrl, payer } = args;

  const items: Record<string, unknown>[] = quote.lines.map((l) => ({
    id: l.product_id,
    title: (l.variant ? `${l.name} (${l.variant})` : l.name).slice(0, 250),
    description: quote.details[l.product_id]?.description || undefined,
    category_id: quote.details[l.product_id]?.categoryId || 'others',
    quantity: l.quantity,
    unit_price: l.price,
    currency_id: 'ARS',
    picture_url: l.image || undefined,
  }));
  if (quote.shippingCost > 0) {
    items.push({ id: 'envio', title: 'Costo de envío', quantity: 1, unit_price: quote.shippingCost, currency_id: 'ARS' });
  }

  const { first_name, last_name } = splitName(payer.name);
  const payload = {
    items,
    payer: {
      name: first_name,
      surname: last_name,
      email: payer.email || undefined,
      phone: payer.phone ? { number: payer.phone } : undefined,
    },
    external_reference: orderId,
    back_urls: {
      success: `${siteUrl}/checkout/retorno?order=${orderId}`,
      pending: `${siteUrl}/checkout/retorno?order=${orderId}`,
      failure: `${siteUrl}/checkout/retorno?order=${orderId}`,
    },
    auto_return: 'approved',
    notification_url: `${siteUrl}/api/mercadopago/webhook`,
    statement_descriptor: 'MYLUZ',
  };

  const send = async (excluded: { id: string }[]) => {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        ...payload,
        // Hasta N cuotas. Que sean SIN interés para el cliente se configura en
        // la cuenta de Mercado Pago del dueño (el costo lo absorbe el precio de lista).
        payment_methods: { excluded_payment_types: excluded, installments: quote.installments },
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  let { res, data } = await send(ONLY_CARDS_EXCLUDES);
  if (!res.ok) {
    console.error('Mercado Pago preference error (intento 1):', JSON.stringify(data));
    ({ res, data } = await send(CARDS_CORE_EXCLUDES));
  }
  if (!res.ok) {
    console.error('Mercado Pago preference error (intento 2):', JSON.stringify(data));
    const causes = Array.isArray(data?.cause)
      ? data.cause.map((c: { description?: string; code?: string | number }) => c.description || c.code).filter(Boolean)
      : [];
    const detail = [data?.message, ...causes].filter(Boolean).join(' · ') || `HTTP ${res.status}`;
    throw new CheckoutError(`No pudimos iniciar el pago con Mercado Pago. Probá nuevamente. (Detalle: ${detail})`, 502);
  }
  return { preferenceId: data.id, initPoint: data.init_point };
}
