# language: es
Característica: Scraping asíncrono del historial de navegación
  Como usuario de la extensión
  Quiero que la extensión procese automáticamente en segundo plano
  todos los enlaces visitados de fincaraiz.com y metrocuadrado.com
  Para recopilar información de propiedades sin interrumpir mi navegación

  Antecedentes:
    Dado que la extensión está instalada y activa
    Y que el usuario ha concedido permisos de historial
    Y que la base de datos local IndexedDB está inicializada

  Escenario: Iniciar recopilación desde historial al hacer clic en el botón
    Dado que el usuario abre el popup de la extensión
    Cuando el usuario hace clic en el botón "Recopilar desde historial"
    Entonces la extensión lee todos los URLs del historial de los últimos 90 días
    Y filtra únicamente los URLs de fincaraiz.com y metrocuadrado.com
    Y encola cada URL para procesamiento asíncrono en segundo plano
    Y muestra un indicador de progreso con "Procesando X de Y propiedades"

  Escenario: Procesamiento headless de una página de propiedad en FincaRaiz
    Dado que hay un URL de fincaraiz.com en la cola de procesamiento
    Cuando el service worker carga el contenido de la página
    Entonces extrae los metros cuadrados usando los selectores definidos en el mapeo
    Y extrae el valor de la propiedad en pesos colombianos
    Y extrae si es casa o apartamento
    Y extrae el valor de la administración mensual
    Y extrae el estrato socioeconómico
    Y detecta si hace parte de conjunto cerrado o urbanización
    Y detecta si tiene parqueadero incluido
    Y detecta si tiene ascensor
    Y extrae el número de piso
    Y extrae la ubicación en texto (barrio, ciudad, dirección)
    Y captura una foto del mapa renderizado si está disponible

  Escenario: Procesamiento headless de una página de propiedad en MetroCuadrado
    Dado que hay un URL de metrocuadrado.com en la cola de procesamiento
    Cuando el service worker carga el contenido de la página
    Entonces extrae los mismos campos definidos usando el mapeo de MetroCuadrado
    Y registra el origen como "metrocuadrado" en el registro de la base de datos

  Escenario: Extracción de datos implícitos desde la descripción
    Dado que una propiedad tiene una descripción textual
    Cuando el scraper analiza el texto de la descripción
    Entonces detecta menciones de parqueadero aunque no estén en campos explícitos
    Y detecta menciones de ascensor, depósito, zonas comunes
    Y detecta el piso si se menciona en el texto ("apto piso 5", "quinto piso")
    Y detecta el estrato si se menciona ("estrato 3", "sector estrato 4")
    Y marca los campos extraídos de descripción como "estimado - requiere confirmación"

  Escenario: Manejo de páginas no disponibles o con error
    Dado que un URL del historial ya no está disponible (404 o redirige)
    Cuando el service worker intenta cargar la página
    Entonces registra el URL con estado "no disponible"
    Y continúa con el siguiente URL en la cola sin detener el proceso
    Y no cuenta el registro fallido en los resultados finales

  Escenario: Evitar duplicados en la base de datos
    Dado que un URL de propiedad ya existe en la base de datos
    Cuando la cola de procesamiento encuentra ese mismo URL
    Entonces omite el procesamiento y lo marca como "ya procesado"
    Y registra la fecha de la última visita actualizada
    Y no genera un registro duplicado

  Escenario: Límite de velocidad para no sobrecargar los servidores
    Dado que hay 50 URLs pendientes de procesar
    Cuando el service worker procesa la cola
    Entonces introduce un retraso mínimo de 2 segundos entre cada solicitud
    Y no realiza más de 10 solicitudes concurrentes simultáneas
    Y respeta el límite de velocidad durante toda la sesión de recopilación
