import LegalLayout, { LegalSection } from '../components/LegalLayout'

export default function Privacidad() {
  return (
    <LegalLayout title="Aviso de Privacidad" updated="29 de julio de 2026">

      <LegalSection title="1. Responsable del tratamiento de tus datos">
        <p>
          GemaSystem ("nosotros") es responsable del tratamiento de los datos personales que recabamos a través de
          este sitio y de la Plataforma, de conformidad con la Ley Federal de Protección de Datos Personales
          en Posesión de los Particulares (LFPDPPP) y su Reglamento. Para cualquier duda sobre este aviso,
          puedes contactarnos en <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos personales que recabamos">
        <p>Recabamos los siguientes datos, según cómo interactúes con nosotros:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Datos de la cuenta del gimnasio:</strong> nombre del negocio, nombre de usuario, correo electrónico y contraseña (almacenada de forma cifrada).</li>
          <li><strong>Datos de contacto y facturación:</strong> nombre, teléfono, correo electrónico y datos de pago procesados directamente por Stripe (no almacenamos números de tarjeta en nuestros servidores).</li>
          <li><strong>Datos de uso:</strong> información técnica como dirección IP, tipo de navegador y actividad dentro de la Plataforma, con fines de seguridad y mejora del Servicio.</li>
          <li><strong>Datos de socios que tú registras:</strong> si usas GemaSystem para administrar tu gimnasio, tú (como responsable de esos datos) puedes ingresar información de tus socios (nombre, contacto, historial de pagos y asistencia). Eres responsable de contar con el consentimiento o base legal necesaria para registrar esos datos en la Plataforma.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalidades del tratamiento">
        <p>Utilizamos tus datos personales para las siguientes finalidades:</p>
        <p className="font-semibold text-gray-800">Finalidades primarias (necesarias para el Servicio):</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Crear y administrar tu cuenta.</li>
          <li>Procesar pagos y gestionar tu suscripción.</li>
          <li>Brindar soporte técnico y atención a solicitudes.</li>
          <li>Garantizar la seguridad y el funcionamiento correcto de la Plataforma.</li>
        </ul>
        <p className="font-semibold text-gray-800">Finalidades secundarias (puedes oponerte sin que esto afecte el Servicio):</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Enviarte comunicaciones sobre nuevas funciones, promociones o contenido relacionado con GemaSystem.</li>
          <li>Elaborar estadísticas internas para mejorar el producto.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Transferencia de datos">
        <p>
          Compartimos datos de pago con Stripe, Inc., nuestro procesador de pagos, únicamente para efectos
          de cobro de suscripciones. Stripe trata dichos datos conforme a su propio aviso de privacidad.
          No vendemos ni compartimos tus datos personales con terceros para fines de mercadotecnia ajenos
          a GemaSystem. Podremos transferir datos cuando sea requerido por autoridad competente conforme a la ley.
        </p>
      </LegalSection>

      <LegalSection title="5. Derechos ARCO">
        <p>
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos "ARCO") al tratamiento de tus
          datos personales, así como a revocar tu consentimiento en cualquier momento. Para ejercer estos
          derechos, envía tu solicitud a <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a> indicando:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Tu nombre completo y correo electrónico asociado a la cuenta.</li>
          <li>Una descripción clara del derecho que deseas ejercer.</li>
          <li>Cualquier documento que sustente tu solicitud, de ser aplicable.</li>
        </ul>
        <p>Responderemos tu solicitud dentro de los plazos que establece la LFPDPPP.</p>
      </LegalSection>

      <LegalSection title="6. Uso de cookies y tecnologías de rastreo">
        <p>
          Utilizamos cookies y tecnologías similares para mantener tu sesión iniciada, recordar tus
          preferencias y entender cómo se usa el sitio. Puedes configurar tu navegador para rechazar
          cookies, aunque esto podría limitar algunas funciones del Servicio.
        </p>
      </LegalSection>

      <LegalSection title="7. Seguridad de la información">
        <p>
          Implementamos medidas técnicas y administrativas razonables (incluyendo cifrado de contraseñas y
          conexiones seguras) para proteger tus datos personales contra daño, pérdida, alteración, acceso o
          tratamiento no autorizado. Ningún sistema es completamente infalible, por lo que no podemos
          garantizar seguridad absoluta.
        </p>
      </LegalSection>

      <LegalSection title="8. Cambios al aviso de privacidad">
        <p>
          Podemos actualizar este aviso de privacidad para reflejar cambios en nuestras prácticas o en la
          normativa aplicable. Publicaremos cualquier cambio en esta misma página, indicando la fecha de
          la última actualización.
        </p>
      </LegalSection>

      <LegalSection title="9. Contacto">
        <p>
          Si tienes dudas sobre este aviso de privacidad o sobre el tratamiento de tus datos, contáctanos en{' '}
          <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a>.
        </p>
      </LegalSection>

    </LegalLayout>
  )
}
