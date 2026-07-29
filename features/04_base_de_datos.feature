# language: es
Característica: Base de datos local de propiedades
  Como usuario de la extensión
  Quiero que todos los datos recopilados se almacenen localmente de forma persistente
  Para poder consultar, filtrar y exportar la información en cualquier momento

  Antecedentes:
    Dado que la extensión está inicializada
    Y que IndexedDB está disponible en el navegador

  Escenario: Inicialización de la base de datos en primera instalación
    Dado que es la primera vez que se instala la extensión
    Cuando el service worker inicia por primera vez
    Entonces crea la base de datos "ReporteVivienda" versión 1
    Y crea los object stores:
      | Object Store   | Clave Primaria | Índices                                  |
      | propiedades    | id (auto)      | url, origen, estrato, precio, piso, fecha|
      | configuracion  | clave          | (ninguno)                                |
      | historial_cola | id (auto)      | url, estado                              |
      | cambios_precio | id (auto)      | propiedad_id, fecha                      |
    Y registra la versión de la DB en chrome.storage.local

  Escenario: Almacenamiento de una propiedad nueva
    Dado que el scraper ha extraído todos los campos de una propiedad
    Cuando el service worker recibe el mensaje "GUARDAR_PROPIEDAD"
    Entonces guarda un registro con la siguiente estructura:
      | Campo                    | Tipo     | Ejemplo                          |
      | id                       | auto     | 1                                |
      | url                      | string   | https://fincaraiz.com/...        |
      | origen                   | string   | fincaraiz                        |
      | tipo                     | string   | apartamento                      |
      | precio                   | number   | 350000000                        |
      | metros_cuadrados         | number   | 65                               |
      | estrato                  | number   | 3                                |
      | piso                     | number   | 2                                |
      | administracion           | number   | 250000                           |
      | parqueadero              | boolean  | true                             |
      | ascensor                 | boolean  | false                            |
      | conjunto_cerrado         | boolean  | true                             |
      | ubicacion_texto          | string   | Chapinero, Bogotá                |
      | mapa_imagen              | string   | data:image/png;base64,...        |
      | bueno_vivir_arrendar     | string   | sin_confirmar                    |
      | posible_dividir          | string   | sin_confirmar                    |
      | buena_ubicacion          | string   | sin_confirmar                    |
      | telefonos                | array    | ["3001234567"]                   |
      | puntuacion               | number   | 75                               |
      | campos_estimados         | array    | ["piso", "estrato"]              |
      | fecha_recopilacion       | datetime | 2026-07-28T10:30:00Z             |
      | fecha_actualizacion      | datetime | 2026-07-28T10:30:00Z             |
      | estado                   | string   | pendiente_confirmacion           |

    Escenario: Evitar duplicados en cualquier entrada de datos
      Dado que una misma propiedad puede llegar desde historial, recuperación, monitoreo en vivo o importación
      Y que sus URLs pueden diferir solo por "www", fragmentos, barras finales o parámetros de seguimiento
      Cuando la extensión guarda o encola la propiedad
      Entonces normaliza la URL a una identidad canónica antes de consultarla
      Y usa esa identidad como clave única en IndexedDB y en la cola
      Y conserva un solo registro de la propiedad
      Y mantiene las confirmaciones manuales y teléfonos al fusionar datos actualizados

  Escenario: Historial de cambios de precio
    Dado que una propiedad ya existe en la base de datos con precio 380000000
    Cuando el scraper detecta que el precio actual es 350000000
    Entonces guarda un registro en "cambios_precio" con:
      | propiedad_id | precio_anterior | precio_nuevo | diferencia | fecha                |
      | 1            | 380000000       | 350000000    | -30000000  | 2026-07-28T10:30:00Z |
    Y actualiza el campo precio de la propiedad al nuevo valor
    Y el dashboard muestra una etiqueta "↓ -30M" en la columna de precio

  Escenario: Consulta de propiedades con filtros activos
    Dado que la base de datos contiene 100 propiedades
    Y la configuración tiene filtros: estrato ≤ 4, precio ≤ 550M, piso ≤ 2
    Cuando el dashboard solicita la lista filtrada
    Entonces la base de datos devuelve únicamente las propiedades que cumplen todos los criterios
    Y el resultado está ordenado por puntuación descendente
    Y incluye el total de propiedades encontradas

  Escenario: Exportación de la base de datos a JSON
    Dado que la base de datos contiene registros de propiedades
    Cuando el usuario hace clic en "Exportar base de datos"
    Entonces se descarga un archivo JSON con todos los registros
    Y el archivo incluye metadatos de exportación (fecha, versión, total de registros)

  Escenario: Importación de base de datos desde JSON
    Dado que el usuario tiene un archivo JSON exportado de una sesión anterior
    Cuando sube el archivo usando la opción "Importar base de datos"
    Entonces la extensión valida el formato del archivo
    Y fusiona los registros evitando duplicados por URL
    Y notifica cuántos registros nuevos fueron importados y cuántos ya existían

  Escenario: Limpieza de propiedades antiguas
    Dado que la base de datos contiene propiedades con más de 180 días sin actualización
    Cuando el usuario activa la opción "Limpiar registros antiguos"
    Entonces se muestra una lista de los registros que serán eliminados
    Y solicita confirmación antes de borrar
    Y elimina únicamente los registros confirmados por el usuario
