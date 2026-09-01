import LegalLayout, { LegalSection } from '../components/LegalLayout'

const TOC = [
  { id: 'responsable',    label: 'Responsable del tratamiento' },
  { id: 'datos',          label: 'Datos que recabamos' },
  { id: 'finalidades',    label: 'Para qué los usamos' },
  { id: 'terceros',       label: 'Con quién los compartimos' },
  { id: 'conservacion',   label: 'Cuánto tiempo los conservamos' },
  { id: 'arco',           label: 'Tus derechos ARCO' },
  { id: 'cookies',        label: 'Cookies y rastreo' },
  { id: 'seguridad',      label: 'Cómo los protegemos' },
  { id: 'internacional',  label: 'Transferencias internacionales' },
  { id: 'menores',        label: 'Menores de edad' },
  { id: 'cambios',        label: 'Cambios a este aviso' },
  { id: 'contacto',       label: 'Contacto' },
]

const SUMMARY = [
  'Solo recabamos los datos que necesitamos para operar tu cuenta y ayudarte a administrar tu gimnasio — nada más.',
  'Nunca vendemos tus datos, ni los de tus socios, a nadie. No compartimos con terceros para fines de mercadotecnia ajenos a GemaSystem.',
  'Tus pagos los procesa Stripe directamente: nosotros nunca vemos ni almacenamos el número de tu tarjeta.',
  'Si activas la integración de WhatsApp, los teléfonos de tus socios se usan únicamente para los mensajes automáticos que tú configures.',
  'Tú sigues siendo responsable de los datos de tus socios que registras en la Plataforma — nosotros solo los alojamos y procesamos por ti.',
]

export default function Privacidad() {
  return (
    <LegalLayout title="Aviso de Privacidad" updated="31 de agosto de 2026" summary={SUMMARY} toc={TOC}>

      <LegalSection id="responsable" index={1} title="Responsable del tratamiento de tus datos">
        <p>
          GemaSystem ("nosotros", "la Plataforma") es responsable del tratamiento de los datos personales que
          recabamos a través de este sitio y del Servicio, de conformidad con la Ley Federal de Protección de
          Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento. Este aviso aplica tanto a
          quienes visitan el sitio público como a los gimnasios que usan la Plataforma para administrar su
          negocio y a las personas cuyos datos esos gimnasios registran en ella.
        </p>
        <p>
          Para cualquier duda sobre este aviso, puedes contactarnos en{' '}
          <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a>.
        </p>
      </LegalSection>

      <LegalSection id="datos" index={2} title="Datos personales que recabamos">
        <p>Qué recabamos depende de cómo interactúas con nosotros:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Datos de la cuenta y del negocio:</strong> nombre del gimnasio, descripción, dirección, teléfono y correo de contacto del negocio, moneda y zona horaria de operación.</li>
          <li><strong>Datos de los usuarios del sistema:</strong> nombre de usuario, correo electrónico y contraseña (siempre almacenada de forma cifrada, nunca en texto plano). Si activas el código de acceso adicional (autenticación en dos pasos vía app tipo Google Authenticator), guardamos únicamente la clave secreta necesaria para validarlo, no los códigos que genera.</li>
          <li><strong>Datos de facturación:</strong> nombre y correo asociados al pago, y datos de la tarjeta procesados directamente por Stripe — nunca tocan nuestros servidores ni los almacenamos.</li>
          <li><strong>Datos de uso técnico:</strong> dirección IP, tipo y versión de navegador, dispositivo, páginas visitadas y acciones dentro de la Plataforma, con fines de seguridad, soporte y mejora del Servicio.</li>
          <li>
            <strong>Datos de socios que tú registras:</strong> si usas GemaSystem para administrar tu gimnasio, tú
            (como responsable de esos datos) puedes ingresar información de tus socios — nombre, contacto,
            fecha de nacimiento (si activas felicitaciones automáticas de cumpleaños), historial de pagos,
            membresías y asistencia. Eres responsable de contar con el consentimiento o base legal necesaria
            para registrar esos datos en la Plataforma; nosotros actuamos como encargados del tratamiento
            sobre esa información, no como responsables.
          </li>
          <li><strong>Datos de mensajería (opcional):</strong> si tu gimnasio activa la integración de WhatsApp, usamos los números de teléfono de tus socios únicamente para enviarles los mensajes automáticos que configures (bienvenida, recordatorios de vencimiento, felicitaciones de cumpleaños). No usamos esos números para ningún otro fin.</li>
        </ul>
      </LegalSection>

      <LegalSection id="finalidades" index={3} title="Finalidades del tratamiento">
        <p>Utilizamos tus datos personales para las siguientes finalidades:</p>
        <p className="font-semibold text-gray-800">Finalidades primarias (necesarias para el Servicio):</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Crear, administrar y asegurar el acceso a tu cuenta.</li>
          <li>Procesar pagos y gestionar tu suscripción y sus renovaciones.</li>
          <li>Operar las funciones que actives (envío de correos y mensajes de WhatsApp automáticos, alertas de vencimiento y de stock, generación de reportes).</li>
          <li>Brindar soporte técnico y dar seguimiento a solicitudes.</li>
          <li>Detectar y prevenir fraude, abuso o uso indebido de la Plataforma.</li>
        </ul>
        <p className="font-semibold text-gray-800">Finalidades secundarias (puedes oponerte sin que esto afecte el Servicio):</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Enviarte comunicaciones sobre nuevas funciones, promociones o contenido relacionado con GemaSystem.</li>
          <li>Elaborar estadísticas internas, agregadas y no identificables, para mejorar el producto.</li>
        </ul>
      </LegalSection>

      <LegalSection id="terceros" index={4} title="Con quién compartimos tus datos">
        <p>Compartimos datos personales únicamente con proveedores que necesitamos para operar el Servicio, y solo en la medida necesaria para ese fin:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Stripe, Inc.</strong> — procesa tus pagos y datos de facturación. Stripe trata esa información conforme a su propio aviso de privacidad.</li>
          <li><strong>Resend</strong> — envía en nuestro nombre los correos transaccionales de la Plataforma (bienvenida, recuperación de contraseña, recibos, recordatorios).</li>
          <li><strong>Proveedor de mensajería de WhatsApp</strong> — solo si tú activas esa integración, para entregar los mensajes automáticos que configures a tus socios.</li>
          <li><strong>Proveedores de hosting e infraestructura en la nube</strong> — alojan los servidores y bases de datos donde vive la Plataforma.</li>
        </ul>
        <p>
          Estos proveedores solo pueden usar tus datos para prestarnos el servicio contratado, no para fines
          propios. No vendemos ni compartimos tus datos personales con terceros para fines de mercadotecnia
          ajenos a GemaSystem. Podremos divulgar datos cuando lo requiera una autoridad competente conforme a la ley.
        </p>
      </LegalSection>

      <LegalSection id="conservacion" index={5} title="Cuánto tiempo conservamos tus datos">
        <p>
          Conservamos tus datos mientras tu cuenta permanezca activa. Si cancelas tu suscripción o tu periodo de
          prueba termina sin convertirse en cuenta de pago, conservamos tus datos por un periodo razonable —
          para que puedas reactivar tu cuenta sin perder tu información — antes de eliminarlos o anonimizarlos.
          Podemos conservar cierta información por más tiempo cuando la ley aplicable lo exija (por ejemplo,
          registros de pagos con fines fiscales o contables).
        </p>
      </LegalSection>

      <LegalSection id="arco" index={6} title="Tus derechos ARCO">
        <p>
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (derechos "ARCO") al tratamiento de tus
          datos personales, así como a revocar tu consentimiento en cualquier momento. Para ejercer estos
          derechos, envía tu solicitud a{' '}
          <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a> indicando:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Tu nombre completo y correo electrónico asociado a la cuenta.</li>
          <li>Una descripción clara del derecho que deseas ejercer.</li>
          <li>Cualquier documento que sustente tu solicitud, de ser aplicable.</li>
        </ul>
        <p>
          Confirmaremos la recepción de tu solicitud y te daremos respuesta dentro de los 20 días hábiles que
          establece la LFPDPPP, haciéndola efectiva, de proceder, dentro de los 15 días hábiles siguientes.
        </p>
      </LegalSection>

      <LegalSection id="cookies" index={7} title="Uso de cookies y tecnologías de rastreo">
        <p>Usamos únicamente las cookies necesarias para operar la Plataforma:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Esenciales:</strong> mantienen tu sesión iniciada y protegen el acceso a tu cuenta. Sin ellas no puedes usar el Servicio.</li>
          <li><strong>De preferencia:</strong> recuerdan configuraciones como el tema de color de tu gimnasio.</li>
        </ul>
        <p>
          No usamos cookies de publicidad ni de rastreo de terceros. Puedes configurar tu navegador para
          rechazar cookies, aunque esto podría impedir que algunas funciones del Servicio funcionen correctamente.
        </p>
      </LegalSection>

      <LegalSection id="seguridad" index={8} title="Cómo protegemos tu información">
        <p>Implementamos medidas técnicas y administrativas razonables para proteger tus datos, entre ellas:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Conexiones cifradas (HTTPS/TLS) en todo el sitio y la Plataforma.</li>
          <li>Contraseñas almacenadas con algoritmos de cifrado unidireccional, nunca en texto plano.</li>
          <li>Aislamiento de datos por gimnasio: las cuentas de pago operan sobre una base de datos dedicada, independiente de la de otros gimnasios.</li>
          <li>Autenticación en dos pasos disponible para el acceso administrativo.</li>
        </ul>
        <p>
          Ningún sistema es completamente infalible, por lo que no podemos garantizar seguridad absoluta.
          Si detectamos un incidente que comprometa tus datos, te lo notificaremos conforme a lo que exige la ley aplicable.
        </p>
      </LegalSection>

      <LegalSection id="internacional" index={9} title="Transferencias internacionales">
        <p>
          Algunos de nuestros proveedores (por ejemplo, Stripe y Resend) procesan datos fuera de México. En esos
          casos nos aseguramos de que el tratamiento se realice bajo condiciones de confidencialidad y
          protección de datos comparables a las exigidas por la LFPDPPP, ya sea mediante cláusulas contractuales
          o los mecanismos de cumplimiento propios de cada proveedor.
        </p>
      </LegalSection>

      <LegalSection id="menores" index={10} title="Menores de edad">
        <p>
          El Servicio está dirigido a negocios y a personas mayores de edad que los administran. Si un gimnasio
          registra en la Plataforma a un socio menor de edad (por ejemplo, en una membresía familiar), es
          responsabilidad de ese gimnasio contar con el consentimiento de madre, padre o tutor legal para
          hacerlo, conforme a la ley aplicable.
        </p>
      </LegalSection>

      <LegalSection id="cambios" index={11} title="Cambios a este aviso de privacidad">
        <p>
          Podemos actualizar este aviso para reflejar cambios en nuestras prácticas, en las funciones del
          Servicio o en la normativa aplicable. Publicaremos cualquier cambio en esta misma página, indicando
          la fecha de la última actualización en la parte superior.
        </p>
      </LegalSection>

      <LegalSection id="contacto" index={12} title="Contacto">
        <p>
          Si tienes dudas sobre este aviso de privacidad o sobre el tratamiento de tus datos, contáctanos en{' '}
          <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a>.
        </p>
      </LegalSection>

    </LegalLayout>
  )
}
