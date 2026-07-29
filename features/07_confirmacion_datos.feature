# language: es
Característica: Confirmación interactiva de datos ambiguos
  Como usuario de la extensión
  Quiero que la extensión me solicite confirmar o corregir los datos
  que no pudo extraer con certeza de los anuncios
  Para mantener la calidad de los datos y obtener puntuaciones precisas

  Antecedentes:
    Dado que el scraper ha procesado una propiedad
    Y que existen campos marcados como "estimado - requiere confirmación"

  Escenario: Panel flotante de confirmación al visitar una propiedad en vivo
    Dado que el content script detecta campos sin confirmar en una página abierta
    Cuando la página termina de cargar completamente
    Entonces aparece un panel flotante en la esquina inferior derecha de la página
    Y el panel tiene título "ReporteVivienda - Confirmar datos ⚠"
    Y lista los campos a confirmar con controles intuitivos
    Y el panel es arrastrable y no bloquea el contenido principal
    Y tiene un botón "Cerrar" que lo oculta temporalmente
    Y tiene un botón "Recordar más tarde" que lo pospone 24 horas

  Escenario: Confirmación del campo "bueno para vivir y arrendar"
    Dado que el campo "bueno_vivir_arrendar" está sin confirmar
    Cuando se muestra el panel de confirmación
    Entonces aparece la pregunta:
      "¿Considera que esta propiedad es viable para vivir y arrendar una parte simultáneamente?"
    Y tiene tres opciones: "Sí ✓", "No ✗", "No sé ?"
    Y si selecciona "Sí" se guarda el valor "confirmado_si" y suma 20 puntos
    Y si selecciona "No" se guarda el valor "confirmado_no" y no suma puntos
    Y si selecciona "No sé" permanece como "sin_confirmar" sin cambio en puntuación

  Escenario: Confirmación del campo "posibilidad de dividir"
    Dado que el campo "posible_dividir" está sin confirmar
    Cuando se muestra el panel de confirmación
    Entonces aparece la pregunta:
      "¿Sería posible dividir esta propiedad en dos o más unidades independientes?"
    Y el panel muestra los metros cuadrados del inmueble como referencia
    Y tiene tres opciones: "Sí ✓", "No ✗", "No sé ?"

  Escenario: Confirmación del campo "buena ubicación"
    Dado que el campo "buena_ubicacion" está sin confirmar
    Cuando se muestra el panel de confirmación
    Entonces aparece la pregunta:
      "Según la ubicación mostrada, ¿considera que es una buena localización?"
    Y el panel muestra el texto de ubicación extraído y la miniatura del mapa
    Y tiene tres opciones: "Sí ✓", "No ✗", "No sé ?"

  Escenario: Corrección de un campo estimado incorrecto
    Dado que el estrato fue estimado en "3" desde la descripción
    Cuando el usuario ve el panel de confirmación
    Entonces ve el campo "Estrato: 3 (estimado)"
    Y puede editar el valor directamente en un campo de entrada numérica
    Y al confirmar con el nuevo valor, el campo queda como "confirmado: 4"
    Y la puntuación se recalcula con el nuevo estrato

  Escenario: Confirmación masiva desde el dashboard
    Dado que hay 15 propiedades con campos sin confirmar en la base de datos
    Cuando el usuario accede a la pestaña "Pendientes de confirmación" en el dashboard
    Entonces ve una lista de todas las propiedades con sus campos pendientes
    Y puede responder los campos directamente en la tabla del dashboard
    Y un botón "Confirmar todos como No sé" permite resolver masivamente las pendientes

  Escenario: Notificación de badge por confirmaciones pendientes
    Dado que hay propiedades con campos sin confirmar
    Cuando el usuario abre el navegador
    Entonces el badge del ícono de la extensión muestra el número de confirmaciones pendientes
    Y el badge es de color amarillo para indicar "atención requerida"
    Y al hacer clic en el ícono abre el popup con el resumen de pendientes

  Escenario: Confirmación de piso estimado
    Dado que el piso fue extraído de la descripción como "piso 3 (estimado)"
    Cuando el usuario ve el panel de confirmación
    Entonces ve: "Piso: 3 (extraído de la descripción, no confirmado)"
    Y puede confirmar que el valor es correcto o corregirlo
    Y si el piso confirmado es ≤ 2 se aplica la puntuación correspondiente
    Y si el piso confirmado es > 2 no se aplica esa puntuación

  Escenario: Historial de confirmaciones realizadas
    Dado que el usuario ha confirmado múltiples campos a lo largo del tiempo
    Cuando accede a la sección "Historial" del dashboard
    Entonces ve un registro de todas las confirmaciones con fecha, campo y valor confirmado
    Y puede revertir una confirmación incorrecta haciendo clic en "Deshacer"
