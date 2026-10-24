# Importación verificada de backups

Paso 1 del cierre de NanoHub. No inicia el paso 2 de integraciones ni modifica
OnlyPadel, OnlyCars, OnlyERP o sus bases. Alcance: archivos existentes de NanoHub,
OnlyFood, OnlyGym y OnlyTurn, ubicados en `/opt/backups/<slug>/`.

## Flujo de la interfaz

Backups muestra el panel «Importar copias existentes» a propietarios y operadores
con MFA. El inventario de un operador solo incluye sus aplicaciones asignadas.
`GET /api/backups/import` devuelve archivos locales candidatos; archivos fuera del
formato/tamaño permitido aparecen deshabilitados. Un candidato aún no es un backup
validado. No se solicita ni acepta una ruta absoluta del navegador.

`POST /api/backups/import` recibe `{slug,filename,requestId}`. Se exige origen,
MFA reciente y alcance por recurso; devuelve 202 con un trabajo persistido.
El servidor guarda la identidad física/tamaño/fecha del archivo. Si cambia antes
de ejecutar, la solicitud falla y debe crearse otra para su nueva versión.

El worker revalida al actor y abre el origen de solo lectura, sin seguir enlaces
simbólicos. Copia a un archivo nuevo privado y acotado; conserva el original.
SQLite sin comprimir se normaliza a gzip. Se verifican cabecera, tamaño, compresión
y SHA-256. El archivo nuevo no se publica como válido hasta aprobar la restauración
aislada. El registro transitorio `import_testing` queda fuera del listado y las
descargas públicas. Solo el motor interno de validación puede leerlo.

La publicación y la procedencia se confirman en una transacción del Hub:
`backup_imports` conserva archivo original, hash de origen, hash normalizado,
backup asociado, actor, job y deduplicación. Se agrega auditoría `BACKUP_IMPORTED`.
Un fallo conserva el original y la copia fallida, con estado fallido; no acredita
cobertura. Solo se eliminan los enlaces temporales creados por esa ejecución.

Dos archivos idénticos de la misma aplicación no duplican el respaldo registrado:
el SHA-256 normalizado encuentra la copia existente y se comprueba/restaura otra
vez antes de registrar la procedencia adicional. El dedupe nunca confía únicamente
en el hash guardado sin comprobar el archivo físico y su restauración.

## Motores y formatos

- SQLite: `.sqlite` y `.sqlite.gz`; integridad y claves foráneas en copia temporal.
- MariaDB: `.sql.gz` nativo con creación/selección de base; `mariadb-check`, conteos
  y búsqueda de huérfanos por clave foránea, incluidas claves compuestas.
- PostgreSQL: `.sql.gz` nativo y `.dump`/`.dump.gz` con cabecera `PGDMP`.
  Los formatos custom se normalizan a `.dump.gz` y se restauran con `pg_restore
  --exit-on-error --create --no-owner --no-privileges` en el sandbox.

Un custom dump de una sola base no contiene todos los roles globales del servidor.
La prueba valida esquema/datos/restricciones; en ese sandbox omite la asignación
de propietarios y privilegios. El original no se modifica. La recuperación real
requiere recrear/verificar roles y secretos mediante su runbook; no se afirma que
esta comprobación arranque o recupere toda la aplicación. SQL de cluster conserva
su semántica de roles según el contenido del dump.

Se aplican los límites y condiciones de aislamiento de `HUB_RECOVERY.md`, incluidos
512 MiB, imagen oficial local compatible, locks y ausencia de red/volúmenes
productivos en el contenedor DB temporal. Los archivos inválidos no se reparan ni
se eliminan: se conserva evidencia y se requieren copias válidas para cobertura.

## Jobs y recuperación

Los jobs `backup-import` admiten cancelación pendiente, reintento explícito de fallo
confirmado y reconciliación de resultado incierto. No hay repetición automática.
La reconciliación necesita procedencia y prueba aprobada del mismo job, checksum
actual y ausencia del lock que requiere revisión. Un archivo renombrado sin
publicación confirmada no permite inventar un resultado exitoso.

Cada invocación del scheduler ejecuta como máximo una clase de trabajo costoso:
backups primero, luego restores y luego imports si las anteriores no tienen
trabajo. Así no acumula tres operaciones largas dentro de una petición.

## Evidencia de pruebas

`backup-import.test.cjs`: SQLite real temporal, publicación posterior a prueba,
descarga de staging bloqueada, conservación del original, hash/procedencia,
deduplicación, revocación del actor, rutas y productos protegidos, cambio de origen
y copia con claves foráneas rotas. Symlinks se comprueban en Linux (CI).

`restore-sandbox-smoke.cjs`: dumps nativos sintéticos MariaDB 11.8.9 y PostgreSQL
16/17, importación real, dedupe y conservación; PostgreSQL incluye custom binario.
Los tests HTTP comprueban CSRF, roles, recursos protegidos e inventario por alcance;
la interfaz prueba selección y solicitud en escritorio y móvil. Los fixtures nunca
se usan como fuente de datos productivos.
