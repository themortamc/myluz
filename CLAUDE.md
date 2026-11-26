# myluz
Tienda online para un comercio multirubro (cliente de mortups). Hoy es un **prototipo estático** en `public/` (HTML + CSS + JS, datos de ejemplo); la versión real se construye sobre la base de Todo y Más (Next.js + Supabase + Cloudflare).
- Verificar: `npm run check` (sintaxis). Probar en el navegador con Playwright antes de decir "listo".
- Deploy: `npm run deploy` (Cloudflare Workers, nombre `myluz`).
- **Repo público:** nunca subir claves, `.env`, datos reales del cliente (productos exportados, chats, teléfonos, direcciones). Las exportaciones van en `datos/` (ignorado).
- Contexto del cliente y decisiones: `~/brain/Proyectos/myluz.md`.
- **Calidad (pedido del usuario):** la versión real se construye aplicando las skills de diseño (`impeccable`/`unslop`), `copywriting`, `seo`/`schema` y `cro`: textos reales del negocio, datos estructurados de productos, sitemap, metadatos, Core Web Vitals y accesibilidad. El prototipo es `noindex` a propósito.
