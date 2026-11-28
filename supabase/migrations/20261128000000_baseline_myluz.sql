-- Base de datos de la tienda Myluz (proyecto Supabase nuevo y vacío).
--
-- Parte del esquema genérico de Todo y Más (catálogo, pedidos, Mercado Pago
-- por OAuth, avisos push, variantes, comprobantes) en un solo archivo, SIN lo
-- que Myluz no usa: fiado, ventas de mostrador, GoCuotas, comentarios y
-- recargos por medio de pago.
--
-- Lo propio de Myluz:
--   * Precios: se carga el precio de CONTADO (transferencia/efectivo). El de
--     lista (tarjeta, cuotas sin interés) lo calcula la tienda con el
--     descuento de store_settings. El precio de REVENDEDOR va en una tabla
--     aparte (product_reseller_prices) que solo leen el dueño y los
--     revendedores aprobados: el público nunca lo ve.
--   * Stock real (stock) + stock visible opcional (stock_visible): si está
--     cargado, la tienda muestra ese número como tope; si no, solo "Disponible".
--   * Revendedores: cuentas que se registran solas y quedan "pendiente" hasta
--     que el dueño las aprueba desde el panel.
--   * store_settings: datos del negocio y reglas (envío gratis, descuento,
--     cuotas) editables desde el panel, así el repo público no tiene datos
--     del cliente.
--   * upsert_products: carga/actualización masiva por código (sincronización
--     con el programa del negocio o un CSV).
--
-- Roles (profiles.role): 'admin' (dueño), 'empleado', 'revendedor'.
-- "Personal" (is_staff) = admin o empleado. Un revendedor está autenticado
-- pero NO es personal: nunca ve pedidos ajenos ni puede tocar el catálogo.

-- ───────────────────────── Tablas ─────────────────────────

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  icon text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Código del artículo en el programa del negocio (para sincronizar).
  code text UNIQUE,
  name text NOT NULL,
  description text,
  -- Precio de contado (transferencia o efectivo).
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock int NOT NULL DEFAULT 0,
  -- Tope que se muestra al público; NULL = no mostrar número ("Disponible").
  stock_visible int CHECK (stock_visible IS NULL OR stock_visible >= 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  images text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  on_sale boolean NOT NULL DEFAULT false,
  has_variants boolean NOT NULL DEFAULT false,
  weight_kg numeric(8,3),
  length_cm numeric(6,1),
  width_cm numeric(6,1),
  height_cm numeric(6,1),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT products_shipping_dims_positive CHECK (
    (weight_kg IS NULL OR weight_kg > 0)
    AND (length_cm IS NULL OR length_cm > 0)
    AND (width_cm IS NULL OR width_cm > 0)
    AND (height_cm IS NULL OR height_cm > 0)
  )
);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_subcategory ON public.products(subcategory_id);

CREATE TABLE public.product_reseller_prices (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_name text NOT NULL DEFAULT 'Talle',
  label text NOT NULL,
  color_hex text,
  image_url text,
  stock int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);

CREATE TABLE public.product_extra_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX idx_product_extra_categories_category ON public.product_extra_categories(category_id);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'empleado' CHECK (role IN ('admin', 'empleado', 'revendedor')),
  -- Solo para revendedores: 'pendiente' hasta que el dueño lo aprueba.
  estado text NOT NULL DEFAULT 'aprobado' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  nombre text,
  negocio text,
  cuit text,
  telefono text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_profiles_role_estado ON public.profiles(role, estado);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Revendedor que hizo el pedido (NULL = cliente final sin cuenta).
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  status text NOT NULL DEFAULT 'pendiente',
  shipping_method text NOT NULL DEFAULT 'retiro',
  shipping_service text,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  address text,
  city text,
  notes text,
  -- 'contado' | 'lista' | 'revendedor': qué precio se cobró.
  price_tier text NOT NULL DEFAULT 'contado' CHECK (price_tier IN ('contado', 'lista', 'revendedor')),
  installments int NOT NULL DEFAULT 1 CHECK (installments >= 1),
  total numeric(10,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]',
  payment_method text,
  payment_status text NOT NULL DEFAULT 'pendiente',
  mp_preference_id text,
  mp_payment_id text,
  receipt_path text,
  stock_committed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_mp_preference ON public.orders(mp_preference_id);
CREATE INDEX idx_orders_customer ON public.orders(customer_id);

-- Una sola fila. Valores por defecto = lo acordado con el dueño.
CREATE TABLE public.store_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  descuento_contado numeric(4,3) NOT NULL DEFAULT 0.10 CHECK (descuento_contado >= 0 AND descuento_contado < 1),
  cuotas_sin_interes int NOT NULL DEFAULT 3 CHECK (cuotas_sin_interes >= 1 AND cuotas_sin_interes <= 24),
  envio_gratis_desde numeric(10,2) CHECK (envio_gratis_desde IS NULL OR envio_gratis_desde >= 0),
  -- Datos que se muestran en legales / pie de página (se cargan desde el panel).
  razon_social text,
  cuit text,
  domicilio text,
  email_contacto text,
  politica_cambios text,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO public.store_settings (id, envio_gratis_desde) VALUES (true, 100000);

CREATE TABLE public.mercadopago_connection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  access_token text,
  refresh_token text,
  public_key text,
  mp_user_id text,
  token_expires_at timestamptz,
  pending_state text,
  pending_state_created_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.oauth_states (
  state text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- ───────────────────────── Funciones de permisos ─────────────────────────

CREATE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin', false);
$$;

CREATE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT role IN ('admin', 'empleado') FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE FUNCTION public.is_approved_reseller()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'revendedor' AND estado = 'aprobado'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(), public.is_staff(), public.is_approved_reseller() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.is_staff(), public.is_approved_reseller() TO anon, authenticated;

-- ───────────────────────── RLS ─────────────────────────

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reseller_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_extra_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo el servidor (service role) las lee/escribe.
ALTER TABLE public.mercadopago_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Catálogo: lo ve cualquiera, lo edita el dueño.
CREATE POLICY "public_select_categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_categories" ON public.categories FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_update_categories" ON public.categories FOR UPDATE TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_delete_categories" ON public.categories FOR DELETE TO authenticated USING ((SELECT is_admin()));

CREATE POLICY "public_select_products" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_products" ON public.products FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_update_products" ON public.products FOR UPDATE TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_delete_products" ON public.products FOR DELETE TO authenticated USING ((SELECT is_admin()));

CREATE POLICY "public_select_product_variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_product_variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_update_product_variants" ON public.product_variants FOR UPDATE TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_delete_product_variants" ON public.product_variants FOR DELETE TO authenticated USING ((SELECT is_admin()));

CREATE POLICY "public_select_product_extra_categories" ON public.product_extra_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_insert_product_extra_categories" ON public.product_extra_categories FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_update_product_extra_categories" ON public.product_extra_categories FOR UPDATE TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_delete_product_extra_categories" ON public.product_extra_categories FOR DELETE TO authenticated USING ((SELECT is_admin()));

-- Precio de revendedor: solo personal y revendedores aprobados (nunca anon).
CREATE POLICY "reseller_select_prices" ON public.product_reseller_prices FOR SELECT TO authenticated
  USING ((SELECT is_staff()) OR (SELECT is_approved_reseller()));
CREATE POLICY "admin_insert_reseller_prices" ON public.product_reseller_prices FOR INSERT TO authenticated WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_update_reseller_prices" ON public.product_reseller_prices FOR UPDATE TO authenticated USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));
CREATE POLICY "admin_delete_reseller_prices" ON public.product_reseller_prices FOR DELETE TO authenticated USING ((SELECT is_admin()));

-- Perfiles: cada uno ve/edita el suyo; el dueño ve y edita todos (aprobar revendedores).
CREATE POLICY "select_own_or_admin_profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT is_admin()));
CREATE POLICY "update_own_or_admin_profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT is_admin()))
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- Pedidos: los crea solo el servidor. Personal ve y actualiza todos;
-- un revendedor ve solo los suyos; borrar solo el dueño.
CREATE POLICY "select_orders" ON public.orders FOR SELECT TO authenticated
  USING ((SELECT is_staff()) OR customer_id = (SELECT auth.uid()));
CREATE POLICY "staff_update_orders" ON public.orders FOR UPDATE TO authenticated
  USING ((SELECT is_staff())) WITH CHECK ((SELECT is_staff()));
CREATE POLICY "admin_delete_orders" ON public.orders FOR DELETE TO authenticated USING ((SELECT is_admin()));

CREATE POLICY "public_select_store_settings" ON public.store_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_update_store_settings" ON public.store_settings FOR UPDATE TO authenticated
  USING ((SELECT is_admin())) WITH CHECK ((SELECT is_admin()));

-- ───────────────────────── Triggers ─────────────────────────

CREATE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_reseller_prices_updated BEFORE UPDATE ON public.product_reseller_prices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_store_settings_updated BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Nadie se cambia a sí mismo el rol ni se auto-aprueba como revendedor.
CREATE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.estado IS DISTINCT FROM OLD.estado
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'No podés cambiar tu rol, tu estado ni tu email desde acá';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_prevent_self_role_escalation BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Un empleado solo puede mover el estado del pedido (preparado, enviado...).
CREATE FUNCTION public.enforce_employee_order_restrictions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.total IS DISTINCT FROM OLD.total
     OR NEW.items IS DISTINCT FROM OLD.items
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.price_tier IS DISTINCT FROM OLD.price_tier
     OR NEW.installments IS DISTINCT FROM OLD.installments
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.mp_preference_id IS DISTINCT FROM OLD.mp_preference_id
     OR NEW.mp_payment_id IS DISTINCT FROM OLD.mp_payment_id
     OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
     OR NEW.shipping_service IS DISTINCT FROM OLD.shipping_service
     OR NEW.receipt_path IS DISTINCT FROM OLD.receipt_path
     OR NEW.stock_committed_at IS DISTINCT FROM OLD.stock_committed_at THEN
    RAISE EXCEPTION 'No tenés permiso para modificar ese dato del pedido';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_employee_order_restrictions BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_employee_order_restrictions();

CREATE FUNCTION public.sync_product_has_variants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products
    SET has_variants = EXISTS (SELECT 1 FROM product_variants WHERE product_id = target_id)
    WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_sync_has_variants AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_has_variants();

-- Alta de revendedor: al registrarse con metadata {tipo: 'revendedor'} se
-- crea su perfil en 'pendiente'. Cualquier otro alta (empleados que crea el
-- dueño desde el panel) no pasa por acá: el servidor inserta su perfil.
CREATE FUNCTION public.handle_new_reseller()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF m->>'tipo' = 'revendedor' THEN
    INSERT INTO public.profiles (id, email, role, estado, nombre, negocio, cuit, telefono)
    VALUES (
      NEW.id, COALESCE(NEW.email, ''), 'revendedor', 'pendiente',
      left(NULLIF(trim(m->>'nombre'), ''), 120),
      left(NULLIF(trim(m->>'negocio'), ''), 120),
      left(NULLIF(trim(m->>'cuit'), ''), 20),
      left(NULLIF(trim(m->>'telefono'), ''), 30)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_reseller AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_reseller();

-- ───────────────────────── Stock ─────────────────────────

-- Descuenta stock de un pedido UNA sola vez (al confirmarse el pago o al
-- crear un pedido por transferencia). Si la línea tiene talle/variante,
-- descuenta también el stock de esa variante.
CREATE FUNCTION public.commit_order_stock(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_item jsonb;
  v_qty int;
  v_product_id uuid;
  v_variant_id uuid;
BEGIN
  UPDATE orders SET stock_committed_at = now()
    WHERE id = p_order_id AND stock_committed_at IS NULL
    RETURNING * INTO v_order;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_order.items, '[]'::jsonb)) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    CONTINUE WHEN v_product_id IS NULL OR v_qty <= 0;
    UPDATE products SET stock = GREATEST(stock - v_qty, 0) WHERE id = v_product_id;
    IF v_variant_id IS NOT NULL THEN
      UPDATE product_variants SET stock = GREATEST(stock - v_qty, 0)
        WHERE id = v_variant_id AND product_id = v_product_id;
    END IF;
  END LOOP;
END;
$$;
-- Solo el servidor (checkout y webhook de Mercado Pago).
REVOKE ALL ON FUNCTION public.commit_order_stock(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_order_stock(uuid) TO service_role;

CREATE FUNCTION public.restore_stock_on_order_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb;
  v_qty int;
  v_product_id uuid;
  v_variant_id uuid;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado' AND NEW.stock_committed_at IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) LOOP
      v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
      v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
      v_qty := COALESCE((v_item->>'quantity')::int, 0);
      CONTINUE WHEN v_product_id IS NULL OR v_qty <= 0;
      UPDATE products SET stock = stock + v_qty WHERE id = v_product_id;
      IF v_variant_id IS NOT NULL THEN
        UPDATE product_variants SET stock = stock + v_qty WHERE id = v_variant_id AND product_id = v_product_id;
      END IF;
    END LOOP;
    NEW.stock_committed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
-- Corre después del trigger de permisos (orden alfabético): el empleado
-- puede cancelar y el stock vuelve igual.
CREATE TRIGGER trg_restore_stock_on_cancel BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_order_cancel();

-- El cliente adjunta el comprobante de su transferencia (necesita el id del pedido).
CREATE FUNCTION public.attach_payment_receipt(p_order_id uuid, p_receipt_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE orders SET receipt_path = p_receipt_path
    WHERE id = p_order_id AND payment_method = 'transferencia' AND receipt_path IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.attach_payment_receipt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_payment_receipt(uuid, text) TO anon, authenticated;

-- ───────────────────────── Carga masiva ─────────────────────────

-- p_rows: [{code, name, price, price_revendedor?, stock?, stock_visible?}, ...]
-- Crea o actualiza por código. No toca fotos, descripción ni categorías
-- (eso se arma en el panel). price_revendedor null/ausente = no lo cambia.
CREATE FUNCTION public.upsert_products(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  v_id uuid;
  v_code text;
  v_inserted boolean;
  n_new int := 0;
  n_upd int := 0;
BEGIN
  IF NOT (auth.role() = 'service_role' OR is_admin()) THEN
    RAISE EXCEPTION 'Solo el dueño puede cargar productos';
  END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Formato inválido: se esperaba una lista';
  END IF;
  IF jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'Demasiadas filas en una carga (máximo 5000)';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_code := NULLIF(trim(r->>'code'), '');
    IF v_code IS NULL OR NULLIF(trim(r->>'name'), '') IS NULL OR r->>'price' IS NULL THEN
      RAISE EXCEPTION 'Fila sin código, nombre o precio: %', r;
    END IF;
    INSERT INTO products (code, name, price, stock, stock_visible)
    VALUES (
      v_code, trim(r->>'name'), (r->>'price')::numeric,
      COALESCE((r->>'stock')::int, 0), (r->>'stock_visible')::int
    )
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      stock = CASE WHEN r ? 'stock' THEN EXCLUDED.stock ELSE products.stock END,
      stock_visible = CASE WHEN r ? 'stock_visible' THEN EXCLUDED.stock_visible ELSE products.stock_visible END
    RETURNING id, (xmax = 0) INTO v_id, v_inserted;
    IF v_inserted THEN n_new := n_new + 1; ELSE n_upd := n_upd + 1; END IF;
    IF r->>'price_revendedor' IS NOT NULL THEN
      INSERT INTO product_reseller_prices (product_id, price)
      VALUES (v_id, (r->>'price_revendedor')::numeric)
      ON CONFLICT (product_id) DO UPDATE SET price = EXCLUDED.price;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('nuevos', n_new, 'actualizados', n_upd);
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_products(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_products(jsonb) TO authenticated, service_role;

-- Las funciones de trigger no se llaman por API.
REVOKE ALL ON FUNCTION public.touch_updated_at(), public.prevent_self_role_escalation(),
  public.enforce_employee_order_restrictions(), public.sync_product_has_variants(),
  public.handle_new_reseller(), public.restore_stock_on_order_cancel() FROM PUBLIC, anon, authenticated;

-- ───────────────────────── Storage ─────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('payment-receipts', 'payment-receipts', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Fotos: bucket público (se sirven por URL pública); subir/cambiar/borrar solo el dueño.
CREATE POLICY "admin_insert_product_images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (SELECT public.is_admin()));
CREATE POLICY "admin_update_product_images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.is_admin()));
CREATE POLICY "admin_delete_product_images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (SELECT public.is_admin()));

-- Comprobantes: los sube el cliente (sin cuenta), los ve el personal.
CREATE POLICY "anon_insert_payment_receipts" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'payment-receipts');
CREATE POLICY "staff_select_payment_receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts' AND (SELECT public.is_staff()));
CREATE POLICY "staff_delete_payment_receipts" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND (SELECT public.is_staff()));
