'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Truck, Store, CreditCard, Lock, Landmark, Banknote, Loader2 } from 'lucide-react';
import { StoreLayout } from '@/components/store-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { OrganicBlob, LeafScatter, LeafSprig, LeafBranch, Bloom, MandalaLine, Vine } from '@/components/decorative-plants';
import { useCart, cartLineKey } from '@/lib/cart-context';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WHATSAPP_NUMBER, TRANSFER_ALIAS, TRANSFER_HOLDER } from '@/lib/contact';
import { DEFAULT_RULES, envioGratis, rulesFromSettings, unitPrice, valorCuota, type StoreRules } from '@/lib/pricing';
import { supabase } from '@/lib/supabase';
import { ReceiptUploader } from '@/components/receipt-uploader';
import { CdnImg } from '@/components/cdn-img';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_method: 'retiro',
    // Con envío: 'domicilio' o 'sucursal' (de Correo Argentino).
    shipping_service: 'domicilio' as 'domicilio' | 'sucursal',
    address: '',
    city: '',
    postal_code: '',
    notes: '',
    // 'mercadopago_tarjeta' | 'transferencia' | 'efectivo'
    payment_method: 'mercadopago_tarjeta',
  });

  const [shippingQuote, setShippingQuote] = useState<{ domicilio: number; sucursal: number; weightKg: number } | null>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [paidTotal, setPaidTotal] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [rules, setRules] = useState<StoreRules>(DEFAULT_RULES);

  // Descuento, cuotas y envío gratis configurados en el panel (store_settings).
  useEffect(() => {
    supabase
      .from('store_settings')
      .select('descuento_contado, cuotas_sin_interes, envio_gratis_desde')
      .maybeSingle()
      .then(({ data }) => setRules(rulesFromSettings(data)));
  }, []);


  // Líneas del carrito tal como las recibe el servidor: solo ids y
  // cantidades. Precios, peso y envío los saca el servidor de la base.
  const cartLines = items.map((i) => ({ product_id: i.product.id, variant_id: i.variant?.id ?? null, quantity: i.quantity }));
  const cartKey = cartLines.map((l) => `${l.product_id}:${l.variant_id ?? ''}:${l.quantity}`).join('|');

  // Cotiza el envío cada vez que cambia el código postal, la provincia, el
  // carrito o el método de entrega. Apenas algo cambia se descarta el costo
  // anterior (nunca se muestra un envío viejo) y se ignoran las respuestas
  // que lleguen tarde de una consulta ya reemplazada.
  useEffect(() => {
    const cp = form.postal_code.trim();
    if (form.shipping_method !== 'envio' || cp.length < 4 || cartLines.length === 0) {
      setShippingQuote(null);
      setCalculatingShipping(false);
      setShippingError(null);
      return;
    }

    setShippingQuote(null);
    setShippingError(null);
    setCalculatingShipping(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postalCode: cp, items: cartLines }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setShippingQuote({ domicilio: data.domicilio, sucursal: data.sucursal, weightKg: data.weightKg });
        } else {
          setShippingError(data.error || 'No pudimos calcular el envío. Probá de nuevo.');
        }
      } catch (err) {
        console.error('Error fetching shipping:', err);
        if (!cancelled) setShippingError('No pudimos calcular el envío. Revisá tu conexión y probá de nuevo.');
      } finally {
        if (!cancelled) setCalculatingShipping(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shipping_method, form.postal_code, cartKey]);

  const isMercadoPago = form.payment_method === 'mercadopago_tarjeta';
  // Precio de cada línea según el medio de pago (lib/pricing.ts): contado con
  // transferencia/efectivo, lista con tarjeta. El servidor recalcula todo
  // (y aplica precios de revendedor si corresponde) antes de cobrar.
  const pago = isMercadoPago ? 'tarjeta' : 'contado';
  const linePrice = (contado: number) => unitPrice(contado, null, pago, rules).price;
  const total = items.reduce((s, i) => s + linePrice(i.product.price) * i.quantity, 0);
  const freeShipping = envioGratis(total, rules);
  const quotedShipping = shippingQuote ? shippingQuote[form.shipping_service] : null;
  const shippingCost = quotedShipping === null ? null : freeShipping ? 0 : quotedShipping;
  const actualShippingCost = form.shipping_method === 'envio' ? (shippingCost ?? 0) : 0;
  // Con envío a domicilio no se puede confirmar el pedido hasta tener el costo calculado.
  const shippingReady = form.shipping_method !== 'envio' || (shippingCost !== null && !calculatingShipping);
  const grandTotal = total + actualShippingCost;
  const cuotas = rules.cuotasSinInteres;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!shippingReady) {
      setError('Esperá a que se calcule el envío: completá el código postal.');
      return;
    }

    setProcessing(true);
    setError(null);
    setPaymentError(null);

    const isGateway = isMercadoPago;

    try {
      // El servidor arma el pedido: recalcula precios, envío y total desde
      // la base, guarda el pedido y (si es con tarjeta) crea el pago en
      // Mercado Pago. Acá solo se mandan ids, cantidades y los datos del
      // cliente. Si hay sesión (revendedor), va el token para sus precios.
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          items: cartLines,
          delivery: form.shipping_method === 'envio' ? form.shipping_service : 'retiro',
          postalCode: form.postal_code,
          city: form.city,
          address: form.address,
          notes: form.notes,
          paymentMethod: form.payment_method,
          customer: {
            name: form.customer_name,
            email: form.customer_email,
            phone: form.customer_phone,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const message = data.error || 'Ocurrió un error al procesar el pedido. Intentá nuevamente.';
        if (isGateway) setPaymentError(message);
        else setError(message);
        return;
      }

      clearCart();
      if (data.redirectUrl) {
        // Mercado Pago confirma el pago en su webhook; el stock
        // se descuenta recién ahí.
        window.location.href = data.redirectUrl;
        return;
      }

      setOrderId(data.orderId);
      setPaidTotal(typeof data.total === 'number' ? data.total : null);
      setSuccess(true);
    } catch (err) {
      setError('Ocurrió un error al procesar el pedido. Revisá tu conexión e intentá nuevamente.');
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <StoreLayout>
        <div className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/60">
          <MandalaLine className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 text-primary/20" />
          <OrganicBlob className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 text-primary/20 animate-drift sm:-right-32 sm:-top-32 sm:h-96 sm:w-96" />
          <LeafScatter className="pointer-events-none absolute -left-14 bottom-0 h-40 w-40 text-accent/30 sm:-left-24 sm:h-72 sm:w-72" />
          <Bloom className="pointer-events-none absolute right-8 bottom-10 h-16 w-16 text-accent/30 sm:right-16 sm:h-24 sm:w-24" />
          <Bloom className="pointer-events-none absolute left-1/2 -top-4 h-12 w-12 text-primary/25 hidden sm:block" />
          <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-md mx-auto text-center">
            <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-success/10 mb-6">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">¡Pedido realizado!</h1>
            <p className="text-muted-foreground mb-1">
              Tu pedido se registró correctamente.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Número de pedido: <span className="font-mono font-medium text-foreground">{orderId?.slice(0, 8)}</span>
              {paidTotal !== null && (
                <>
                  {' · '}Total: <span className="font-medium text-foreground">{formatPrice(paidTotal)}</span>
                </>
              )}
            </p>
            <div className="rounded-3xl border border-border bg-card p-4 text-left mb-6 shadow-soft space-y-2">
              <p className="text-sm text-muted-foreground">Nos contactaremos a la brevedad para coordinar {form.shipping_method === 'retiro' ? 'el retiro en nuestro local' : 'la entrega'}.</p>
              {form.payment_method === 'transferencia' && !TRANSFER_ALIAS && (
                <p className="text-sm text-muted-foreground">
                  Te vamos a enviar los datos bancarios por WhatsApp para que puedas transferir.
                </p>
              )}
              {form.payment_method === 'efectivo' && (
                <p className="text-sm text-muted-foreground">
                  Recordá que el pago es en efectivo al momento de retirar tu pedido.
                </p>
              )}
            </div>
            {form.payment_method === 'transferencia' && (
              <>
                {TRANSFER_ALIAS && (
                  <div className="rounded-3xl border border-primary/40 bg-card p-4 text-left mb-4 shadow-soft space-y-3">
                    <p className="text-sm font-medium">Transferí a este alias (desde Mercado Pago o cualquier banco)</p>
                    <CopyRow label="Alias" value={TRANSFER_ALIAS} />
                    {paidTotal !== null && (
                      <CopyRow label="Monto exacto" value={String(paidTotal)} display={formatPrice(paidTotal)} />
                    )}
                    {TRANSFER_HOLDER && (
                      <p className="text-xs text-muted-foreground">
                        Titular: <span className="font-medium text-foreground">{TRANSFER_HOLDER}</span>. Revisá que coincida antes de transferir.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Después subí el comprobante acá abajo o mandalo por WhatsApp.</p>
                  </div>
                )}
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    `Hola! Hice el pedido ${orderId?.slice(0, 8)} y quiero coordinar la transferencia.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mb-3"
                >
                  <Button size="lg" variant="outline" className="w-full">
                    {TRANSFER_ALIAS ? 'Enviar comprobante por WhatsApp' : 'Coordinar transferencia por WhatsApp'}
                  </Button>
                </a>
                {orderId && (
                  <div className="rounded-3xl border border-border bg-card p-4 text-left mb-6 shadow-soft">
                    <p className="text-sm font-medium mb-2">¿Ya transferiste?</p>
                    <ReceiptUploader orderId={orderId} />
                  </div>
                )}
              </>
            )}
            <Link href="/catalogo">
              <Button size="lg" className="w-full">
                Seguir comprando
              </Button>
            </Link>
          </div>
          </div>
        </div>
      </StoreLayout>
    );
  }

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-lg font-medium mb-2">No hay productos en el carrito</p>
          <Link href="/catalogo">
            <Button className="mt-4">Ir al catálogo</Button>
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <div className="relative overflow-hidden bg-grain bg-garden bg-brand-sand/60">
        <MandalaLine className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 text-primary/20 sm:h-96 sm:w-96" />
        <MandalaLine className="pointer-events-none absolute -left-28 bottom-1/4 h-64 w-64 text-brand-clay/25 hidden md:block" />
        <LeafBranch className="pointer-events-none absolute left-0 top-48 h-56 w-auto text-primary/30 hidden xl:block" />
        <LeafSprig className="pointer-events-none absolute -top-3 right-2 h-20 w-12 text-primary/25 rotate-12 sm:-top-6 sm:right-8 sm:h-32 sm:w-20" />
        <LeafSprig className="pointer-events-none absolute -bottom-6 -left-3 h-24 w-14 text-accent/25 -rotate-[15deg] hidden md:block md:h-36 md:w-20" />
        <Bloom className="pointer-events-none absolute right-1/4 top-4 h-12 w-12 text-brand-clay/40 hidden md:block" />
        <Vine className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 w-72 text-primary/25 hidden lg:block" />
        <div className="container mx-auto px-4 py-8 relative">
        <Link href="/carrito" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Volver al carrito
        </Link>

        <h1 className="text-2xl font-bold mb-6">Finalizar compra</h1>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact info */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Datos de contacto</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre y apellido *</Label>
                  <Input
                    id="name"
                    required
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    required
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="11-5555-1234"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  placeholder="juan@email.com"
                />
              </div>
            </div>

            {/* Shipping method */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Método de envío</h2>
              <RadioGroup
                value={form.shipping_method}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    shipping_method: v,
                    payment_method: v === 'envio' && prev.payment_method === 'efectivo' ? 'mercadopago_tarjeta' : prev.payment_method,
                  }))
                }
              >
                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.shipping_method === 'retiro' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="retiro" id="retiro" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-primary" />
                      <Label htmlFor="retiro" className="font-medium cursor-pointer">Retiro en local</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Sin costo adicional - Disponible de Lun a Sáb</p>
                  </div>
                  <span className="font-semibold text-success">Gratis</span>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.shipping_method === 'envio' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="envio" id="envio" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-primary" />
                      <Label htmlFor="envio" className="font-medium cursor-pointer">Envío por Correo Argentino</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">A domicilio o a sucursal. Cotización automática por código postal, 2 a 5 días hábiles.</p>
                  </div>
                  <span className="font-semibold">
                    {calculatingShipping
                      ? 'Calculando...'
                      : shippingCost === null
                      ? '-'
                      : shippingCost === 0
                      ? 'Gratis'
                      : formatPrice(shippingCost)}
                  </span>
                </div>
              </RadioGroup>

              {form.shipping_method === 'envio' && (
                <div className="space-y-4 pt-2">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postal_code">Código Postal *</Label>
                      <Input
                        id="postal_code"
                        required={form.shipping_method === 'envio'}
                        value={form.postal_code}
                        minLength={4}
                        maxLength={10}
                        inputMode="text"
                        autoComplete="postal-code"
                        onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                        placeholder="5577"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="province">Provincia</Label>
                      <Input id="province" value="Mendoza" disabled readOnly />
                      <p className="text-xs text-muted-foreground">Por ahora enviamos solo dentro de Mendoza.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">¿Dónde lo recibís?</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {([
                        { key: 'domicilio', label: 'En tu domicilio', desc: 'El correo te lo lleva a tu casa.' },
                        { key: 'sucursal', label: 'En una sucursal de Correo', desc: 'Lo retirás en la sucursal más cercana a tu código postal. Más barato.' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          aria-pressed={form.shipping_service === opt.key}
                          onClick={() => setForm({ ...form, shipping_service: opt.key })}
                          className={cn(
                            'rounded-lg border p-3 text-left transition-colors',
                            form.shipping_service === opt.key ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{opt.label}</span>
                            <span className="text-sm font-semibold">
                              {calculatingShipping ? '...' : shippingQuote ? formatPrice(shippingQuote[opt.key]) : '-'}
                            </span>
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad / Localidad *</Label>
                      <Input
                        id="city"
                        required={form.shipping_method === 'envio'}
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="Palmira"
                      />
                    </div>
                    {form.shipping_service === 'domicilio' ? (
                      <div className="space-y-2">
                        <Label htmlFor="address">Dirección de envío (Calle y número) *</Label>
                        <Input
                          id="address"
                          required
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                          placeholder="Av. San Martín 123"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground sm:pt-7">
                        Te avisamos por WhatsApp a qué sucursal llega y el número de seguimiento.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-semibold text-lg">Notas del pedido (opcional)</h2>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Indicaciones especiales para la entrega..."
                rows={3}
              />
            </div>

            {/* Payment */}
            <div className="rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Método de pago</h2>
              </div>

              <RadioGroup
                value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}
              >
                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.payment_method === 'mercadopago_tarjeta' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="mercadopago_tarjeta" id="pago-mp-tarjeta" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-mp-tarjeta" className="font-medium cursor-pointer">Tarjeta de crédito o débito</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Con Mercado Pago, hasta {cuotas} cuotas sin interés de {formatPrice(valorCuota(grandTotal, cuotas))}.
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors',
                  form.payment_method === 'transferencia' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem value="transferencia" id="pago-transferencia" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-transferencia" className="font-medium cursor-pointer">Transferencia (desde Mercado Pago o cualquier banco)</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sin recargo. Si tenés saldo en Mercado Pago, transferilo desde la app.{' '}
                      {TRANSFER_ALIAS
                        ? 'Al confirmar te mostramos el alias y el monto exacto.'
                        : 'Al confirmar te mandamos los datos por WhatsApp.'}
                    </p>
                  </div>
                </div>

                <div className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 transition-colors',
                  form.shipping_method === 'envio' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  form.payment_method === 'efectivo' && 'border-primary bg-primary/5'
                )}>
                  <RadioGroupItem
                    value="efectivo"
                    id="pago-efectivo"
                    className="mt-1"
                    disabled={form.shipping_method === 'envio'}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" />
                      <Label htmlFor="pago-efectivo" className="font-medium cursor-pointer">Efectivo al retirar</Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {form.shipping_method === 'envio'
                        ? 'Solo disponible con retiro en local'
                        : `Pagás al retirar tu pedido en el local, con ${Math.round(rules.descuentoContado * 100)} % de descuento.`}
                    </p>
                  </div>
                </div>
              </RadioGroup>

              {isMercadoPago && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Vas a ser redirigido al checkout de Mercado Pago para completar el pago de forma segura.
                </p>
              )}


              {paymentError && (
                <p className="text-sm text-destructive">{paymentError}</p>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-36 rounded-3xl border border-border bg-card p-6 space-y-4 shadow-soft">
              <h2 className="font-bold text-lg">Tu pedido</h2>
              <Separator />
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={cartLineKey(item.product.id, item.variant?.id)} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                      {(item.variant?.image_url || item.product.images[0]) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <CdnImg src={item.variant?.image_url || item.product.images[0]} alt={item.product.name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium line-clamp-2">{item.product.name}</p>
                      {item.variant && (
                        <p className="text-xs text-muted-foreground">
                          {item.variant.group_name}: {item.variant.label}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.quantity}x {formatPrice(linePrice(item.product.price))}
                      </p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">
                      {formatPrice(linePrice(item.product.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Envío
                    {form.shipping_method === 'envio' && (form.shipping_service === 'sucursal' ? ' a sucursal' : ' a domicilio')}
                  </span>
                  <span>
                    {form.shipping_method === 'retiro'
                      ? 'Gratis'
                      : calculatingShipping
                      ? 'Calculando...'
                      : shippingCost === null
                      ? '-'
                      : formatPrice(shippingCost)}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-xl text-primary">{formatPrice(grandTotal)}</span>
              </div>

              {form.shipping_method === 'envio' && !shippingReady && !calculatingShipping && (
                <p className="text-sm text-muted-foreground">
                  {shippingError ?? 'Completá el código postal para calcular el envío.'}
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={processing || !shippingReady}>
                {processing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isMercadoPago
                      ? 'Redirigiendo a Mercado Pago...'
                      : 'Procesando...'}
                  </span>
                ) : isMercadoPago ? (
                  'Pagar con Mercado Pago'
                ) : (
                  'Confirmar pedido'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Compra segura y protegida
              </p>
            </div>
          </div>
        </form>
      </div>
      </div>
    </StoreLayout>
  );
}

// Fila con un dato para copiar (alias, monto) en la pantalla de pedido realizado.
function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-medium break-all">{display ?? value}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => {}
          );
        }}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
