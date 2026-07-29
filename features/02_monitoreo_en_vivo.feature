# language: es
Característica: Monitoreo en vivo de pestañas abiertas
  Como usuario de la extensión
  Quiero que la extensión capture automáticamente información de propiedades
  cuando abro o visito páginas de fincaraiz.com o metrocuadrado.com
  Para mantener la base de datos actualizada en tiempo real sin acción manual

  Antecedentes:
    Dado que la extensión está instalada y activa
    Y que el monitoreo en vivo está habilitado en la configuración
    Y que el content script está inyectado en las páginas de los sitios objetivo

  Escenario: Captura automática al abrir una nueva pestaña de FincaRaiz
    Dado que el usuario abre una nueva pestaña
    Cuando el URL de la pestaña corresponde a una página de detalle de propiedad en fincaraiz.com
    Entonces el content script se activa automáticamente en esa página
    Y espera a que la página termine de cargar completamente (incluyendo mapa)
    Y extrae todos los campos de la propiedad según el mapeo definido
    Y envía los datos al service worker para almacenamiento
    Y muestra un indicador visual sutil "✓ Guardado" en la esquina de la página

  Escenario: Captura automática al abrir una nueva pestaña de MetroCuadrado
    Dado que el usuario abre una nueva pestaña con metrocuadrado.com
    Cuando el URL corresponde a una página de detalle de propiedad
    Entonces el content script extrae los datos usando el mapeo de MetroCuadrado
    Y envía los datos al service worker para almacenamiento

  Escenario: Captura de pantalla del mapa al monitorear en vivo
    Dado que el content script está activo en una página de propiedad
    Cuando el mapa de ubicación está completamente renderizado en el DOM
    Entonces el script espera a que el mapa sea visible (máximo 5 segundos)
    Y captura la región del mapa como imagen base64
    Y adjunta la imagen al registro de la propiedad en la base de datos

  Escenario: Actualización de registro existente al revisitar una propiedad
    Dado que una propiedad ya existe en la base de datos
    Cuando el usuario vuelve a visitar esa misma página de propiedad
    Entonces la extensión detecta que ya existe un registro con ese URL
    Y actualiza únicamente los campos que hayan cambiado (ej. precio nuevo)
    Y registra el historial de cambios de precio con fecha y hora
    Y notifica al usuario con un badge "↓ Precio actualizado" si el precio bajó

  Escenario: Pausa del monitoreo en vivo
    Dado que el monitoreo en vivo está activo
    Cuando el usuario desactiva la opción "Monitoreo en vivo" en el popup
    Entonces el service worker deja de escuchar eventos de pestaña
    Y el content script ya no envía datos nuevos
    Y el ícono de la extensión cambia a estado "pausado"

  Escenario: Solicitud de confirmación para campos ambiguos detectados en vivo
    Dado que el content script detecta campos marcados como "estimado"
    Cuando termina de extraer los datos de una página en vivo
    Entonces muestra un panel flotante no intrusivo con los campos a confirmar
    Y el panel incluye preguntas como:
      | Campo                              | Pregunta                                          |
      | Bueno para vivir y arrendar        | ¿Es viable vivir y arrendar parte de esta propiedad? |
      | Posibilidad de dividir             | ¿Se podría dividir en dos o más unidades?         |
      | Buena ubicación                    | ¿Considera que la ubicación es buena?             |
    Y el usuario puede responder Sí/No/No sé desde el panel
    Y las respuestas se guardan en la base de datos junto al registro
