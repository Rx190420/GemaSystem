# Vista previa de correos

`gallery.html` es una instantánea estática de las 13 plantillas de correo
(`backend/resources/views/emails/*.blade.php`) renderizadas con datos de
prueba, para revisar el diseño sin tener que disparar correos reales.

Ábrelo directamente en el navegador (doble clic o `file://.../gallery.html`)
— las imágenes (logo, iconos, QR) están incrustadas como base64, así que
funciona sin conexión y sin depender del servidor local.

**No se regenera solo.** Si cambias algo en `_layout.blade.php` o en alguna
plantilla, este archivo se queda desactualizado hasta que se vuelva a
generar a mano (renderizar cada vista con `view('emails.xxx', [...])->render()`
y reconstruir el HTML).
