# Auditoría de NanoHub — 23/10/2026

Alcance: aplicación Hub, sus 27 handlers API, los módulos visibles, librerías,
persistencia SQLite, integraciones, worker de backups, dependencias, Docker y CI.
La revisión de producción previa recorrió 16 páginas y 12 APIs de consulta.
Las pruebas de acciones sensibles se ejecutaron con fixtures y dependencias
simuladas, sin ejecutar comandos peligrosos sobre el servidor.

OnlyPadel, OnlyCars, OnlyERP y sus bases quedan protegidos. Esta auditoría no
despliega cambios de código en ningún SaaS ni restaura sus bases.

## Hallazgos y correcciones de esta rama

| ID | Prioridad | Evidencia anterior | Corrección |
| --- | --- | --- | --- |
| H01 | P0 | Cookie inventada aceptada por middleware; historial técnico respondió 200 en producción | Firma HMAC verificada en Edge y Node; validación estricta de identidad, vencimiento y rutas públicas; guardas propias de lectura |
| H02 | P0 | `getContainerLogs` interpolaba nombre y límite sin validar en shell; streaming carecía de guarda propia | Nombres Docker y límites validados antes de ejecutar; streaming autenticado y argumentos separados |
| H03 | P0 | `/api/docker/prune` ejecutaba limpieza global sin comprobar sesión/origen | Guarda de sesión/origen y respuesta 410; comando eliminado y botón bloqueado |
| H04 | P1 | Deploy genérico ejecutaba `compose up --build` sobre todo un stack y no reproducía las capas efectivas vigentes | Comandos genéricos eliminados; endpoints 503 y botón bloqueado. El despliegue operativo usa el procedimiento explícito de release |
| H05 | P1 | SSH desactivaba host-key checking, reutilizaba contraseña administrativa y reintentaba comandos por otro transporte | OpenSSH por argv, BatchMode y host-key checking; sin contraseña predeterminada ni reintento automático; `ssh2` retirado |
| H06 | P1 | Next 14.2.35 y PostCSS afectados por avisos de seguridad | Next 15.5.28, React/ReactDOM 19.3.1, PostCSS 8.5.31 y selector-parser 7.1.6; lockfile actualizado; auditoría npm sin avisos |
| H07 | P1 | Fallo de SQLite cambiaba silenciosamente a almacenamiento volátil, perdiendo auditoría | Fallo cerrado; health comprueba persistencia; timeout de bloqueo SQLite |
| H08 | P1 | Middleware exigía cookie al scheduler, que solo usa Bearer; worker unhealthy por 401 | Excepción exacta al POST del scheduler; su endpoint sigue verificando clave independiente en tiempo constante |
| H09 | P1 | Restricción de productos protegidos existía en gestión SaaS pero no en restart, lifecycle ni backups | Guardas de servidor y controles de interfaz para los tres productos; agendas heredadas protegidas no se ejecutan |
| H10 | P1 | Login sin límite de intentos; payload público sin tamaño máximo; redirección `from` libre | Límite persistente de 10 intentos/15 minutos por IP, cuerpo acotado y retorno a rutas locales |
| H11 | P1 | Node toleraba expiraciones no numéricas; cambiar contraseña no invalidaba cookies existentes | Parser común estricto y firma vinculada también a la contraseña; cambio de contraseña invalida sesiones |
| H12 | P1 | Suspensión parcialmente fallida dejaba restore plan pero impedía reactivar desde estado active | Recuperación explícita, botón correspondiente y bloqueo de otras acciones hasta recuperar; plan limitado a contenedores de su app |
| H13 | P1 | Restart podía ejecutarse aun si no se podía registrar auditoría | Se exige registro persistente de inicio antes de la acción; conserva registro de resultado |
| H14 | P1 | Backup registrado como íntegro seguía computándose aunque faltara el archivo | Lista contrasta presencia, tipo, tamaño y cambios de fecha; download sigue verificando gzip y SHA-256 |
| H15 | P2 | Historial de backups propio no distinguía los archivos creados por timers/operadores | Inventario adicional de metadatos, sin afirmar integridad ni restauración; cobertura rotulada como registro del Hub |
| H16 | P2 | Fallos de telemetría/Docker terminaban en lista vacía de alertas | Alertas explícitas de diagnóstico no disponible; no se interpreta falta de lectura como estado saludable |
| H17 | P2 | Legacy fijaba edición central en cero y negaba funciones ya integradas | Capacidades comunes para Legacy, Superadmin y ficha SaaS, obtenidas de catálogos autenticados reales |
| H18 | P2 | Contador de productos conectados incluía siempre las siete fichas del registro | Cuenta únicamente fuentes disponibles; catálogo de productos conserva su conteo propio |
| H19 | P2 | Una credencial configurada se tomaba como prueba de gestión disponible | Sonda de catálogo con HMAC; errores o restricciones de operaciones se reflejan en capacidades |
| H20 | P2 | Paginación podía sumar IDs repetidos | Fuente con duplicados rechazada, sin inflar conteos |
| H21 | P2 | Composes con nombres válidos no detectados; estados paused/starting y jobs terminados inconsistentes | Detección de manifests adicionales, estados precisos, exclusión de jobs exitosos y fallo de web principal visible |
| H22 | P2 | Cada módulo repetía muestras Docker/host y generaba métricas redundantes | Caché con single-flight de 10 segundos e invalidación en mutaciones; máximo una muestra histórica cada 30 segundos e índice temporal |
| H23 | P2 | Lecturas tardías podían actualizar detalle de otro tenant; errores dejaban cifras anteriores aparentando actualidad | Generaciones de carga, actualización coherente y limpieza de estados fallidos en pantallas principales |
| H24 | P2 | Streaming y terminales crecían sin límite; cancelación no siempre detenía el proceso | Flujo limitado a 5 minutos/2 MiB, cancelación del proceso y texto del navegador acotado |
| H25 | P2 | Portal abría `https://` cuando el conector no informaba dominio | Enlace condicionado a dominio informado; no se inventan dominios |
| H26 | P2 | Health podía quedar estático y declaraba salud aun sin persistencia | Endpoint dinámico, no-store, SQLite disponible o HTTP 503 |
| H27 | P2 | Pruebas UI no estaban todas restringidas a localhost | Los fixtures de ambos scripts se limitan a localhost/127.0.0.1 |

P0 indica un problema crítico de seguridad confirmado por código y, para H01,
una comprobación de lectura inocua en producción. No se ejecutó una inyección
de comandos ni una limpieza global para demostrar H02/H03.

## Datos simulados e información fija

Los fixtures de tenants, importes, métricas y contenedores pertenecen a scripts
de pruebas. No son una fuente de las APIs de producción ni se copian como
scripts al runner de la aplicación.

Se corrigieron el cero fijo de Legacy, la confusión entre registro y conectores,
el fallback volátil y los estados de disponibilidad que podían ser engañosos.
El registro de aplicaciones, la lista de productos, las opciones de estado y
los indicadores de funciones inexistentes (por ejemplo MFA) son configuración
o capacidades de producto, no mediciones ficticias.

## Pruebas

- TypeScript y build de producción.
- 33 pruebas Node: autenticación Node/Edge, cookies falsas, vencimientos,
  cambio de contraseña, límites de cuerpo e intentos, validación de comandos,
  productos protegidos, pérdida de persistencia, alertas desconocidas,
  catálogos, duplicados, backups y recuperación.
- Pruebas de interfaz de todos los módulos en escritorio y móvil.
- 48 comprobaciones de gestión SaaS para OnlyFood, OnlyGym y OnlyTurn.
- `npm audit`: cero vulnerabilidades informadas en dependencias instaladas,
  incluidas las de desarrollo, al momento de la auditoría.

El resultado productivo, imágenes, respaldo, CI y comparación de contenedores
se documentan en el informe de cierre del release. No se consideran probadas
las funciones pendientes enumeradas a continuación.

## Mejoras pendientes con criterio de aceptación

| Prioridad | Mejora | Cierre verificable |
| --- | --- | --- |
| P1 | Cuentas administrativas individuales, MFA y roles | Login con segundo factor, permisos por operación y actor individual en auditoría; no reutilizar claves SaaS como identidad humana |
| P1 | Revocación de una sesión concreta | Identificador persistente, revocación en servidor y rechazo de la cookie revocada; actualmente logout elimina la cookie del navegador |
| P1 | Pipeline de deploy desde la interfaz | Manifest efectivo exacto, servicio web explícito, imagen versionada, respaldo restaurable, salud y reversión; demostrar que no reinicia DB/otros servicios antes de habilitar el botón |
| P1 | Réplica externa automática | Cifrado, política de retención, copia independiente y restauración verificada; una copia manual fuera del servidor no acredita una réplica continua |
| P2 | Restore checks MariaDB/PostgreSQL integrados al Hub | Destinos temporales sin red productiva, comparación de tablas y registro de evidencia; hoy el módulo automatiza comprobación de copias SQLite |
| P2 | Reintento y recuperación de jobs interrumpidos | Backoff duradero, alertas y reconciliación de claims/locks; nunca eliminar un lock por antigüedad sin comprobar que no existe trabajo activo |
| P2 | Retención de métricas y auditoría | Política aprobada y archivo verificable antes de purgar; este release no borra historial existente |
| P2 | Lint independiente y seguimiento de excepciones | Configuración no interactiva y gate de CI; el tipado/build y los tests no sustituyen ese control |
| P2 | Importación verificada de backups externos | Validar gzip/checksum y restaurar por motor antes de incorporarlos como íntegros; el inventario actual solo lee metadatos |

No se modifican proveedores externos, rotan credenciales ni se activan agendas
de otros productos como parte de estas mejoras.

## Operación y límites

Las cookies anteriores del Hub requieren iniciar sesión otra vez al activar
la nueva firma. Las sesiones de los SaaS y sus credenciales de integración se
conservan. La tabla nueva de intentos de login y el índice de métricas son
adiciones compatibles en SQLite del Hub; no requieren restaurar una base para
volver a una imagen anterior.

La protección de otros servicios se verifica por identidad e inicio de sus
contenedores y por ausencia de comandos de escritura dirigidos a ellos. No
se consultó el contenido de las bases protegidas para generar una comparación.

Fuentes de seguridad y compatibilidad:
[aviso de Next.js](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw),
[guía oficial de actualización](https://nextjs.org/docs/app/guides/upgrading/version-15).
La aplicabilidad de cada aviso depende de las funciones y plataforma utilizadas;
la auditoría npm no demuestra que todos fueran explotables en este despliegue.
