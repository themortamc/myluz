"""Genera las páginas legales de public/legales/. Uso: python3 tools/legales.py
Los datos del negocio marcados [COMPLETAR] se reemplazan cuando el cliente los pase."""
from pathlib import Path
import html

NEGOCIO = {
    "nombre": "myluz",
    "razon": "[COMPLETAR: razón social o nombre del titular]",
    "cuit": "[COMPLETAR: CUIT]",
    "domicilio": "[COMPLETAR: domicilio comercial], Junín, Mendoza",
    "contacto": "[COMPLETAR: WhatsApp y mail de atención]",
    "actualizado": "26 de noviembre de 2026",
}
OUT = Path(__file__).resolve().parent.parent / "public" / "legales"

def pagina(slug, titulo, cuerpo):
    n = NEGOCIO
    return f"""<!doctype html>
<html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>{titulo} · myluz</title>
<link rel="icon" href="../../favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../../styles.css"></head>
<body class="legal-body">
<div class="aviso">Borrador para el prototipo · revisar con el contador o abogado del negocio antes de publicar</div>
<header class="top"><div class="w top-in"><a class="logo" href="../../"><span class="sol" aria-hidden="true"></span><span>my<b>luz</b></span></a>
<a class="btn-g" href="../../">Volver a la tienda</a></div></header>
<main class="w legal">
<nav class="migas" aria-label="Ruta"><a href="../../">Inicio</a><span>/</span><span aria-current="page">{titulo}</span></nav>
<h1>{titulo}</h1>
<p class="nota">Última actualización: {n['actualizado']}</p>
{cuerpo}
<nav class="legal-nav" aria-label="Otros textos legales">
<a href="../terminos/">Términos y condiciones</a><a href="../privacidad/">Privacidad</a><a href="../cambios-y-devoluciones/">Cambios, devoluciones y garantía</a><a href="../mayoristas/">Condiciones para mayoristas</a><a href="../arrepentimiento/">Botón de arrepentimiento</a>
</nav>
</main>
<footer class="pie"><div class="w"><p>{html.escape(n['razon'])} · CUIT {html.escape(n['cuit'])} · {html.escape(n['domicilio'])}</p>
<p><a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" rel="noopener">Defensa de las y los consumidores. Para reclamos ingrese aquí.</a></p></div></footer>
</body></html>"""

N = NEGOCIO
PAGINAS = {
"terminos": ("Términos y condiciones", f"""
<h2>1. Quiénes somos</h2>
<p>Este sitio es operado por {N['razon']}, CUIT {N['cuit']}, con domicilio en {N['domicilio']} ("myluz"). Atención al cliente: {N['contacto']}.</p>
<h2>2. Aceptación</h2>
<p>Al navegar el sitio o hacer un pedido aceptás estos términos, la <a href="../privacidad/">política de privacidad</a> y la de <a href="../cambios-y-devoluciones/">cambios y devoluciones</a>. Si no estás de acuerdo, no uses el sitio.</p>
<h2>3. Productos, fotos y stock</h2>
<p>Las fotos son ilustrativas y pueden tener diferencias de color o presentación con el producto real. El stock se actualiza con frecuencia pero puede variar: si un producto que pediste se agotó, te avisamos y podés elegir otro o recibir la devolución de lo pagado por ese producto.</p>
<h2>4. Precios</h2>
<p>Los precios están en pesos argentinos e incluyen IVA. Rigen para compras online y pueden cambiar sin aviso, pero siempre respetamos el precio vigente al momento en que confirmaste tu pedido. Si por un error evidente un precio se publicó mal, te avisamos antes de cobrar y podés cancelar el pedido sin costo.</p>
<h2>5. Pedidos</h2>
<p>El pedido queda confirmado cuando acreditamos el pago o, en el caso de retiro en el local con pago al retirar, cuando te lo confirmamos por WhatsApp o mail. Te enviamos el detalle del pedido por esos medios.</p>
<h2>6. Medios de pago</h2>
<p>Aceptamos transferencia bancaria y tarjetas de crédito y débito a través de Mercado Pago. Los pagos con tarjeta se procesan en la plataforma de Mercado Pago y se rigen por sus propios términos; myluz no ve ni guarda los datos de tu tarjeta.</p>
<h2>7. Envíos y retiro</h2>
<p>Hacemos envíos a toda la provincia de Mendoza por Correo Argentino. El costo y el plazo estimado se informan antes de confirmar la compra. Los plazos del correo son estimados y pueden variar por causas ajenas a myluz. También podés retirar tu pedido en el local, en el horario de atención, cuando te avisemos que está listo.</p>
<h2>8. Derecho de arrepentimiento</h2>
<p>Si comprás como consumidor, podés revocar la compra dentro de los 10 días corridos desde que recibiste el producto, sin dar explicaciones (art. 34 de la Ley 24.240 y art. 1110 del Código Civil y Comercial). Podés hacerlo desde el <a href="../arrepentimiento/">botón de arrepentimiento</a>. Más detalle en <a href="../cambios-y-devoluciones/">cambios y devoluciones</a>.</p>
<h2>9. Cuentas de mayoristas y revendedores</h2>
<p>Las cuentas mayoristas tienen condiciones propias, que se detallan en <a href="../mayoristas/">condiciones para mayoristas</a>.</p>
<h2>10. Uso del sitio</h2>
<p>No está permitido usar el sitio para fines ilícitos, intentar acceder a cuentas de otras personas, alterar su funcionamiento ni copiar su contenido para fines comerciales sin autorización. Los textos, fotos propias, marcas y diseño del sitio pertenecen a myluz o a sus respectivos titulares.</p>
<h2>11. Responsabilidad</h2>
<p>Hacemos lo posible para que el sitio funcione sin interrupciones y la información sea correcta, pero puede haber fallas técnicas o errores. Nada de lo dispuesto aquí limita los derechos que la ley te reconoce como consumidor.</p>
<h2>12. Cambios en estos términos</h2>
<p>Podemos actualizar estos términos. A cada compra se le aplica la versión vigente al momento de confirmarla.</p>
<h2>13. Ley aplicable y reclamos</h2>
<p>Rigen las leyes de la República Argentina, en especial la Ley 24.240 de Defensa del Consumidor. Ante cualquier reclamo, escribinos primero: lo resolvemos rápido. También podés acudir a la Dirección de Defensa del Consumidor de Mendoza o a la <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" rel="noopener">Ventanilla Federal de Reclamos</a>.</p>
"""),
"privacidad": ("Política de privacidad", f"""
<h2>1. Quién es responsable de tus datos</h2>
<p>{N['razon']}, CUIT {N['cuit']}, con domicilio en {N['domicilio']}, es responsable de la base de datos de clientes de myluz. Contacto: {N['contacto']}.</p>
<h2>2. Qué datos pedimos y para qué</h2>
<ul><li><b>Para tu pedido:</b> nombre, teléfono, mail y dirección de entrega. Los usamos para preparar, enviar y avisarte sobre tu compra.</li>
<li><b>Para cuentas mayoristas:</b> nombre del negocio, CUIT, mail y teléfono, para verificar y aprobar la cuenta.</li>
<li><b>Datos de pago:</b> los pagos con tarjeta se hacen en Mercado Pago; nosotros no recibimos ni guardamos los datos de tu tarjeta.</li></ul>
<p>No vendemos ni cedemos tus datos. Solo los compartimos con quienes nos ayudan a darte el servicio (por ejemplo, el correo que entrega tu pedido o el proveedor de pagos), y solo lo necesario para eso.</p>
<h2>3. Cuánto tiempo los guardamos</h2>
<p>Mientras tengas pedidos o una cuenta activa, y después el tiempo que exijan las normas fiscales y comerciales.</p>
<h2>4. Almacenamiento en tu navegador</h2>
<p>El sitio guarda en tu navegador tu carrito y tu sesión para que no los pierdas al recargar. No usamos cookies de publicidad. Podés borrar estos datos desde la configuración de tu navegador.</p>
<h2>5. Tus derechos</h2>
<p>Podés pedirnos acceder a tus datos, corregirlos, actualizarlos o eliminarlos escribiéndonos a {N['contacto']}. Te respondemos dentro de los plazos de la Ley 25.326 (10 días corridos para el acceso y 5 días hábiles para la rectificación o supresión).</p>
<p class="aaip">El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N.º 25.326. La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N.º 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>
<h2>6. Seguridad</h2>
<p>Aplicamos medidas razonables para proteger tus datos: conexión cifrada (https), acceso restringido al panel y contraseñas protegidas.</p>
"""),
"cambios-y-devoluciones": ("Cambios, devoluciones y garantía", f"""
<h2>Derecho de arrepentimiento (10 días)</h2>
<p>Si compraste como consumidor, tenés 10 días corridos desde que recibiste el producto para arrepentirte, sin dar explicaciones y sin costo. El producto tiene que estar sin uso, con su embalaje y accesorios. El costo de devolución está a nuestro cargo y te reintegramos lo pagado por el mismo medio de pago. Iniciá el trámite desde el <a href="../arrepentimiento/">botón de arrepentimiento</a>.</p>
<h2>Cambios</h2>
<p>Podés cambiar un producto sin uso, con su embalaje y comprobante, dentro de los 30 días de la compra, en el local o coordinándolo con nosotros. [COMPLETAR con la política del negocio: plazo, talles, productos que no tienen cambio por higiene, como perfumes abiertos o ropa interior.]</p>
<h2>Productos con fallas: garantía legal</h2>
<p>Los productos nuevos tienen una garantía legal mínima de 6 meses desde la entrega por defectos de fabricación (art. 11 de la Ley 24.240). Si un producto falla, escribinos con una foto o video y el número de pedido: según el caso, lo reparamos, lo cambiamos por uno igual o te devolvemos el dinero. Los productos con garantía del fabricante se gestionan también según sus condiciones.</p>
<h2>Productos que llegaron dañados o incompletos</h2>
<p>Revisá el paquete al recibirlo. Si llegó dañado o falta algo, avisanos dentro de las 48 horas con fotos y lo resolvemos.</p>
"""),
"mayoristas": ("Condiciones para mayoristas y revendedores", f"""
<h2>1. Registro y aprobación</h2>
<p>Los precios mayoristas son para comercios y revendedores. Para acceder tenés que registrarte con los datos de tu negocio (incluido el CUIT). myluz revisa cada solicitud y puede aprobarla o rechazarla. Hasta que la cuenta esté aprobada, vas a ver los precios para público.</p>
<h2>2. Precios mayoristas</h2>
<p>El precio mayorista de cada cuenta puede ser distinto según las condiciones comerciales acordadas. Los precios pueden cambiar sin aviso; se respeta el vigente al confirmar el pedido. [COMPLETAR: si los precios mayoristas incluyen o no IVA.]</p>
<h2>3. Compra mínima</h2>
<p>Los pedidos mayoristas tienen un monto mínimo, que se informa en el carrito. [COMPLETAR: monto o cantidad mínima.]</p>
<h2>4. Uso de la cuenta</h2>
<p>La cuenta es personal del negocio registrado. No se pueden compartir el usuario ni los precios mayoristas con terceros. myluz puede suspender o dar de baja una cuenta si se usa en forma indebida o si los datos no son correctos.</p>
<h2>5. Compras para reventa</h2>
<p>Las compras hechas para revender o para integrar a tu actividad comercial no tienen derecho de arrepentimiento (Disposición 954/2025), pero sí garantía por defectos de fabricación.</p>
"""),
"arrepentimiento": ("Botón de arrepentimiento", f"""
<p>Si compraste como consumidor, podés revocar tu compra dentro de los 10 días corridos desde que recibiste el producto, sin dar explicaciones (art. 34 de la Ley 24.240, art. 1110 del Código Civil y Comercial y Resolución 424/2020 de la Secretaría de Comercio Interior).</p>
<form class="dlg tarjeta legal-form">
<label class="campo">Nombre y apellido<input name="nombre" required autocomplete="name"></label>
<label class="campo">Número de pedido<input name="pedido" required placeholder="Ej.: ML-12345"></label>
<label class="campo">Mail o WhatsApp de contacto<input name="contacto" required></label>
<button class="cta" type="submit" disabled title="Prototipo: el formulario no envía datos">Solicitar la revocación</button>
<p class="demo">Prototipo: en la tienda real este botón envía la solicitud y te llega un código de registro dentro de las 24 horas.</p>
</form>
<p>Dentro de las 24 horas de recibir tu solicitud te enviamos un código de registro. Te indicamos cómo devolver el producto (el costo corre por nuestra cuenta) y te reintegramos lo pagado por el mismo medio de pago.</p>
"""),
}

for slug, (titulo, cuerpo) in PAGINAS.items():
    d = OUT / slug; d.mkdir(parents=True, exist_ok=True)
    (d / "index.html").write_text(pagina(slug, titulo, cuerpo))
print("ok:", ", ".join(PAGINAS))
