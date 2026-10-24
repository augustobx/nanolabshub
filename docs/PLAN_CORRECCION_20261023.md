# Plan de corrección y cierre de NanoHub

Base: auditoría del 23/10/2026 y release integrado en PR #5.
Este documento planifica el trabajo pendiente; no acredita implementaciones nuevas.

## Resultado esperado y límites

Cerrar los nueve pendientes de la auditoría y completar las funciones que fueron
mitigadas mediante bloqueo. Cada función ofrecida por el Hub debe tener backend
real, permisos, trazabilidad, estados de error, pruebas y evidencia de operación.
“100%” significa cumplir esta matriz acordada de aceptación, sin pendientes
conocidos en alcance; no garantiza ausencia absoluta de defectos futuros.

OnlyPadel, OnlyCars, OnlyERP y sus bases permanecen excluidos de cambios,
despliegues, reinicios, respaldos nuevos, restauraciones y tareas automáticas.
Los módulos genéricos se prueban con infraestructura temporal. Las integraciones
administrativas contempladas son las ya habilitadas: OnlyFood, OnlyGym y OnlyTurn.
Integrar otros productos constituye un alcance adicional.

El trabajo se concentra en el Hub. No requiere cambiar el esquema ni las
credenciales de los SaaS. Toda prueba que interrumpa servicios o cambie datos de
negocio se ejecuta primero en clones aislados. No se restauran datos sobre bases
productivas para probar recuperación.

## Fase 1 — Contrato de cierre y controles de calidad

1. Convertir los 27 hallazgos y nueve pendientes en una matriz de requisitos,
   pruebas, evidencia, estado y responsable técnico.
2. Inventariar cada pantalla, botón, endpoint y tarea del Hub: Home, Superadmin,
   SaaS/gestión, Governance, Legacy, Operaciones, Software, Infraestructura,
   Hardware, Networking, Seguridad, Auditoría, Continuidad y Backups.
3. Registrar fuente real y frescura de cada indicador. Separar medición,
   configuración, capacidad no disponible y error de lectura.
4. Agregar lint no interactivo al CI y corregir los errores de su alcance sin
   excepciones generales. Mantener tipado, build, pruebas y auditoría de paquetes.
5. Crear una instalación de prueba que no monte socket Docker, redes, volúmenes
   ni secretos productivos. Preparar stacks temporales para pruebas operativas.

Cierre: matriz sin controles omitidos; todos los gates actuales y lint pasan.
Los datos de prueba no pueden activarse como fuente de producción.

## Fase 2 — Identidades, MFA, permisos y sesiones

1. Agregar usuarios propios del Hub, contraseñas con hash apropiado, estados y
   roles iniciales: propietario, operador y consulta; permisos por acción y app.
2. Migrar el acceso actual mediante bootstrap de un único propietario, sin
   contraseñas predeterminadas ni borrar el historial anterior.
3. Implementar enrolamiento TOTP, secretos cifrados fuera del código, códigos de
   recuperación de un solo uso y verificación reciente para acciones sensibles.
4. Implementar sesiones persistentes, expiración absoluta y por inactividad,
   rotación al autenticar o elevar privilegios y revocación individual/global.
5. Logout revoca la sesión en servidor. Desactivar usuario, cambiar permisos o
   contraseña revoca o invalida las sesiones correspondientes de inmediato.
6. Aplicar autorización en cada API y worker. Separar identidades humanas de
   claves de máquinas; registrar actor, recurso, acción y resultado.
7. Conservar recuperación administrativa documentada sin una puerta trasera.

Cierre: cookie copiada rechazada después de logout/revocación; rol consulta no
puede mutar; operador no puede elevarse ni actuar sobre apps excluidas; MFA,
recuperación y migración de propietario probados. El dueño completa su propio
enrolamiento antes de exigir MFA en producción para evitar bloquear el acceso.

Pendientes cubiertos: cuentas/MFA/roles y revocación de sesiones.

## Fase 3 — Jobs duraderos y recuperación de interrupciones

1. Consolidar estados persistentes: pendiente, en ejecución, exitoso, fallido,
   cancelado y resultado incierto; conservar intentos y causa sanitizada.
2. Reclamar trabajos de forma atómica con lease/heartbeat, exclusión por recurso
   e idempotencia. Recuperar estado después de reiniciar el Hub o worker.
3. Reintentar fallos transitorios con backoff y límite. Reconciliar primero las
   acciones cuyo resultado no se confirmó; no repetir una escritura a ciegas.
4. Corregir el claim diario de backups: un fallo no pierde silenciosamente el
   turno y un reintento no genera una ejecución paralela.
5. Detectar ejecuciones huérfanas comprobando proceso, heartbeat y estado real;
   no borrar locks únicamente por su edad.
6. Agregar cancelación segura donde sea posible y alertas visibles en Hub.

Cierre: pruebas de caída en cada transición, reinicio del worker, timeout,
solapamiento, reloj fuera de rango y ejecución duplicada. Sin pérdida silenciosa
de trabajos ni repetición de efectos ya confirmados.

Pendiente cubierto: reintento y recuperación de jobs interrumpidos.

## Fase 4 — Backups completos y restauración demostrable

1. Integrar restauraciones SQLite, MariaDB y PostgreSQL en destinos temporales
   aislados, con herramientas compatibles con cada versión y sin redes públicas.
2. Validar archivo, compresión, checksum, esquema, tablas, conteos y relaciones;
   registrar prueba y fecha. Una copia fallida o no probada no figura saludable.
3. Importar archivos externos únicamente tras comprobar pertenencia, ruta,
   integridad y restauración. Evitar duplicados por checksum; conservar original.
4. Preparar réplica automática cifrada a almacenamiento independiente del
   servidor, con credenciales limitadas, reintentos, retención y alertas.
5. Probar recuperación descargando la copia remota, no reutilizando el original
   local. Conservar la clave de recuperación fuera del servidor respaldado.
6. Configurar agendas explícitas solo para recursos autorizados. Registrar RPO y
   RTO objetivo y medirlos con pruebas reales antes de considerarlos cumplidos.
7. Exponer cobertura por recurso, última copia, última réplica y última prueba;
   marcar lo que falte en lugar de declarar cobertura completa.

Cierre: copia programada, réplica remota y restauración aislada aprobadas por
cada motor y recurso incluido. Confirmar alerta ante copia corrupta, destino
remoto caído o clave inválida. Ningún recurso protegido queda incluido.

Dependencia externa: identificar un destino existente y credenciales disponibles.
Si no existen, preparar toda la integración y dejar especificados el destino,
permisos y configuración necesarios; no dar por cerrada la réplica sin probarla.

Pendientes cubiertos: réplica externa, restore MariaDB/PostgreSQL e importación.

## Fase 5 — Despliegues y mantenimiento seguros desde la interfaz

1. Guardar por app el manifest efectivo y sus capas, proyecto, servicio web,
   imagen/digest, revisión, montajes, redes y rutas permitidas. Impedir comandos
   arbitrarios y selección de recursos compartidos o protegidos.
2. Implementar preflight y vista previa del cambio: diff de configuración,
   respaldo verificado, CI de la revisión y compatibilidad de persistencia.
3. Ejecutar release como job durable con bloqueo por app y servicio explícito;
   no reconstruir ni reiniciar bases o dependencias por efectos de Compose.
4. Comprobar salud y flujo funcional; conservar imágenes y configuración anterior
   para rollback. Si hay cambios de esquema, exigir compatibilidad demostrada y
   procedimiento específico; no restaurar automáticamente una base productiva.
5. Registrar y mostrar estados reales, errores, revisión y resultado. Habilitar
   el botón únicamente para apps con el procedimiento completamente validado.
6. Reemplazar la acción global retirada por mantenimiento acotado: vista previa
   de imágenes propias no usadas, exclusión de rollback/pins, comprobación de
   referencias y selección explícita. Nunca borrar volúmenes ni usar prune global.
7. Probar primero todo sobre stacks temporales; después liberar el despliegue
   del propio Hub. Otros destinos autorizados requieren su manifest validado.

Cierre: release correcto, fallo de salud, recuperación y concurrencia probados;
despliegue de Hub verificado en producción; identidades de contenedores vecinos
sin cambios. Mantenimiento sin recursos compartidos ni bases en su selección.

Pendiente cubierto: pipeline desde UI. Completa H04 y reemplaza funcionalmente
H03 mediante mantenimiento con alcance explícito; prune global sigue retirado.

## Fase 6 — Historial, coherencia y aceptación final

1. Definir retención por tipo de dato y capacidad real. Archivar con checksum y
   comprobar lectura/recuperación antes de activar cualquier eliminación.
2. Mantener retención automática desactivada hasta fijar la política y su alcance;
   no purgar auditoría histórica por una configuración implícita.
3. Recorrer toda la matriz de módulos con backend real de prueba: éxito, vacío,
   permisos insuficientes, fallo de red/DB, datos obsoletos y concurrencia.
4. Validar gestión de OnlyFood, OnlyGym y OnlyTurn en entornos aislados con sus
   contratos reales: tenants, planes, suscripciones, módulos, administradores y
   pagos según capacidades; precios/permisos/aislamiento/idempotencia en servidor.
5. Verificar ausencia de mocks, fallbacks silenciosos, acciones decorativas y
   contadores inventados en rutas productivas. Revisar usabilidad móvil/escritorio.
6. Desplegar por etapas con backup previo, migraciones aditivas y reversión;
   ejecutar smoke HTTPS, comprobar logs y comparar contenedores ajenos.
7. Observar al menos un ciclo completo de cada tarea habilitada y una recuperación
   desde réplica externa. Los procesos de baja frecuencia se prueban además con
   disparo controlado en aislamiento, sin falsear fechas ni resultados productivos.

Cierre: nueve pendientes cerrados con evidencia; matriz completa aprobada;
cero P0/P1 abiertos y ningún hallazgo restante sin corregir dentro del alcance.
Cada función habilitada tiene prueba y evidencia vigente. Toda exclusión queda
documentada como fuera de alcance, sin presentarla como funcionalidad terminada.

Pendiente cubierto: retención. Regresión de todos los hallazgos y módulos.

## Entrega por fase

Código, migraciones y pruebas; informe de resultados; evidencia de producción
cuando corresponda; procedimiento de recuperación; lista de pendientes restante.
Si una dependencia externa impide cerrar un criterio, se informa exactamente;
no se convierte una configuración pendiente en un resultado aprobado.

Orden: calidad → identidad → jobs → backups → deploy/mantenimiento → cierre.
Se pueden preparar interfaces y adaptadores en paralelo lógico, pero ninguna
acción sensible se habilita antes de cumplir sus dependencias y pruebas.
