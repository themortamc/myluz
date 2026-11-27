# myluz (tienda real)
Tienda online real de **Myluz** (calzado y multirubro, Junín, Mendoza), cliente de mortups. Base copiada de `~/todoymas` (Next.js 14 + Supabase + Cloudflare Workers/OpenNext). El prototipo aprobado está en la carpeta `prototipo/` y hoy es lo publicado en myluz.com.ar (worker `myluz`; se publica con `cd prototipo && npm run deploy`).
- Verificar: `npm run typecheck`, `npm run lint`, `npm test` (vitest), `npm run build`. Hook Stop corre typecheck+lint; pre-push en `.git/hooks` (nunca `--no-verify`).
- **Repo PÚBLICO:** nada de datos del cliente (CUIT, alias, nombre, teléfonos, dirección) ni claves. Datos del negocio por variables de entorno / tabla `store_settings`.
- Plan y decisiones: `~/.claude/plans/planifica-mejoras-y-prospeccio-kind-snowglobe-of-*.md` y `~/brain/Proyectos/myluz.md`.
- Precios: `products.price` = contado; lista = contado ÷ 0,9 redondeado a $10 (3 cuotas sin interés con tarjeta); revendedores aprobados ven `price_revendedor`.
- Envío: solo Mendoza por Correo Argentino, gratis desde $100.000; retiro en el local.
- Preguntar antes de tocar la DB de producción, pagos o el dominio myluz.com.ar (hoy muestra el prototipo).
- **ESTÉTICA (pedido del usuario): la tienda real se tiene que ver igual que el prototipo** (rojo #a8252f, palabra Myluz recortada del logo, tarjetas, bloque de precios tachado/lista/cuotas/contado, panel). Copiar diseño y textos de `prototipo/public/` (`index.html`, `styles.css`, `app.js`), NO el diseño de Todo y Más.
- Worker de la tienda nueva: `myluz-tienda` (workers.dev). NO publicar sobre el worker `myluz` ni cambiar el dominio sin avisar.
- **Supabase está conectado a este repo por GitHub:** lo que haya en `supabase/migrations` se aplica solo al subir a main. Subir solo migraciones revisadas y probadas (dry-run antes).
