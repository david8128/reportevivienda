# language: es
Característica: Sistema de puntuación de propiedades
  Como usuario de la extensión
  Quiero que cada propiedad reciba una puntuación automática basada en criterios configurables
  Para identificar rápidamente las mejores opciones de inversión y arriendo

  Antecedentes:
    Dado que el motor de puntuación está inicializado
    Y que la configuración de pesos está cargada desde chrome.storage.local

  Escenario: Cálculo de puntuación base para una propiedad
    Dado que una propiedad tiene los siguientes datos:
      | Campo              | Valor      |
      | precio             | 350000000  |
      | estrato            | 3          |
      | piso               | 2          |
      | parqueadero        | sí         |
      | ascensor           | no         |
      | conjunto_cerrado   | sí         |
      | administracion     | 250000     |
    Cuando se ejecuta el cálculo de puntuación con pesos predeterminados
    Entonces la puntuación es:
      | Criterio                | Condición       | Puntos |
      | Precio ≤ 550M           | 350M ≤ 550M     | +20    |
      | Estrato ≤ 4             | 3 ≤ 4           | +15    |
      | Estrato == 3 (óptimo)   | 3 = 3           | +5     |
      | Piso ≤ 2                | 2 ≤ 2           | +10    |
      | Parqueadero             | sí              | +10    |
      | Ascensor                | no              | +0     |
      | Conjunto cerrado        | sí              | +10    |
      | Administración ≤ 300K   | 250K ≤ 300K     | +10    |
      | Viable vivir+arrendar   | sin_confirmar   | +0     |
      | Posibilidad de dividir  | sin_confirmar   | +0     |
      | Buena ubicación         | sin_confirmar   | +0     |
    Y la puntuación total es 80 sobre 130 puntos posibles

  Escenario: Incremento de puntuación al confirmar campos manuales
    Dado que una propiedad tiene puntuación 80
    Y los campos "bueno_vivir_arrendar" y "buena_ubicacion" están sin confirmar
    Cuando el usuario confirma:
      | Campo                 | Respuesta |
      | bueno_vivir_arrendar  | sí        |
      | buena_ubicacion       | sí        |
    Entonces la puntuación se incrementa:
      | Criterio                    | Puntos Adicionales |
      | Viable para vivir y arrendar| +20                |
      | Buena ubicación             | +15                |
    Y la nueva puntuación total es 115 sobre 130

  Escenario: Penalización por campos sin confirmar en el reporte
    Dado que una propiedad tiene campos críticos sin confirmar
    Cuando se genera el reporte PDF
    Entonces la propiedad aparece con una etiqueta "⚠ Datos incompletos"
    Y su posición en el ranking refleja la puntuación parcial actual
    Y el reporte indica cuántos campos faltan por confirmar

  Escenario: Recalculación masiva al cambiar pesos de criterios
    Dado que la base de datos contiene 50 propiedades con puntuaciones calculadas
    Cuando el usuario modifica el peso de "Parqueadero" de 10 a 20
    Entonces el motor recalcula la puntuación de todas las propiedades automáticamente
    Y actualiza todos los registros en IndexedDB de forma asíncrona
    Y el dashboard muestra "Recalculando puntuaciones..." durante el proceso
    Y notifica "Puntuaciones actualizadas (50 propiedades)" al completar

  Escenario: Ranking de propiedades por puntuación
    Dado que la base de datos contiene múltiples propiedades con puntuaciones diferentes
    Cuando el dashboard muestra la lista de propiedades
    Entonces están ordenadas de mayor a menor puntuación
    Y las propiedades con la misma puntuación se ordenan por precio ascendente
    Y las primeras 3 posiciones tienen una medalla visual (🥇🥈🥉)

  Escenario: Puntuación especial por precio por metro cuadrado
    Dado que dos propiedades tienen el mismo precio de 300 millones
    Y la propiedad A tiene 60 m² (5M/m²) y la propiedad B tiene 80 m² (3.75M/m²)
    Cuando se calcula la puntuación
    Entonces la propiedad B recibe puntos adicionales por mejor relación precio/m²
    Y el valor precio/m² se muestra en la tabla del dashboard

  Escenario: Alerta por propiedad con puntuación alta y precio bajado
    Dado que una propiedad tiene puntuación 100+ y precio actualizado más bajo
    Cuando se detecta el cambio de precio
    Entonces el sistema genera una notificación del navegador
    Y el badge de la extensión muestra el número de alertas pendientes
    Y la propiedad aparece destacada en el dashboard con un borde verde
