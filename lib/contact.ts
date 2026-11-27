// Datos de contacto del negocio. El repo es público: los datos reales del cliente
// NO van acá; se cargan con variables de entorno (y más adelante desde el panel, tabla store_settings).
const env = (k: string) => (process.env[k] ?? '').trim();

export const WHATSAPP_NUMBER = env('NEXT_PUBLIC_WHATSAPP_NUMBER'); // formato 549XXXXXXXXXX
export const WHATSAPP_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Te escribo desde la web de Myluz.')}`
  : '';
export const WHATSAPP_CHANNEL_URL = '';
// Si TRANSFER_ALIAS queda vacío, la pantalla de pedido realizado manda a coordinar los datos por WhatsApp.
export const TRANSFER_ALIAS = env('NEXT_PUBLIC_TRANSFER_ALIAS');
export const TRANSFER_HOLDER = env('NEXT_PUBLIC_TRANSFER_HOLDER');

export const INSTAGRAM_HANDLE = env('NEXT_PUBLIC_INSTAGRAM_HANDLE');
export const INSTAGRAM_URL = INSTAGRAM_HANDLE ? `https://instagram.com/${INSTAGRAM_HANDLE}` : '';
export const TIKTOK_HANDLE = env('NEXT_PUBLIC_TIKTOK_HANDLE');
export const TIKTOK_URL = TIKTOK_HANDLE ? `https://www.tiktok.com/@${TIKTOK_HANDLE}` : '';
export const FACEBOOK_URL = env('NEXT_PUBLIC_FACEBOOK_URL');
