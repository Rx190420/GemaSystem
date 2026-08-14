import LegalLayout, { LegalSection } from '../components/LegalLayout'

export default function Terminos() {
  return (
    <LegalLayout title="Términos y Condiciones de Uso" updated="29 de julio de 2026">

      <LegalSection title="1. Aceptación de los términos">
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

      <LegalSection title="2. Descripción del servicio">
        <p>
          GemaSystem proporciona herramientas para la administración de gimnasios: control de socios, membresías,
          registro de visitas, finanzas, clases, reportes y funciones relacionadas. El Servicio se ofrece
          "tal cual" y "según disponibilidad", y puede evolucionar con el tiempo mediante la adición,
          modificación o eliminación de funciones.
        </p>
      </LegalSection>

      <LegalSection title="3. Registro de cuenta">
        <p>
          Para usar GemaSystem debes crear una cuenta proporcionando información veraz, completa y actualizada
          (nombre del gimnasio, usuario, correo electrónico y contraseña). Eres responsable de mantener la
          confidencialidad de tus credenciales y de todas las actividades realizadas bajo tu cuenta.
          Notifícanos de inmediato a <a href="mailto:soporte@gemasystem.mx" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.mx</a> ante
          cualquier uso no autorizado.
        </p>
      </LegalSection>

      <LegalSection title="4. Planes, precios y facturación">
        <p>
          Los precios de los planes (semanal, mensual y sus variantes) se muestran en pesos mexicanos (MXN),
          no incluyen IVA salvo que se indique lo contrario, y están sujetos a cambio con aviso previo a
          través del sitio o por correo electrónico. Los pagos se procesan mediante Stripe, un proveedor
          externo de pagos; al pagar aceptas también los términos de Stripe aplicables al procesamiento de
          tu transacción.
        </p>
        <p>
          Las suscripciones se renuevan automáticamente al final de cada periodo (semanal o mensual) salvo
          que se cancelen antes de la fecha de renovación. No hay contrato de permanencia mínima: puedes
          cancelar en cualquier momento desde el portal de facturación de Stripe o escribiendo a
          soporte@gemasystem.mx, y conservarás acceso hasta el final del periodo ya pagado.
        </p>
      </LegalSection>

      <LegalSection title="5. Periodo de prueba gratuita">
        <p>
          GemaSystem puede ofrecer un periodo de prueba gratuito (actualmente 10 días) sin necesidad de tarjeta
          de crédito. Al finalizar la prueba sin haber contratado un plan de pago, el acceso a las funciones
          del Servicio puede suspenderse, conservando tus datos conforme a lo indicado en el
          <a href="/privacidad" className="text-indigo-600 hover:text-indigo-700 font-medium"> Aviso de Privacidad</a>.
        </p>
      </LegalSection>

      <LegalSection title="6. Uso aceptable">
        <p>Al usar GemaSystem te comprometes a no:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Utilizar el Servicio para fines ilícitos o no autorizados.</li>
          <li>Intentar acceder sin autorización a cuentas, sistemas o redes relacionados con el Servicio.</li>
          <li>Realizar ingeniería inversa, descompilar o intentar extraer el código fuente de la Plataforma.</li>
          <li>Sobrecargar, interferir o interrumpir la operación normal del Servicio (incluyendo ataques de denegación de servicio).</li>
          <li>Cargar contenido o datos de socios sin contar con el consentimiento o base legal correspondiente.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Propiedad intelectual">
        <p>
          El software, diseño, marca, logotipos y demás elementos de GemaSystem son propiedad de sus titulares
          y están protegidos por leyes de propiedad intelectual. Estos Términos no te otorgan ninguna
          titularidad sobre dichos elementos, únicamente una licencia limitada, no exclusiva e intransferible
          para usar el Servicio conforme a estos Términos.
        </p>
      </LegalSection>

      <LegalSection title="8. Datos y contenido del usuario">
        <p>
          Conservas la titularidad de los datos que ingreses al Servicio (información de tu gimnasio, socios,
          pagos y demás registros). Nos otorgas una licencia limitada para almacenar, procesar y mostrar esa
          información únicamente con el fin de operar el Servicio para ti. Eres responsable de contar con las
          bases legales necesarias para tratar los datos personales de tus socios que registres en la Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="9. Disponibilidad y modificaciones del servicio">
        <p>
          Procuramos que el Servicio esté disponible de forma continua, pero no garantizamos disponibilidad
          ininterrumpida o libre de errores. Podemos suspender temporalmente el acceso por mantenimiento,
          actualizaciones o causas de fuerza mayor. Podemos modificar o descontinuar funciones del Servicio,
          procurando avisar con antelación razonable cuando el cambio sea significativo.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitación de responsabilidad">
        <p>
          En la máxima medida permitida por la ley aplicable, GemaSystem no será responsable por daños indirectos,
          incidentales, especiales o consecuentes derivados del uso o la imposibilidad de uso del Servicio,
          incluyendo pérdida de datos, ingresos o ganancias. El Servicio se proporciona "tal cual", sin
          garantías de ningún tipo, expresas o implícitas.
        </p>
      </LegalSection>

      <LegalSection title="11. Terminación de cuenta">
        <p>
          Podemos suspender o cancelar tu acceso al Servicio si incumples estos Términos, si tu suscripción
          permanece impaga después de los avisos correspondientes, o por requerimiento legal. Puedes cancelar
          tu cuenta en cualquier momento; tras la cancelación, tus datos se conservarán durante un periodo
          razonable conforme al Aviso de Privacidad antes de su eliminación definitiva.
        </p>
      </LegalSection>

      <LegalSection title="12. Modificaciones a estos términos">
        <p>
          Podemos actualizar estos Términos periódicamente. Publicaremos la versión vigente en esta misma
          página indicando la fecha de última actualización. El uso continuado del Servicio después de una
          modificación implica tu aceptación de los Términos actualizados.
        </p>
      </LegalSection>

      <LegalSection title="13. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia
          relacionada con el Servicio se someterá a los tribunales competentes, renunciando a cualquier otro
          fuero que pudiera corresponder por razón de domicilio presente o futuro.
        </p>
      </LegalSection>

      <LegalSection title="14. Contacto">
        <p>
          Para preguntas sobre estos Términos, escríbenos a{' '}
          <a href="mailto:soporte@gemasystem.mx" className="text-indigo-600 hover:text-indigo-700 font-medium">soporte@gemasystem.mx</a>.
        </p>
      </LegalSection>

    </LegalLayout>
  )
}
