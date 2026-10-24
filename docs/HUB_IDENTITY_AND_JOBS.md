# Identidad y trabajos del Hub — operación

## Identidad

La autoridad de acceso reside en `auth_users` y `auth_sessions`, dentro de la
SQLite persistente del Hub. Los SaaS no comparten estas tablas ni sus sesiones.

`ADMIN_USER` y `ADMIN_PASS` sirven exclusivamente para crear el primer propietario
cuando no hay ningún usuario. El bootstrap es transaccional y no actualiza ni
rescata cuentas existentes. Después del bootstrap, cambiar esas variables no
cambia la contraseña del propietario: se cambia desde Mi cuenta. Se conservan
durante esta transición para permitir el rollback conocido de la imagen anterior.

Las contraseñas usan scrypt con salt aleatorio. Los secretos TOTP se cifran con
AES-256-GCM y una clave derivada por HKDF de `HUB_MASTER_KEY`. Esta clave debe
permanecer estable y recuperable fuera del servidor: una rotación requiere
recifrar primero los secretos. No reemplazarla por otra arbitrariamente.

El primer login crea una sesión limitada a enrolamiento. No permite consultar
datos del Hub ni ejecutar acciones hasta confirmar TOTP. Solo el usuario final
configura su dispositivo y guarda los diez códigos de recuperación, visibles
una única vez. Los códigos se guardan como hashes y son de un solo uso.

El login posterior exige contraseña y TOTP o recuperación. TOTP aplica ventanas
de 30 segundos y bloquea reutilización de un contador. Un desafío vence en cinco
minutos y admite cinco intentos. Las rutas públicas y de cuenta tienen además
límites persistentes por IP y cuerpos acotados. `session.touch` no consume un
intento de autenticación y exige sesión/origen válidos.

Cada sesión tiene token aleatorio de 256 bits; en la base se guarda su hash.
Vence a las 12 horas o después de 30 minutos sin actividad interactiva. Las
consultas automáticas de alertas no extienden esa inactividad. Las acciones
sensibles requieren verificación de los últimos diez minutos.

Logout revoca la sesión en servidor. Cambios de contraseña, rol, alcance,
activación o MFA revocan las sesiones relacionadas. Mi cuenta permite revocar
una sesión o todas. Reemplazar MFA exige contraseña y un factor vigente; el
anterior sigue válido hasta confirmar el nuevo, cuando se revocan las sesiones
y códigos antiguos. Otro propietario puede exigir nuevo enrolamiento a un
usuario; no existe una excepción HTTP que saltee MFA.

Si el único propietario pierde dispositivo y todos los códigos, se requiere
recuperación administrativa controlada con acceso al servidor, backup previo y
registro de auditoría. No hay contraseña maestra de rescate ni reset por variables.

Existe una herramienta local `scripts/recover-owner.cjs`, sin endpoint HTTP.
Se ejecuta en el contenedor Hub, con su DATA_DIR real, pasando
`--username=<propietario>` y `--confirm=RESET MFA <propietario>` como argumentos
separados y correctamente entrecomillados. Antes de cambiar nada genera y verifica
una copia consistente de la SQLite del Hub. Resetea únicamente MFA del propietario
activo indicado, revoca sus sesiones/códigos y audita el operador del servidor.
No cambia la contraseña: el siguiente acceso exige la existente y un nuevo
enrolamiento. Preservar también una copia de ese respaldo fuera del servidor.

Roles: propietario administra; operador muta solo las aplicaciones asignadas;
consulta lee indicadores/tenants sin mutaciones, logs o descarga de bases.
El detalle administrativo SaaS exige alcance sobre la aplicación. Los cambios
están habilitados únicamente para Hub, OnlyFood, OnlyGym y OnlyTurn; los otros
productos no heredan permisos de operación por figurar en el inventario.

La revocación se consulta en middleware Node y en los handlers: no depende de
una firma Edge que siga vigente después de logout. El runtime Node de middleware
es estable desde [Next 15.5](https://nextjs.org/blog/next-15-5).

## Backups y trabajos

POST `/api/backups` recibe `slug` y `requestId` UUID, y devuelve HTTP 202 con
`jobId`/estado. No afirma que ya exista una copia. El navegador conserva el ID
de una solicitud sin respuesta en la sesión local para poder repetirla sin
duplicar el trabajo. La UI muestra la cola y su resultado real.

El scheduler conserva su clave Bearer independiente y consulta cada 30 segundos.
El Hub reclama un backup por vez, con lease de dos minutos y heartbeat cada 20
segundos; hay exclusión por tipo/recurso y clave idempotente. Las agendas se
marcan ejecutadas después de confirmar éxito, y los reintentos continúan fuera
de la hora inicial. Se aplican hasta tres intentos con backoff de uno y cinco
minutos. Las agendas deshabilitadas y actores sin permiso no se ejecutan.

Estados: pendiente, en ejecución, completado, fallido, incierto y cancelado.
Una ejecución sin heartbeat pasa a incierta y bloquea ese recurso. No se repite
a ciegas y no se borran locks por antigüedad. Un archivo de lock nuevo contiene
PID, host, trabajo y nonce; los locks heredados sin información no se asumen libres.

La reconciliación automática solo acredita éxito cuando el mismo job tiene un
archivo registrado íntegro y se verifican otra vez gzip, tamaño y SHA-256. Sin
esa prueba se conserva el bloqueo. Los trabajos fallidos confirmados admiten
reintento con permisos y verificación reciente; los pendientes admiten cancelación.
Cancelar un pendiente no interrumpe un dump activo.

Un dump cuyo transporte se interrumpe con proceso potencialmente activo conserva
el lock y se registra como incierto. Resolver un caso sin archivo confirmado
requiere comprobar la terminación del proceso antes de recuperar ese recurso;
la interfaz no ofrece una limpieza forzada de locks.

SQLite usa la API nativa de backup si está disponible. En Node 22 anterior a esa
API usa `VACUUM INTO` sobre conexión de origen de solo lectura, verificando la
copia resultante. No usa una copia directa que omita WAL. El archivo temporal
tiene permisos restrictivos y nunca reemplaza el origen.

## Rollout y rollback

Las tablas de identidad/jobs son aditivas. Se necesita backup consistente del
Hub, restauración aislada comprobada, imagen anterior conservada y Compose
efectivo antes del release. Se actualizan solo web/scheduler del Hub.

La primera activación invalida las cookies anteriores del Hub y exige enrolar
MFA al propietario. Las cookies y datos SaaS no cambian. No enrolar al propietario
productivo con una semilla generada o guardada por las pruebas automatizadas.

Un rollback anterior a estas funciones pierde la aplicación de MFA/RBAC y la
revocación de esa versión. No restaurar la SQLite para revertir una imagen.
Si hay backups en ejecución, esperar su terminación o reconciliar el resultado;
el scheduler anterior desconoce la cola nueva.

## Evidencia y pendientes

Los tests de identidad, jobs y runner usan SQLite temporal y motores de ejecución
simulados donde habría acciones de infraestructura. `verify-ui.cjs` crea un
runtime portable, enlaza solo 127.0.0.1, genera credenciales de fixture y separa
DATA_DIR. Las pruebas HTTP de cola solo crean/cancelan trabajos, sin ejecutar un
dump productivo. Las pruebas UI de gestión SaaS usan contratos simulados locales.

No existe todavía destino de copia externa proporcionado por el usuario. No se
declara réplica activa por tener la interfaz o un adaptador preparado. Los otros
pendientes siguen registrados en `HUB_COMPLETION_MATRIX.md`.
