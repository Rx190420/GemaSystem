import LegalLayout, { LegalSection } from '../components/LegalLayout'

const TOC = [
  { id: 'aceptacion',    label: 'Aceptación de los términos' },
  { id: 'servicio',      label: 'Descripción del servicio' },
  { id: 'cuenta',        label: 'Registro de cuenta' },
  { id: 'planes',        label: 'Planes, precios y facturación' },
  { id: 'prueba',        label: 'Periodo de prueba gratuita' },
  { id: 'uso',           label: 'Uso aceptable' },
  { id: 'propiedad',     label: 'Propiedad intelectual' },
  { id: 'datos',         label: 'Datos y contenido del usuario' },
  { id: 'terceros',      label: 'Integraciones de terceros' },
  { id: 'disponibilidad',label: 'Disponibilidad y cambios' },
  { id: 'responsabilidad',label: 'Limitación de responsabilidad' },
  { id: 'terminacion',   label: 'Terminación de cuenta' },
  { id: 'modificaciones',label: 'Modificaciones a estos términos' },
  { id: 'jurisdiccion',  label: 'Ley aplicable' },
  { id: 'contacto',      label: 'Contacto' },
]

const SUMMARY = [
  'Sin permanencia mínima: cancela cuando quieras, sin penalización, y conserva acceso hasta el final del periodo ya pagado.',
  'Los datos de tu gimnasio y de tus socios siguen siendo tuyos — nosotros solo los operamos para prestarte el Servicio.',
  'Las cuentas nuevas eligen entre los planes Basic, Full o Custom (con extras a la carta); las cuentas ya existentes en planes anteriores conservan sus condiciones.',
  'Los pagos se procesan con Stripe y se renuevan automáticamente cada periodo salvo que canceles antes.',
  'Si activas integraciones opcionales como WhatsApp, eres responsable de usarlas conforme a las políticas del proveedor correspondiente.',
]

export default function Terminos() {
  return (
    <LegalLayout title="Términos y Condiciones de Uso" updated="31 de agosto de 2026" summary={SUMMARY} toc={TOC}>

      <LegalSection id="aceptacion" index={1} title="Aceptación de los términos">
        <p>
          Estos Términos y Condiciones ("Términos") regulan el acceso y uso de GemaSystem ("el Servicio", "la Plataforma"),
          un sistema de gestión para gimnasios operado como software como servicio (SaaS). Al crear una cuenta,
          iniciar una prueba gratuita o utilizar el Servicio de cualquier forma, aceptas quedar obligado por estos
          Términos y por nuestro <a href="/privacidad" className="text-indigo-600 hover:text-indigo-700 font-medium">Aviso de Privacidad</a>.
          Si no estás de acuerdo, no debes utilizar el Servicio.
        </p>
        <p>
          Si aceptas estos Términos en nombre de un gimnasio, negocio o entidad, declaras que cuentas con la
          autoridad necesaria para vincular a dicha entidad, y "tú" se referirá tanto a ti como a esa entidad.
        </p>
      </LegalSection>

      <LegalSection id="servicio" index={2} title="Descripción del servicio">
        <p>
          GemaSystem proporciona herramientas para la administración de gimnasios, entre ellas: control de
          socios, membresías, registro de visitas mediante código QR, finanzas y reportes, clases y horarios,
          venta e inventario de productos, notificaciones automáticas por correo y WhatsApp, e importación y
          exportación de datos. Qué funciones tienes disponibles depende del plan que hayas contratado.
        </p>
        <p>
          El Servicio se ofrece "tal cual" y "según disponibilidad", y puede evolucionar con el tiempo mediante
          la adición, modificación o eliminación de funciones.
        </p>
      </LegalSection>

      <LegalSection id="cuenta" index={3} title="Registro de cuenta">
        <p>
          Para usar GemaSystem debes crear una cuenta proporcionando información veraz, completa y actualizada
          (nombre del gimnasio, usuario, correo electrónico y contraseña). Eres responsable de mantener la
          confidencialidad de tus credenciales y de todas las actividades realizadas bajo tu cuenta, incluidas
          las de cualquier miembro de tu equipo a quien le des acceso.
          Notifícanos de inmediato a <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a> ante
          cualquier uso no autorizado.
        </p>
      </LegalSection>

      <LegalSection id="planes" index={4} title="Planes, precios y facturación">
        <p>
          Ofrecemos planes mensuales <strong>Basic</strong>, <strong>Full</strong> y <strong>Custom</strong> (este
          último con funciones adicionales que se agregan de forma individual, a tu elección). Los precios
          vigentes se muestran en el sitio y al momento de contratar, en pesos mexicanos (MXN), no incluyen IVA
          salvo que se indique lo contrario, y están sujetos a cambio con aviso previo a través del sitio o por
          correo electrónico. Las cuentas creadas bajo planes anteriores (semanal, mensual o anual) conservan
          las condiciones vigentes al momento de su contratación mientras no decidan cambiar de plan.
        </p>
        <p>
          Los pagos se procesan mediante Stripe, un proveedor externo de pagos; al pagar aceptas también los
          términos de Stripe aplicables al procesamiento de tu transacción. Las suscripciones se renuevan
          automáticamente al final de cada periodo salvo que se cancelen antes de la fecha de renovación.
        </p>
        <p>
          No hay contrato de permanencia mínima: puedes cancelar en cualquier momento desde el portal de
          facturación de Stripe o escribiendo a soporte@gemasystem.app, y conservarás acceso hasta el final del
          periodo ya pagado. Salvo que la ley aplicable exija lo contrario, no se realizan reembolsos por
          periodos ya iniciados.
        </p>
      </LegalSection>

      <LegalSection id="prueba" index={5} title="Periodo de prueba gratuita">
        <p>
          GemaSystem puede ofrecer un periodo de prueba gratuito (actualmente 10 días) sin necesidad de tarjeta
          de crédito. Al finalizar la prueba sin haber contratado un plan de pago, el acceso a las funciones
          del Servicio puede suspenderse, conservando tus datos conforme a lo indicado en el{' '}
          <a href="/privacidad" className="text-indigo-600 hover:text-indigo-700 font-medium">Aviso de Privacidad</a>.
        </p>
      </LegalSection>

      <LegalSection id="uso" index={6} title="Uso aceptable">
        <p>Al usar GemaSystem te comprometes a no:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Utilizar el Servicio para fines ilícitos o no autorizados.</li>
          <li>Intentar acceder sin autorización a cuentas, sistemas o redes relacionados con el Servicio.</li>
          <li>Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de la Plataforma.</li>
          <li>Sobrecargar, interferir o interrumpir la operación normal del Servicio (incluyendo ataques de denegación de servicio).</li>
          <li>Cargar contenido o datos de socios sin contar con el consentimiento o base legal correspondiente.</li>
          <li>Usar la integración de WhatsApp para enviar mensajes masivos no solicitados, contenido engañoso, o de cualquier forma que viole las políticas de uso de WhatsApp/Meta.</li>
        </ul>
      </LegalSection>

      <LegalSection id="propiedad" index={7} title="Propiedad intelectual">
        <p>
          El software, diseño, marca, logotipos y demás elementos de GemaSystem son propiedad de sus titulares
          y están protegidos por leyes de propiedad intelectual. Estos Términos no te otorgan ninguna
          titularidad sobre dichos elementos, únicamente una licencia limitada, no exclusiva e intransferible
          para usar el Servicio conforme a estos Términos.
        </p>
      </LegalSection>

      <LegalSection id="datos" index={8} title="Datos y contenido del usuario">
        <p>
          Conservas la titularidad de los datos que ingreses al Servicio (información de tu gimnasio, socios,
          pagos y demás registros). Nos otorgas una licencia limitada para almacenar, procesar y mostrar esa
          información únicamente con el fin de operar el Servicio para ti. Eres responsable de contar con las
          bases legales necesarias para tratar los datos personales de tus socios que registres en la
          Plataforma. Si tu plan incluye la función de exportación, puedes descargar tu información en
          cualquier momento mientras tu cuenta esté activa.
        </p>
      </LegalSection>

      <LegalSection id="terceros" index={9} title="Integraciones de terceros">
        <p>
          El Servicio se apoya en proveedores externos para operar ciertas funciones: Stripe para pagos, Resend
          para el envío de correos, y un proveedor de mensajería para la integración opcional de WhatsApp. El
          uso de estas funciones está sujeto también a los términos y políticas del proveedor correspondiente.
        </p>
        <p>
          En particular, la integración de WhatsApp funciona vinculando tu propio número de WhatsApp a la
          Plataforma. Eres responsable de que ese número y su uso cumplan con las políticas de WhatsApp/Meta;
          GemaSystem no controla ni garantiza la disponibilidad continua de esa integración, ya que depende de
          un servicio de un tercero ajeno a nosotros.
        </p>
      </LegalSection>

      <LegalSection id="disponibilidad" index={10} title="Disponibilidad y modificaciones del servicio">
        <p>
          Procuramos que el Servicio esté disponible de forma continua, pero no garantizamos disponibilidad
          ininterrumpida o libre de errores. Podemos suspender temporalmente el acceso por mantenimiento,
          actualizaciones o causas de fuerza mayor. Podemos modificar o descontinuar funciones del Servicio,
          procurando avisar con antelación razonable cuando el cambio sea significativo.
        </p>
      </LegalSection>

      <LegalSection id="responsabilidad" index={11} title="Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley aplicable, GemaSystem no será responsable por daños indirectos,
          incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso del Servicio,
          incluyendo pérdida de datos, ingresos o ganancias. El Servicio se proporciona "tal cual", sin
          garantías de ningún tipo, expresas o implícitas.
        </p>
        <p>
          En cualquier caso, nuestra responsabilidad total frente a ti por reclamos relacionados con el
          Servicio se limita al monto que hayas pagado por el Servicio durante los tres meses previos al
          evento que dio origen al reclamo.
        </p>
      </LegalSection>

      <LegalSection id="terminacion" index={12} title="Terminación de cuenta">
        <p>
          Podemos suspender o cancelar tu acceso al Servicio si incumples estos Términos, si tu suscripción
          permanece impaga después de los avisos correspondientes, o por requerimiento legal. Puedes cancelar
          tu cuenta en cualquier momento; tras la cancelación, tus datos se conservarán durante un periodo
          razonable conforme al Aviso de Privacidad antes de su eliminación definitiva.
        </p>
      </LegalSection>

      <LegalSection id="modificaciones" index={13} title="Modificaciones a estos términos">
        <p>
          Podemos actualizar estos Términos periódicamente. Publicaremos la versión vigente en esta misma
          página indicando la fecha de última actualización. El uso continuado del Servicio después de una
          modificación implica tu aceptación de los Términos actualizados.
        </p>
      </LegalSection>

      <LegalSection id="jurisdiccion" index={14} title="Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
          relacionada con el Servicio se someterá a los tribunales competentes, renunciando a cualquier otro
          fuero que pudiera corresponder por razón de domicilio presente o futuro.
        </p>
      </LegalSection>

      <LegalSection id="contacto" index={15} title="Contacto">
        <p>
          Para preguntas sobre estos Términos, escríbenos a{' '}
          <a href="mailto:soporte@gemasystem.app" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.app</a>.
        </p>
      </LegalSection>

    </LegalLayout>
  )
}
