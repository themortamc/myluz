'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, Loader2, Percent, Save, Unlink, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/format';
import { precioLista, rulesFromSettings, valorCuota } from '@/lib/pricing';

const MP_ERROR_MESSAGES: Record<string, string> = {
  cancelado: 'Cancelaste la conexión con Mercado Pago.',
  faltan_datos: 'Mercado Pago no envió los datos esperados. Probá de nuevo.',
  estado_invalido: 'El enlace de conexión expiró o ya se usó. Probá de nuevo.',
  no_configurado: 'Falta configuración del lado del servidor para conectar Mercado Pago.',
  token_fallo: 'Mercado Pago rechazó la conexión. Probá de nuevo.',
  inesperado: 'Ocurrió un error inesperado al conectar. Probá de nuevo.',
};

// Acepta "10", "7.5" y "7,5". Devuelve null si no es un número válido en [min, max].
function parseNumber(text: string, min: number, max: number): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') return null;
  const num = Number(clean);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

// Reglas de precio y envío (tabla store_settings). Las usan la tienda para
// mostrar y el servidor para cobrar, así lo que se ve es lo que se cobra.
function StoreRulesCard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [descuento, setDescuento] = useState('');
  const [cuotas, setCuotas] = useState('');
  const [envioGratis, setEnvioGratis] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('descuento_contado, cuotas_sin_interes, envio_gratis_desde')
        .maybeSingle();
      if (error) setErrorMsg('No pudimos leer la configuración.');
      const rules = rulesFromSettings(data);
      setDescuento(String(Math.round(rules.descuentoContado * 1000) / 10));
      setCuotas(String(rules.cuotasSinInteres));
      setEnvioGratis(rules.envioGratisDesde == null ? '' : String(rules.envioGratisDesde));
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setNotice(null);
    setErrorMsg(null);
    const d = parseNumber(descuento, 0, 50);
    const c = parseNumber(cuotas, 1, 24);
    // El monto se escribe como "100000" o "100.000": se toman solo los dígitos.
    const g = envioGratis.trim() === '' ? null : parseNumber(envioGratis.replace(/\D/g, ''), 0, 100000000);
    if (d === null) return setErrorMsg('El descuento tiene que ser un número entre 0 y 50.');
    if (c === null || !Number.isInteger(c)) return setErrorMsg('Las cuotas tienen que ser un número entero entre 1 y 24.');
    if (envioGratis.trim() !== '' && g === null) return setErrorMsg('El monto de envío gratis no es válido.');
    setSaving(true);
    const { error } = await supabase
      .from('store_settings')
      .update({ descuento_contado: d / 100, cuotas_sin_interes: c, envio_gratis_desde: g })
      .eq('id', true);
    setSaving(false);
    if (error) return setErrorMsg('No se pudo guardar. Probá de nuevo.');
    setNotice('Guardado. La tienda ya usa los valores nuevos.');
  };

  const ejemplo = (() => {
    const d = parseNumber(descuento, 0, 50);
    const c = parseNumber(cuotas, 1, 24);
    if (d === null || c === null) return null;
    const lista = precioLista(10000, d / 100);
    return `Ejemplo: un producto de ${formatPrice(10000)} de contado se muestra a ${formatPrice(lista)} con tarjeta (${c} cuotas de ${formatPrice(valorCuota(lista, c))}).`;
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Percent className="h-5 w-5" />
          Precios y envío
        </CardTitle>
        <CardDescription>
          En cada producto cargás el precio de contado (transferencia o efectivo). Con tarjeta se cobra el precio de lista, en cuotas sin interés.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && (
          <div className="rounded-lg border border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400 px-4 py-2 text-sm">
            {notice}
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-2 text-sm">
            {errorMsg}
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="regla-descuento" className="flex-1 font-normal">
                  Descuento pagando por transferencia o efectivo
                </Label>
                <div className="relative w-28 shrink-0">
                  <Input id="regla-descuento" inputMode="decimal" disabled={!isAdmin} value={descuento} onChange={(e) => setDescuento(e.target.value)} className="pr-7" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="regla-cuotas" className="flex-1 font-normal">
                  Cuotas sin interés con tarjeta
                </Label>
                <Input id="regla-cuotas" inputMode="numeric" disabled={!isAdmin} value={cuotas} onChange={(e) => setCuotas(e.target.value)} className="w-28 shrink-0" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="regla-envio" className="flex-1 font-normal">
                  Envío gratis desde (vacío = nunca)
                </Label>
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input id="regla-envio" inputMode="numeric" disabled={!isAdmin} value={envioGratis} onChange={(e) => setEnvioGratis(e.target.value)} className="pl-6" />
                </div>
              </div>
            </div>
            {ejemplo && <p className="text-xs text-muted-foreground">{ejemplo}</p>}
            <p className="text-xs text-muted-foreground">
              Las cuotas sin interés también hay que activarlas en tu cuenta de Mercado Pago (Tu negocio → Costos → Cuotas sin interés).
            </p>
            {isAdmin ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Solo el dueño puede cambiar estos valores.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PagosContent() {
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [mpUserId, setMpUserId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accessToken = session?.access_token;

  async function fetchStatus() {
    if (!accessToken) return;
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/mercadopago/oauth/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setConnected(data.connected);
        setMpUserId(data.mpUserId);
      }
    } catch {
      // silent - the card will just show "no conectado"
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const mpConnected = searchParams.get('mp_connected');
    const mpError = searchParams.get('mp_error');

    if (mpConnected) {
      setNotice('¡Cuenta de Mercado Pago conectada con éxito!');
      router.replace('/admin/pagos');
    } else if (mpError) {
      setErrorMsg(MP_ERROR_MESSAGES[mpError] || 'No pudimos conectar Mercado Pago.');
      router.replace('/admin/pagos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConnect() {
    if (!accessToken) return;
    setConnecting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/mercadopago/oauth/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg((data.error || 'No pudimos iniciar la conexión.') + (data.details ? "\nDetalles: " + data.details : ''));
        setConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErrorMsg('No pudimos iniciar la conexión.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!accessToken) return;
    if (!confirm('¿Seguro que querés desconectar la cuenta de Mercado Pago? Los clientes no van a poder pagar con Mercado Pago hasta que la vuelvas a conectar.')) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch('/api/mercadopago/oauth/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setConnected(false);
        setMpUserId(null);
        setNotice('Cuenta de Mercado Pago desconectada.');
      } else {
        setErrorMsg(data.error || 'No pudimos desconectar la cuenta.');
      }
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pagos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conectá tu propia cuenta de Mercado Pago para poder cobrar. Nunca compartís tu contraseña ni ninguna clave con nadie: iniciás sesión directo en Mercado Pago.
        </p>
      </div>

      {notice && (
        <div className="rounded-lg border border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400 px-4 py-3 text-sm">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Mercado Pago
          </CardTitle>
          <CardDescription>
            Necesario para que los clientes puedan pagar online con tarjeta desde el checkout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Revisando estado de la conexión...
            </div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Cuenta conectada{mpUserId ? ` (ID de vendedor: ${mpUserId})` : ''}
              </div>
              <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                Desconectar cuenta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                Todavía no conectaste ninguna cuenta de Mercado Pago.
              </div>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Conectar con Mercado Pago
              </Button>
              <p className="text-xs text-muted-foreground">
                Te vamos a llevar a mercadopago.com para que inicies sesión con tu cuenta y autorices la conexión. No vas a escribir ninguna clave acá.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <StoreRulesCard />
    </div>
  );
}

export default function AdminPagosPage() {
  return (
    <Suspense fallback={null}>
      <PagosContent />
    </Suspense>
  );
}
