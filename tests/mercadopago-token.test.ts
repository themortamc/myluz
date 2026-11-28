import { describe, expect, it } from 'vitest';
import { needsRefresh } from '../lib/server/mercadopago-connection';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-12-01T00:00:00Z');

describe('renovación del token de Mercado Pago', () => {
  it('renueva si faltan menos de 15 días o ya venció', () => {
    expect(needsRefresh(new Date(now + 10 * DAY).toISOString(), now)).toBe(true);
    expect(needsRefresh(new Date(now - DAY).toISOString(), now)).toBe(true);
  });
  it('no renueva si falta mucho o no hay fecha', () => {
    expect(needsRefresh(new Date(now + 100 * DAY).toISOString(), now)).toBe(false);
    expect(needsRefresh(null, now)).toBe(false);
    expect(needsRefresh('cualquier cosa', now)).toBe(false);
  });
});
