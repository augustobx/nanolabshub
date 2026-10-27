# OnlyShop: integración con NanoHUB

OnlyShop reside en `/opt/apps/onlyshop`, servicio `onlyshop-web`, dominio
`onlyshop.nanoapps.ar`. Next.js 16.4.3, Prisma 7.10.1 y SQLite persistido en
`onlyshop_data:/app/prisma/dev.db`. El Hub monta ese volumen en modo lectura
en `/opt/apps/onlyshop/data`; no escribe datos de negocio mediante SQL.

Gestión: `/saas/onlyshop/manage`. Ambos conectores requieren selección explícita
de `onlyshop` y claves distintas: `HUB_INTEGRATION_ONLYSHOP_TOKEN` y
`HUB_MANAGEMENT_ONLYSHOP_TOKEN` en el Hub; `HUB_INTEGRATION_TOKEN` y
`HUB_MANAGEMENT_TOKEN`, con sus interruptores, exclusivamente en el web OnlyShop.
El contrato de gestión valida Bearer y HMAC, actor y timestamp de hasta 60 segundos.

Once operaciones: alta, identidad y estado de tenants; asignación y renovación
de suscripción; módulos; actualización y revocación de administradores; alta y
edición de planes; registro de pagos SaaS en ARS. Identificador de tenant
inmutable. Módulos `pwaEnabled` y `accountsEnabled`; límite `maxProducts`.
Se conservan ventas, usuarios, productos, IDs y configuración de comercio.
Renovar no crea un pago. Registrar con cero días conserva el vencimiento.
La administración no crea DNS, certificados ni envía dinero.

OnlyShop tenía login simulado y Server Actions sin sesión. Se incorpora login
real por hostname, cookies HttpOnly, sesiones persistidas y revocables,
contraseñas scrypt, roles y comprobación de estado/vencimiento en servidor.
Las contraseñas históricas se conservan hasta un acceso válido, cuando se
convierten a hash sin cambiar la contraseña. El panel de plataforma anterior
redirige al Hub y sus acciones quedan bloqueadas. Las excepciones de módulos
se aplican a APIs, acciones, navegación y páginas; el cupo de productos se
comprueba dentro de la transacción de alta. Se cierran accesos a IDs ajenos y
la tienda recalcula precios desde los productos publicados del propio comercio.

Esquema aditivo: `HubTenantSettings`, `HubPlanSettings`, `HubSession`,
`HubLoginAttempt`, `HubPayment` y `HubCommand`. Ninguna columna histórica se
renombra o elimina. Los comandos y su auditoría se confirman en una transacción
SQLite inmediata; UUID y huella impiden duplicar operaciones concurrentes.

Backups, importación y restauración SQLite aislada habilitados. Reinicio y ciclo
de vida genéricos protegidos, igual que OnlyCars/OnlyERP. La copia externa
automática general continúa fuera del alcance previamente acordado.

Respaldo inicial restaurado: 15 tablas, 2 tenants, 1 plan, 4 usuarios y 8 productos.
SHA-256 `f3a44adacf9e9850f574c78a08636c55555ec1007dcec4893c9e1f22f08fef48`.
También se conserva una copia en la PC. Es evidencia inicial, no del estado
posterior ni de un RTO completo. Rollback por imagen/manifiesto, conservando
la base viva y las tablas aditivas; no restaurar datos para revertir el web.

Evidencias privadas: `/home/augusto/onlyshop-hub-20261026` y
`C:\Users\abasq\.codex\artifacts\onlyshop-hub-20261026`.
El cierre productivo se documenta después de ejecutar sus verificaciones.
