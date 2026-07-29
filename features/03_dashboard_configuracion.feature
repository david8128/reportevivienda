# language: es
Característica: Dashboard de configuración y gestión
  Como usuario de la extensión
  Quiero un panel de control completo con filtros y configuración
  Para personalizar los criterios de búsqueda y gestionar las propiedades recopiladas

  Antecedentes:
    Dado que el usuario abre el dashboard de la extensión
    Y que la base de datos contiene registros de propiedades

  Escenario: Configuración del filtro por estrato máximo
    Dado que el usuario accede a la sección "Filtros de búsqueda"
    Cuando ajusta el control deslizante de estrato máximo a valor 4
    Entonces todas las propiedades con estrato 1, 2, 3 y 4 aparecen en los resultados
    Y las propiedades con estrato 5 y 6 quedan excluidas del reporte
    Y la configuración se guarda en chrome.storage.local automáticamente

  Escenario: Configuración del filtro por valor máximo de la propiedad
    Dado que el usuario accede a la sección "Filtros de búsqueda"
    Cuando ingresa 550000000 en el campo "Valor máximo de la propiedad"
    Entonces se aplica el filtro a las propiedades en la base de datos
    Y el contador de propiedades elegibles se actualiza en tiempo real
    Y las propiedades que superan ese valor quedan marcadas como "fuera de criterio"

  Escenario: Configuración del filtro por piso máximo
    Dado que el usuario accede a la sección "Filtros de búsqueda"
    Cuando selecciona "Piso máximo: 2" en el selector de piso
    Entonces sólo aparecen propiedades en piso 1 o 2 que cumplan los demás criterios
    Y las propiedades sin piso definido se agrupan en "piso sin confirmar"

  Escenario: Vista de tabla de propiedades recopiladas
    Dado que la base de datos contiene al menos una propiedad
    Cuando el usuario accede a la pestaña "Propiedades"
    Entonces ve una tabla con columnas:
      | Columna          |
      | Puntuación       |
      | Tipo             |
      | Precio           |
      | M²               |
      | Estrato          |
      | Piso             |
      | Administración   |
      | Parqueadero      |
      | Ascensor         |
      | Conjunto         |
      | Ubicación        |
      | Origen           |
      | Estado           |
      | Acciones         |
    Y la tabla está ordenada por puntuación de mayor a menor por defecto

  Escenario: Confirmación manual de campos estimados desde el dashboard
    Dado que una propiedad tiene campos marcados como "estimado - requiere confirmación"
    Cuando el usuario hace clic en el ícono "⚠ Confirmar" en la fila de esa propiedad
    Entonces se abre un modal con cada campo estimado
    Y el usuario puede confirmar o corregir el valor
    Y al guardar el campo queda marcado como "confirmado"
    Y el ícono de advertencia desaparece de la fila

  Escenario: Configuración de pesos del sistema de puntuación
    Dado que el usuario accede a la pestaña "Puntuación"
    Cuando ajusta los pesos de cada criterio con controles deslizantes:
      | Criterio                    | Peso por defecto |
      | Precio ≤ 550M               | 20               |
      | Estrato ≤ 4                 | 15               |
      | Piso ≤ 2                    | 10               |
      | Parqueadero                 | 10               |
      | Ascensor                    | 5                |
      | Conjunto cerrado            | 10               |
      | Administración ≤ 300K       | 10               |
      | Viable para vivir y arrendar| 20               |
      | Posibilidad de dividir      | 15               |
      | Buena ubicación (manual)    | 15               |
    Entonces la puntuación de todas las propiedades se recalcula automáticamente

  Escenario: Exportar configuración de filtros
    Dado que el usuario ha configurado todos sus filtros y pesos
    Cuando hace clic en "Exportar configuración"
    Entonces se descarga un archivo JSON con toda la configuración
    Y el archivo puede reimportarse en otra instalación de la extensión

  Escenario: Restablecer configuración a valores predeterminados
    Dado que el usuario ha modificado varios filtros y pesos
    Cuando hace clic en "Restablecer valores predeterminados" y confirma
    Entonces todos los filtros vuelven a sus valores originales
    Y las puntuaciones se recalculan con los pesos predeterminados
