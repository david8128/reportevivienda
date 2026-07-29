# language: es
Característica: Recuperación de propiedades desde el historial de Chrome
  Como usuario de ReporteVivienda
  Quiero restaurar anuncios eliminados de la base local que aún estén en mi historial
  Para no perder propiedades que ya había visitado.

  Antecedentes:
    Dado que tengo la extensión instalada y permisos de historial activos
    Y que el historial contiene URLs de detalle de FincaRaiz o MetroCuadrado

  Escenario: Restaurar solo propiedades eliminadas de la base local
    Dado que una URL de detalle existe en el historial
    Y que esa URL no existe en IndexedDB
    Cuando selecciono "Recuperar propiedades eliminadas" en el dashboard
    Entonces la extensión vuelve a solicitar la página usando la sesión activa del navegador
    Y extrae el anuncio completo mediante el extractor correspondiente
    Y guarda el nuevo registro en IndexedDB con su puntuación actual
    Y el resultado informa una propiedad restaurada

  Escenario: No sobrescribir registros existentes
    Dado que una URL de detalle existe tanto en el historial como en IndexedDB
    Cuando ejecuto la recuperación desde el historial
    Entonces la URL no se vuelve a descargar
    Y el registro existente conserva sus confirmaciones manuales y demás datos

  Escenario: No duplicar una propiedad por variaciones de URL
    Dado que una propiedad se visitó con parámetros de seguimiento o fragmentos en la URL
    Y que la misma propiedad ya existe en IndexedDB con su URL canónica
    Cuando ejecuto la recuperación o la recolección desde el historial
    Entonces la URL se normaliza antes de compararla o encolarla
    Y no se crea un segundo registro de la misma propiedad

  Escenario: No aceptar una respuesta de sesión inválida como propiedad recuperada
    Dado que una URL del historial devuelve una página de acceso denegado, CAPTCHA o sin datos del anuncio
    Cuando la extensión intenta recuperarla
    Entonces no crea un registro incompleto en IndexedDB
    Y la cuenta como no disponible con el motivo de fallo

  Escenario: Informar el resultado de la recuperación
    Dado que hay propiedades eliminadas recuperables y no disponibles
    Cuando termina la recuperación
    Entonces el dashboard muestra cuántas URLs faltantes encontró
    Y muestra cuántas propiedades restauró
    Y muestra cuántas no pudo restaurar
    Y muestra un resumen de los motivos de fallo cuando existen

  Escenario: Recuperar una URL que ya fue procesada por la cola histórica
    Dado que una URL fue marcada como "ya procesada" en la cola anterior
    Y que su registro fue eliminado de IndexedDB
    Cuando ejecuto la recuperación desde el historial
    Entonces la extensión evita la cola histórica anterior
    Y recupera directamente el anuncio si sigue disponible
