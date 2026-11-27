import { defineConfig } from 'vitest/config';

// prototipo/ es el diseño estático aprobado (tiene sus propios tests con node:test).
export default defineConfig({ test: { exclude: ['node_modules/**', 'prototipo/**'] } });
