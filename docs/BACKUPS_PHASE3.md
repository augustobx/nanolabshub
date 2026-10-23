# Fase 3 — Backups reales de NanoLabs Hub

## Alcance

Se sustituyó el ejecutor heredado que usaba `sudo` y una contraseña codificada en el repositorio y que clasificaba archivos como «verificados» según su tamaño.

El nuevo motor `scripts/backup-engine.cjs` implementa:
- MariaDB/MySQL: `mariadb-dump` o `mysqldump` ejecutado dentro del contenedor **registrado**, con credenciales internas del contenedor y opciones de transacción, tablas, rutinas, triggers y eventos.
- PostgreSQL: `pg_dumpall` desde el contenedor de PostgreSQL registrado.
- SQLite: API `node:sqlite.backup` con captura en caliente y `PRAGMA quick_check` del snapshot.
- Compresión gzip, archivos temporales exclusivos, cancelación por timeout de 15 minutos, límite de 8 GB sin comprimir y espacio libre mínimo de 1 GB.
- Verificación gzip/SHA-256 antes de hacer visible el archivo definitivo.
- Registro persistente y trazabilidad de cada intento en `/app/data/hub.sqlite` (`backup_jobs`).
- Descarga desde el navegador solo con sesión autenticada, hash recomprobado y ruta de archivo fija en `/opt/backups/<slug>/`.
- Programación diaria o semanal a una hora argentina seleccionada, ejecutada por un servicio separado `nanolabshub-backup-scheduler` que sondea cada cinco minutos.
- Indicador del último backup íntegro al archivar una aplicación.

**Importante:** «Integridad OK» significa que gzip se descomprimió, tiene contenido y coincide con el hash SHA-256. **No significa que se haya realizado una restauración de prueba**. El Hub NO expone un botón para restaurar automáticamente en producción. Tampoco existe copia externa comprobada.

## Límites deliberados de esta entrega

- **Retención y eliminación automática** no activadas: no se borra ningún backup sin antes añadir políticas, confirmación y una segunda copia.
- **Restauración**: se realiza por procedimiento manual documentado, en un entorno aislado antes de cualquier reemplazo productivo.
- No se respaldan Redis ni volúmenes de archivos/carpeta `uploads`; son copias de bases de datos, no un snapshot total de una aplicación.
- **GastosApp** figura `dbType: none` en el registro actual aunque guarda datos en un volumen. No prometer cobertura de esa información hasta identificar su backend real. No archivar definitivamente sin respaldo independiente.
- Si el contenedor Docker no suministra las credenciales habituales (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `MARIADB_ROOT_PASSWORD`, `MYSQL_ROOT_PASSWORD`), el backup falla explícitamente y se registra como fallido.
- Para MariaDB/MySQL, `--single-transaction` exige tablas transaccionales para una captura consistente. Revisar las tablas no-InnoDB antes de aceptar el backup como recuperable.

## Preparación del servidor (una sola vez)

La rama es `design/governance-hub-redesign-0.1.0`; no se aplica automáticamente a producción.

1. Respaldar primero `/opt/apps/nanolabshub/data/hub.sqlite` mediante el procedimiento externo habitual (sin detener otros servicios).
2. Generar una clave privada para el scheduler (no pegarla en el chat):

```bash
openssl rand -hex 32
```

3. En `/opt/apps/nanolabshub/.env`, establecer una clave exclusiva para `HUB_BACKUP_SCHEDULER_KEY` usando el valor generado, con `chmod 600`.
4. El archivo `compose.backups.yml` **no se incluye** por defecto en la configuración actual. Para habilitar la fase:

```bash
cd /opt/apps/nanolabshub-redesign
git pull --ff-only origin design/governance-hub-redesign-0.1.0
export BUILD_REVISION="$(git rev-parse HEAD)"
export HUB_BACKUPS_ENABLED=true
cd /opt/apps/nanolabshub

docker compose \
  -f docker-compose.yml \
  -f /opt/apps/nanolabshub-redesign/compose.preview.yml \
  -f /opt/apps/nanolabshub-redesign/compose.lifecycle.yml \
  -f /opt/apps/nanolabshub-redesign/compose.backups.yml \
  up -d --build --no-deps nanolabshub nanolabshub-backup-scheduler
```

El segundo servicio solo consulta un endpoint interno autenticado. No requiere montar el socket Docker en el scheduler.

**Conservar las mismas capas Compose** en despliegues posteriores para evitar perder `HUB_BACKUPS_ENABLED` y la clave de ejecución. La gestión de ciclo de vida sigue su propio interruptor `HUB_LIFECYCLE_ENABLED`.

### Scheduler: revisión del healthcheck (22/10/2026)

El programador usa la misma imagen que la web, pero **no** abre el puerto HTTP 3000.
Antes heredaba el `HEALTHCHECK` web y podía aparecer `unhealthy` aun estando activo.

Ahora `compose.backups.yml` usa `scripts/backup-scheduler-health.cjs`, que comprueba que
el programador haya recibido una respuesta válida y autenticada del endpoint interno
del Hub durante los últimos 35 minutos. El primer sondeo ocurre al iniciar el
proceso y luego cada cinco minutos. Un `healthy` **no** significa que los dumps
programados se restauraron ni que las bases están íntegras; solo confirma
comunicación del programador con el backend.

Para comprobar la causa del estado anterior sin modificar nada:

```bash
docker logs --tail 40 nanolabshub-backup-scheduler
docker inspect --format='{{range .State.Health.Log}}{{.ExitCode}} {{.Output}}{{end}}' nanolabshub-backup-scheduler | tail -c 600
```

Para corregirlo **sin reiniciar el Hub ni otras aplicaciones**, actualizar solamente
la rama de revisión y luego, tras verificar `docker compose ... config --quiet`,
reconstruir la imagen `nanolabshub` y recrear únicamente el servicio
`nanolabshub-backup-scheduler`, usando siempre las cinco capas Compose ya
configuradas, incluida `compose.integrations.yml` con
`HUB_SAAS_INTEGRATION_ENABLED=false`. No se tocan bases, volúmenes ni migraciones.

Si después de recrear sigue `unhealthy`, verificar logs por credenciales del
scheduler (no imprimir secretos), HTTP 403/503 y red Docker. No afirmar que
los backups automáticos funcionan hasta revisar historial y horarios.

### Comprobación

```bash
docker inspect --format='{{.State.Health.Status}}' nanolabshub
docker ps --filter name=nanolabshub-backup-scheduler
docker logs --tail 30 nanolabshub-backup-scheduler
```

Entrar en `/backups` y ejecutar manualmente un backup de una base pequeña. Esperar «Integridad OK» y descargar el archivo. No restaurar sobre el servicio productivo para comprobarlo.

### Restauración de prueba, en entorno aislado

- SQL: crear una **nueva** instancia temporal del motor correspondiente, con un volumen completamente nuevo; restaurar el dump allí y verificar tablas, esquema y filas. No apuntar jamás a la base productiva al ensayar.
- SQLite: descomprimir a un directorio temporal nuevo, ejecutar `PRAGMA quick_check` en esa copia e iniciar una aplicación de prueba aislada si es necesario.
- Comprobar tamaño, hash SHA-256, consistencia lógica y fecha antes de considerar una copia «restaurable».
- No borrar manualmente `*.part` ni `backup-<slug>.lock` mientras pueda existir una operación en curso. En caso de crash, inspeccionar el proceso primero.

## Estado de seguridad

El backend exige sesión administrativa para consultas y descarga; los cambios de configuración/manuales requieren además petición del mismo origen. El disparador programado requiere una clave compartida de 32+ caracteres, distinta de la contraseña del Hub.

No se crean nuevos hosts Nginx, no se altera ningún repositorio de aplicaciones ni se borran volúmenes o bases.
