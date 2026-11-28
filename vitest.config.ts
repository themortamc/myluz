import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// prototipo/ es el diseño estático aprobado (tiene sus propios tests con node:test).
// El alias "@" es el mismo de tsconfig.json, para poder testear el código del servidor.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { exclude: ['node_modules/**', 'prototipo/**'] },
});
