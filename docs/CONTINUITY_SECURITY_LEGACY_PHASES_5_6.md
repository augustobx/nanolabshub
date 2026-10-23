# NanoLabs Hub — Fases 5 y 6: continuidad, seguridad y retiro del legado

**Rama:** `design/governance-hub-redesign-0.1.0`  
**Estado:** en revisión; no fusionada ni desplegada automáticamente.

## Cambios implementados

### Continuidad y recuperación (fase 5)

- `/continuity`: cobertura por aplicación, copias íntegras, estado de pruebas aisladas y brechas de almacenamiento externo.
- `/api/backups/restore-check` autenticada y con control de origen: verifica archivos SQLite registrados por ID y checksum, los descomprime en un directorio temporal nuevo y ejecuta `quick_check`, `integrity_check` y `foreign_key_check` sobre la copia.
- Nunca reemplaza el origen SQLite, no ejecuta `prisma migrate` ni restaura datos sobre bases de producción.
- Los resultados se guardan en `backup_restore_checks` del SQLite del propio Hub y se agregan al registro local de auditoría. Las carpetas temporales se eliminan.
- Límite de descompresión de 512 MB, precondición de 1 GB libre y exclusión de validaciones simultáneas del mismo ID por proceso.
- El estado "copia SQLite validada" **no** implica que la aplicación arrancó usando esos datos.
- Para PostgreSQL y MariaDB aún se requiere restauración en un contenedor aislado con credenciales propias y comprobación lógica. Esta etapa no ofrece un botón de restauración automática para esos motores.

### Seguridad y auditoría (fase 5)

- `/security`: estado de credenciales, configuración de backups, lifecycle, integración por token de cada SaaS, y pendientes de MFA/RBAC/segundo almacenamiento.
- `/api/security/summary`: acceso autenticado; devuelve solo booleanos de configuración y cobertura, nunca tokens ni valores de credenciales.
- `/audit` y `/api/audit`: historial local de acciones con filtro y sanitización de posibles contraseñas y tokens.
- `/api/alerts` ahora requiere sesión y no queda abierto para lectura de auditoría e infraestructura.
- La auditoría no es inmutable ni representa todavía eventos internos de los productos SaaS.

### Transición del legado (fase 6)

- `/legacy`: inventario de las **siete** SaaS con lectura por conector, escritura y acceso delegado, y auditoría; se muestra el progreso sin declarar paneles absorbidos cuando no están completos.
- Los paneles Superadmin anteriores no se eliminan ni se redirigen. No hay escrituras automáticas sobre tenants ni cambios de módulos desde Hub.
- Sidebar y cabecera incorporan Seguridad, Auditoría, Recuperación y Migración de paneles.

## Incidencias registradas, no bloqueantes para nuevas vistas

1. **Scheduler de backups: HTTP 401**, confirmado después de recrearlo con healthcheck corregido. Es un problema pendiente de autenticación/configuración y **sí bloquea la automatización de backups** hasta resolverse. No se considera scheduler saludable ni se deben contar ejecuciones programadas exitosas por el simple hecho de tener la función habilitada.
2. Integraciones de tenants de las SaaS con `HUB_SAAS_INTEGRATION_ENABLED=false`; nuevas APIs de solo lectura permanecen en PR draft separados. Sin activar, se ve "No conectado", no "0 tenants".
3. OnlyMob: su pipeline reportó vulnerabilidades de dependencias; no se recomienda desplegar su integración mientras el control esté bloqueado.
4. Rotación de contraseñas heredadas, permisos por rol, MFA, auditoría global y backups fuera del servidor permanecen pendientes. Se requieren secretos gestionados y revisión individual.
5. No se ha realizado una restauración total de la aplicación desde un backup, ni de MariaDB/PostgreSQL en entornos aislados.

## Puertas antes de un despliegue productivo

- Verificar CI de la rama y revisar las pantallas nuevas en PC y celular.
- Confirmar `HUB_BACKUPS_ENABLED`, `HUB_LIFECYCLE_ENABLED` y `HUB_SAAS_INTEGRATION_ENABLED=false` al evaluar Compose.
- Conservar copias de rollback del contenedor y del SQLite del Hub.
- Desplegar exclusivamente `nanolabshub` con `--no-deps`, sin tocar servicios de OnlyFood, OnlyPadel, OnlyCars, OnlyERP ni sus DB, ni ejecutar migradores o seeds.
- Validar `/api/health`, `/continuity`, `/security`, `/audit`, `/legacy` tras el despliegue.
- Antes de habilitar la API de recuperación en producción, verificar espacio libre suficiente y ejecutar la primera comprobación sobre una copia SQLite pequeña y registrada del propio Hub.

## Protección permanente de las bases críticas

OnlyFood, OnlyERP, OnlyPadel y OnlyCars: **sin escrituras directas, alteración de esquemas, reinicios de contenedores de BD, seeds, migraciones ni restauraciones automáticas**. No mezclar estos cambios con tareas de housekeeping.

**Criterio de finalización:** el rediseño y las herramientas de diagnóstico pueden completarse por etapas. El proyecto Superadmin integral no estará completo hasta que cada SaaS implemente y pruebe RBAC, contratos mutativos, auditoría, reversión y conmutación desde su propio admin.
