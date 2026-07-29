# language: es
Característica: Generación de reporte PDF
  Como usuario de la extensión
  Quiero generar un reporte PDF con las mejores propiedades según mi puntuación
  Para tener un documento imprimible y compartible con los datos más relevantes

  Antecedentes:
    Dado que la base de datos contiene al menos una propiedad con datos completos
    Y que la librería jsPDF está cargada en el contexto de la extensión

  Escenario: Generar reporte PDF desde el dashboard
    Dado que el usuario ha aplicado sus filtros de búsqueda
    Cuando hace clic en el botón "Generar Reporte PDF"
    Entonces se genera un archivo PDF con nombre "reporte_propiedades_YYYY-MM-DD.pdf"
    Y el archivo se descarga automáticamente al equipo del usuario
    Y el PDF incluye únicamente las propiedades que cumplen los filtros activos
    Y las propiedades están ordenadas por puntuación de mayor a menor

  Escenario: Contenido de la página de portada del PDF
    Dado que se está generando un reporte PDF
    Cuando se crea la primera página del documento
    Entonces incluye:
      | Elemento               | Contenido                              |
      | Título                 | Reporte de Propiedades - ReporteVivienda|
      | Fecha de generación    | 28 de julio de 2026                   |
      | Total de propiedades   | "X propiedades encontradas"           |
      | Filtros aplicados      | Lista de filtros activos              |
      | Logo/ícono             | Ícono de la extensión                 |

  Escenario: Ficha individual de propiedad en el PDF
    Dado que el reporte incluye una propiedad con todos sus datos
    Cuando se genera la ficha de esa propiedad
    Entonces la ficha contiene:
      | Sección          | Campos                                          |
      | Encabezado       | Puntuación (destacada), tipo, origen           |
      | Precio           | Valor total, precio por m², administración     |
      | Características  | M², estrato, piso, parqueadero, ascensor       |
      | Conjunto         | Sí/No, conjunto cerrado                        |
      | Evaluación       | Viable vivir+arrendar, dividir, ubicación      |
      | Contacto         | Teléfonos del anuncio                          |
      | Mapa             | Imagen capturada del mapa (si está disponible) |
      | URL              | Enlace al anuncio original                     |
      | Advertencias     | Campos estimados o sin confirmar               |

  Escenario: Inclusión del mapa de ubicación en el PDF
    Dado que una propiedad tiene una imagen del mapa capturada
    Cuando se genera la ficha de esa propiedad en el PDF
    Entonces la imagen del mapa aparece en la sección de ubicación
    Y tiene dimensiones aproximadas de 8x5 cm dentro del PDF
    Y va acompañada del texto de ubicación (barrio, ciudad)

  Escenario: Propiedad con campos sin confirmar en el PDF
    Dado que una propiedad tiene campos marcados como "estimado"
    Cuando se incluye esa propiedad en el PDF
    Entonces los campos estimados aparecen con un asterisco (*)
    Y al pie de la ficha hay una nota: "* Valor estimado de la descripción, sin confirmar"
    Y los campos sin respuesta aparecen como "Sin confirmar ⚠"

  Escenario: Resumen ejecutivo al final del PDF
    Dado que el reporte contiene múltiples propiedades
    Cuando se genera la última sección del PDF
    Entonces incluye una tabla resumen comparativa con:
      | Columna         |
      | Posición        |
      | Dirección       |
      | Precio          |
      | M²              |
      | Puntuación      |
      | Teléfono        |
    Y un gráfico de barras simple con las puntuaciones de las top 10

  Escenario: Reporte de solo las top N propiedades
    Dado que la base de datos tiene 80 propiedades que cumplen los filtros
    Cuando el usuario selecciona "Generar reporte de las mejores 10"
    Entonces el PDF contiene únicamente las 10 propiedades con mayor puntuación
    Y en la portada indica "Top 10 de 80 propiedades"

  Escenario: Reporte con propiedad sin teléfono registrado
    Dado que una propiedad no tiene teléfono en su anuncio
    Cuando se genera su ficha en el PDF
    Entonces el campo de contacto muestra "Teléfono no disponible - ver anuncio original"
    Y el URL del anuncio está claramente visible en la ficha
