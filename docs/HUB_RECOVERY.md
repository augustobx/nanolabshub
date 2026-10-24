# Restauraciones aisladas de NanoHub

Alcance: NanoHub (SQLite), OnlyFood (MariaDB), OnlyGym y OnlyTurn (PostgreSQL).
OnlyPadel, OnlyCars y OnlyERP quedan excluidos también en los motores internos.
Ninguna prueba reemplaza una base productiva ni inicia la aplicación del cliente.

## Contrato y evidencia

`POST /api/backups/restore-check` recibe `{backupId, requestId}` con UUID y devuelve
202 con `{jobId,state}`. Exige MFA reciente, origen exacto y permiso por app.
El scheduler procesa el trabajo persistente; cerrar la pantalla no lo cancela.
Reintentos explícitos, cancelación de pendientes y reconciliación están en Jobs.
El actor se verifica otra vez antes de ejecutar; desactivarlo impide ejecutar.

Se verifican gzip, tamaño y SHA-256 antes de abrir el archivo y nuevamente antes
de registrar aprobación. La evidencia está vinculada al checksum y al trabajo.
El último fallo invalida la aprobación mostrada. Evidencia histórica sin checksum
se conserva, pero no acredita los bytes actuales. Un archivo ausente o modificado
no figura como restauración vigente. Los detalles no incluyen filas ni secretos.

SQLite abre una copia temporal con permisos privados, comprueba integridad completa
y claves foráneas y cuenta filas por tabla. Nunca abre el original para escribir.

MariaDB/PostgreSQL usan el ID local de la imagen oficial del contenedor de base
registrado. Solo se lee su metadata; no se ejecuta SQL en ese contenedor. La copia
se importa mediante herramientas de esa imagen a un contenedor nuevo con nombre
aleatorio y etiqueta de pertenencia. Se comprueban ID y etiqueta antes de operar
y limpiar. No se usa un nombre del navegador como destino de SQL.

El sandbox tiene red `none`, ningún puerto publicado, ningún bind/volumen de
producción ni socket Docker, usuario de base sin root, capacidades vacías, raíz
de solo lectura, tmpfs acotados, límite de 1 CPU/1 GiB y 128 procesos. Las únicas
variables son valores sintéticos para inicializar la copia. MariaDB ignora grants
en ese sandbox sin red para que las cuentas contenidas en un dump completo no
impidan inspeccionarlo; no se copian contraseñas productivas al entorno.

MariaDB realiza `mariadb-check`, cuenta filas y busca huérfanos por cada clave
foránea, incluidas claves compuestas. PostgreSQL importa con `ON_ERROR_STOP`,
verifica restricciones validadas y cuenta tablas/filas en cada base restaurada.
Los conteos describen la copia. Los backups actuales no incluyen un manifiesto de
conteos consistente del origen: no se afirma una comparación contra producción.
Una validación de motor tampoco acredita el flujo completo de la aplicación.

## Límites y recuperación de interrupciones

Máximo 512 MiB comprimidos/descomprimidos, 64 bases, 2000 tablas y diez minutos por
restauración SQL. Datos mayores requieren un procedimiento aislado con capacidad
dimensionada. Un lock privado global limita los sandboxes entre procesos del Hub.
La cola renueva lease cada 20 segundos y no reintenta automáticamente una prueba.
El heartbeat del scheduler tolera hasta 35 minutos; su petición admite 32 minutos
para el backup y la restauración procesados secuencialmente.

Si muere el Hub o no se confirma la limpieza, el job queda incierto y se conserva
el bloqueo. No se borra por antigüedad. El operador debe revisar el job, el lock,
los procesos y los contenedores `nanohub-restore-*`; demostrar ID, etiqueta y
pertenencia antes de limpiar únicamente el sandbox interrumpido. Nunca usar prune
ni seleccionar bases existentes. Si falta evidencia de restauración aprobada, no
se fuerza un éxito. La reconciliación exige prueba del mismo job y checksum actual,
además de ausencia del lock que necesita revisión.

Antes de cambiar versiones de motores, comprobar compatibilidad de sus backups
históricos. Actualmente la imagen de prueba proviene del contenedor registrado
vigente; no hay descarga automática de imágenes ni selección arbitraria desde UI.

## Pruebas reproducibles

`node --test scripts/recovery-engine.test.cjs scripts/restore-evidence.test.cjs
scripts/restore-sandbox.test.cjs scripts/recovery-runner.test.cjs` prueba SQLite,
evidencia, alcance, cola, revocación del actor, incertidumbre y reconciliación.

`node scripts/restore-sandbox-smoke.cjs` requiere Docker e imágenes oficiales
locales `mariadb:11.8.9`, `postgres:16-alpine` y `postgres:17-alpine`. Crea bases
sintéticas, hace dumps nativos y restaura en otros sandboxes. Comprueba 2 tablas,
5 filas, relaciones y rechazo de SQL inválido y de claves foráneas huérfanas.
Nunca inspecciona ni inicia un contenedor productivo. El CI ejecuta esta prueba.

Pendientes del plan general: importación verificada de archivos externos, réplica
cifrada y recuperación desde un destino independiente aún no disponible, agendas
y evidencia por recurso, despliegue desde Hub, retención y aceptación final.
