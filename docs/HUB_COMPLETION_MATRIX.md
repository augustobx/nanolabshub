# Matriz de cierre de NanoHub

Seguimiento del plan aprobado el 23/10/2026. Un casillero pendiente no acredita
funcionalidad terminada. Los hallazgos H01–H27 están documentados en
`AUDIT_NANOHUB_20261023.md`. PR #6 desplegado con revisión `18cdcfae`: identidad, permisos y cola de backups; CI 40054237580 aprobado.

## Nueve pendientes de la auditoría

| ID | Entregable | Evidencia exigida | Estado |
| --- | --- | --- | --- |
| C01 | Usuarios, roles, MFA | Bootstrap único, hash resistente, TOTP/recovery de un uso, autorización por recurso y UI real | Desplegado y probado en aislamiento; falta enrolamiento MFA del propietario real |
| C02 | Revocación persistente | Cookie copiada rechazada tras logout, revocación, cambio de contraseña/permisos; idle/TTL | Desplegado; cookie revocada rechazada en producción y en API aislada |
| C03 | Deploy seguro desde Hub | Manifest efectivo, imagen, backup, CI, salud, rollback, vecinos intactos | Pendiente |
| C04 | Réplica externa automática | Copia cifrada independiente y recuperación desde el remoto | Preparación pendiente; el usuario confirmó que todavía no tiene destino |
| C05 | Restore MariaDB/PostgreSQL | Instancias temporales aisladas y evidencia por motor | Implementado; dumps sintéticos nativos restaurados con versiones locales oficiales, cola y evidencia por hash; release de esta rama pendiente |
| C06 | Jobs recuperables | Claim atómico, lease, reintento, resultado incierto y reconciliación | Backups desplegados y probados; esta rama extiende cola a restores sin repetición incierta |
| C07 | Retención | Política explícita, archivo íntegro y recuperación antes de purga | Pendiente |
| C08 | Lint obligatorio | ESLint CLI sin interacción ni warnings; gate en CI | Gate obligatorio aprobado en PR #6; se conserva para cada release |
| C09 | Importación de backups | Pertenencia, hash, formato, restore y deduplicación | Pendiente |

## Cobertura de módulos

| Pantalla | Fuente / acciones | Evidencia y regresión de cierre |
| --- | --- | --- |
| Inicio | Governance, operaciones, telemetría y alertas reales | Resumen consistente con fuentes; vacío/error; UI escritorio/móvil |
| Superadmin | Catálogos de operaciones autenticados | Capacidades confirmadas, permisos y enlaces válidos |
| SaaS y ficha | Registry + governance + operaciones | Configuración separada de mediciones; conectores inaccesibles visibles |
| Gestión SaaS | Contratos OnlyFood, OnlyGym y OnlyTurn | Lecturas y comandos, versiones, idempotencia, aislamiento, permisos |
| Governance | Tenants del conector y acceso a gestión | Conteos, paginación, filtros, modal y enlaces; sin mensaje global falso de bloqueo |
| Legacy | Capacidades compartidas | Fichas coherentes con catálogos actuales; exclusiones explícitas |
| Operaciones | Docker/health/Git/lifecycle | Estado real, autorización, errores, concurrencia y recuperación |
| Software | Versiones y releases | Revisión identificada, deploy como job y logs acotados |
| Infraestructura | Inventario Docker y host | Estados paused/starting/restarting, jobs finalizados y datos desconocidos |
| Hardware | Telemetría y mantenimiento | Datos frescos; mantenimiento acotado; sin prune global |
| Networking | Registry, puertos y comprobaciones HTTP | Links reales, estado desconocido visible, sin exponer bases |
| Seguridad | Estado de identidad/conectores/réplica | Capacidades efectivas; ninguna afirmación por configuración solamente |
| Mi cuenta | Usuarios, MFA y sesiones propias persistidas | Enrolamiento, recuperación, permisos, revocación y cambio de contraseña |
| Auditoría | SQLite del Hub sanitizado | Actor individual y resultado, sin secretos ni pérdida de historial |
| Continuidad | Copias y pruebas de restore | Cobertura por motor; última recuperación; ausencia visible |
| Backups | Registro, archivos, jobs, agendas, réplica | Crear, importar, descargar, replicar, restaurar en aislamiento y reintentar |
| Login | Identidad Hub + desafío MFA | Formulario real, límites, cookies revocables, redirect local y MFA obligatorio |

## APIs y tareas

Base auditada: 27 archivos `route.ts`. Esta rama agrega account, users, MFA y jobs.
La prueba de cobertura debe detectar rutas nuevas sin registro explícito.

| Grupo | Rutas | Contrato de acceso |
| --- | --- | --- |
| Público | `/api/health`, `/api/auth/login`, `/api/auth/mfa` | Health sin datos privados; login/MFA limitados y con cuerpos acotados |
| Cuenta | `/api/auth/account`, `/api/auth/logout` | Sesión propia, origen en POST; enrolamiento limitado |
| Usuarios | `/api/auth/users` | Propietario con MFA; cambios requieren verificación reciente |
| Lecturas | apps, operations, telemetry, telemetry/history, infrastructure, governance, alerts, audit, security/summary | Sesión persistente con MFA; fallos sin fallback saludable |
| Logs | apps/logs, apps/logs/stream | Propietario u operador asignado al recurso; límites y cancelación |
| Lifecycle | apps/lifecycle GET/POST | Lectura autenticada; cambio con MFA reciente, alcance y protección de productos |
| Releases | apps/deploy, apps/deploy/stream | Bloqueados hasta cumplir C03; luego rol, alcance y revisión verificadas |
| Gestión | saas-management/[slug] GET/POST | Aplicación autorizada; mutaciones con MFA reciente y contrato firmado |
| Backups | backups GET/POST, backups/schedule, backups/download, backups/restore-check | Lectura autenticada; descarga restringida; cambio por app y MFA reciente |
| Scheduler | backups/schedule/run POST | Clave de máquina independiente; ninguna sesión humana la sustituye |
| Jobs | jobs GET/POST | Lectura por alcance; reintento/cancelación/reconciliación con MFA reciente y recurso autorizado |
| Legado retirado | governance/status, governance/module, docker/prune | Sin operación genérica peligrosa; respuesta explícita de retirada |

## Condiciones transversales

- OnlyPadel, OnlyCars, OnlyERP y sus bases excluidos de mutaciones y trabajos.
- Fixtures limitados a localhost y datos temporales; sin rutas productivas simuladas.
- Sin escrituras de prueba sobre datos de negocio productivos.
- Migraciones aditivas del Hub, backup consistente y rollback por imagen.
- Tipado, lint, tests, build y UI obligatorios antes de publicar.
- Comprobación HTTPS, salud y contenedores vecinos después de cada release.
- No marcar C01–C09 completos sin la evidencia que les corresponde.
