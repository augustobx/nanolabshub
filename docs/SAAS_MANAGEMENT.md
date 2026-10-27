# Administración central de OnlyGym, OnlyTurn, OnlyFood, OnlyCars, OnlyERP y OnlyShop

El Hub ofrece administración desde `/saas/onlygym/manage`,
`/saas/onlyturn/manage`, `/saas/onlyfood/manage`, `/saas/onlycars/manage`
y `/saas/onlyerp/manage` y `/saas/onlyshop/manage`,
sujeta a habilitación y respuesta del conector real. La lista permitida está fijada
en código. OnlyPadel y los demás productos no pueden utilizar este proxy,
incluso si se agregan por error a las variables de configuración.

## Contrato y autorización

OnlyShop quedó integrado el 27/10/2026. Requiere `onlyshop` en ambas listas y
claves independientes `HUB_MANAGEMENT_ONLYSHOP_TOKEN` y
`HUB_INTEGRATION_ONLYSHOP_TOKEN`. Ofrece once operaciones, planes ARS,
administradores por correo, PWA/cuentas corrientes y límite de productos.
Planes y auditoría usan `{items,nextOffset}`. No ofrece `payment.status` ni
`domain.add`. Backups SQLite cada seis horas con restauración aislada; ciclo de
vida y reinicio genéricos protegidos. Ver `ONLYSHOP_INTEGRATION_20261026.md`.

El contrato `nanolabs.saas.management.v1` vive en cada SaaS en
`/api/integrations/nanolabs/management`. El contrato anterior de lectura conserva
sus capacidades `tenantWrite=false` y `moduleWrite=false`.

Configurar en ejecución, fuera del repositorio y del contexto Docker:

| Servicio | Variables |
| --- | --- |
| OnlyGym web | `HUB_MANAGEMENT_ENABLED=true`, `HUB_MANAGEMENT_TOKEN` |
| OnlyTurn app | `HUB_MANAGEMENT_ENABLED=true`, `HUB_MANAGEMENT_TOKEN` |
| OnlyFood app | `HUB_MANAGEMENT_ENABLED=true`, `HUB_MANAGEMENT_TOKEN` |
| OnlyCars app | `HUB_MANAGEMENT_ENABLED=true`, `HUB_MANAGEMENT_TOKEN`, `HUB_INTEGRATION_ENABLED=true`, `HUB_INTEGRATION_TOKEN` |
| OnlyERP web | `HUB_MANAGEMENT_ENABLED=true`, `HUB_MANAGEMENT_TOKEN`, `HUB_INTEGRATION_ENABLED=true`, `HUB_INTEGRATION_TOKEN` |
| Hub web | `HUB_SAAS_MANAGEMENT_PRODUCTS=onlygym,onlyturn`, `HUB_MANAGEMENT_ONLYGYM_TOKEN`, `HUB_MANAGEMENT_ONLYTURN_TOKEN` |

Para sumar OnlyFood, agregar `onlyfood` a la lista explícita e inyectar
`HUB_MANAGEMENT_ONLYFOOD_TOKEN`. Su lectura requiere además
`HUB_INTEGRATION_ONLYFOOD_TOKEN` y la selección explícita en
`HUB_SAAS_INTEGRATION_PRODUCTS`. Sin ambas configuraciones no se habilita.

OnlyCars requiere añadir `onlycars` a ambas listas explícitas del Hub y las claves
independientes `HUB_MANAGEMENT_ONLYCARS_TOKEN` y `HUB_INTEGRATION_ONLYCARS_TOKEN`.
Su habilitación fue autorizada expresamente; no habilita cambios en otros SaaS.
La configuración efectiva de OnlyCars usa `.env.docker`.
Los reinicios y el ciclo de vida genéricos de sus contenedores continúan bloqueados;
la autorización del Hub habilita la administración por contrato y sus backups,
importaciones y restauraciones de prueba aisladas.

El catálogo de OnlyCars informa 12 operaciones, planes en USD, identificador de
tenant inmutable, contacto, dominios y pagos recibidos con moneda y período.
`domain.add` exige una declaración explícita de verificación manual de titularidad,
DNS y HTTPS; no configura estos servicios. `payment.status` no existe en OnlyCars.
Un pago de período vigente activa la suscripción; uno histórico o futuro conserva
el acceso. La renovación independiente no inventa pagos. Los módulos ejecutados
son `pwa_clientes`, `seller_pwa` y `branding_documentos`; el resto de las funciones
históricas del plan se conserva. Sus límites son vehículos, usuarios y sedes.
Las nuevas marcas de gestión tienen valor inicial falso para conservar el
comportamiento anterior al despliegue. La migración agrega tres booleanos, sin
renombrar tablas, resembrar datos ni tocar el esquema histórico adicional.

OnlyERP requiere `onlyerp` en ambas listas y claves independientes
`HUB_MANAGEMENT_ONLYERP_TOKEN` / `HUB_INTEGRATION_ONLYERP_TOKEN`. Quedó
desplegado el 26/10/2026: 11 operaciones, planes ARS, administradores por
username y cobros por mes/año. La membresía reside en las fechas del tenant;
renovar no inventa pagos. No ofrece `domain.add` ni `payment.status`.
Aplica 15 módulos y límites de usuarios, sucursales y depósitos en servidor;
revocar acceso incrementa la versión de sesión. Sus backups/importaciones y
restores aislados MySQL están habilitados; el ciclo de vida genérico permanece
protegido. Ver `ONLYERP_INTEGRATION_20261026.md` para pruebas y recuperación.

OnlyFood usa MariaDB y capacidades propias: estado PAST_DUE, fin de prueba,
acceso efectivo, dominios conservados, integraciones sanitizadas y ciclo de pagos
PENDING/PAID/OVERDUE/REFUNDED/VOID. `payment.status` está permitida solo para
OnlyFood. Los formularios se habilitan por su catálogo; los otros dos conectores
conservan su contrato. Un reembolso registrado no envía dinero al proveedor.
La versión de OnlyFood incluye filas administrativas relacionadas y timestamps
nativos, y su PK de auditoría reclama el UUID en la misma transacción MariaDB.
No se ejecutan locks de PostgreSQL ni se accede a MariaDB desde el Hub.

Generar una clave distinta de al menos 32 bytes para cada producto. Debe ser
distinta de su token de lectura. No inyectar claves nuevas en bases, migradores,
workers o scheduler. OnlyGym/OnlyTurn/OnlyFood usan `HUB_MANAGEMENT_OPERATIONS`
para restringir las operaciones; OnlyCars expone 12 operaciones y OnlyERP 11.
El catálogo autenticado informa las capacidades reales de cada conector.

Todas las solicitudes usan Bearer y HMAC SHA-256 con esa clave. Se firma el texto
`timestamp + "\n" + method + "\n" + pathnameAndQuery + "\n" + actor + "\n" + body`.
Los encabezados son `X-NanoLabs-Timestamp` (milisegundos; tolerancia 5 minutos
en los conectores anteriores, 60 segundos en OnlyCars y OnlyERP),
`X-NanoLabs-Actor` y `X-NanoLabs-Signature` (hexadecimal). GET firma cuerpo vacío.
El Hub deriva el actor de su sesión administrativa y fija el destino mediante el
registro de productos; el navegador no conoce claves ni selecciona una URL.
Las escrituras exigen sesión y mismo origen. No hay acceso directo a las bases
desde el Hub ni fallback SQL.

## Operaciones

GET admite `resource=catalog|plans|tenant|audit`, `tenantId` y `offset`.
Planes y auditoría se paginan de a 100. El detalle incluye administradores,
módulos efectivos, suscripción y los últimos 100 pagos SaaS.

POST recibe `{requestId, actor, operation, input}`. Sus operaciones son:

- `tenant.create`, `tenant.update`, `tenant.status`.
- `subscription.update`, `subscription.renew`.
- `module.set` (override o herencia; límites numéricos donde corresponde).
- `admin.update`, `admin.revoke`.
- `plan.create`, `plan.update`.
- `payment.record` (centavos ARS, referencia única y extensión explícita opcional).

Las actualizaciones exigen la versión recibida en el detalle. Una versión vieja
devuelve 409 y requiere actualizar datos. Cambios, versión y recibo de auditoría
se confirman en la misma transacción. El UUID y la huella del cuerpo evitan
duplicar una operación concurrente: repetir el mismo comando devuelve el recibo;
reutilizar el UUID con otro contenido devuelve 409. Ante respuesta incierta, la
pantalla conserva el comando en memoria y reintenta exactamente ese UUID.

Activar no renueva una suscripción vencida: la renovación requiere una acción
explícita. Retirar un plan conserva sus suscripciones actuales. Los cambios de
credenciales y la revocación invalidan sesiones nativas. Se rechazan usuarios de
otro tenant y cuentas compartidas. No se exportan contraseñas, hashes o tokens a
lecturas ni auditoría. No existen operaciones de borrado o suplantación de sesión.
Los cobros a clientes del negocio siguen en el SaaS; aquí se registran pagos de
la suscripción a la plataforma. OnlyTurn usa su auditoría nativa para esos pagos.

## Validación y despliegue

Pruebas del Hub: `npx tsc --noEmit`,
`node --test scripts/saas-bridge.test.cjs scripts/saas-management.test.cjs` y
`node scripts/management-ui-smoke.mjs` contra el Hub local. La prueba de UI usa
datos simulados y valida escritorio, celular, conflictos y reintentos idempotentes.
Las pruebas SaaS de escritura y login nativo solo admiten una base aislada con
hostname `hub-test-db` y `HUB_MANAGEMENT_TEST_ALLOW_MUTATIONS=isolated-only`.
Nunca ejecutar esos scripts contra producción.

Antes de desplegar: respaldar PostgreSQL de ambos productos y SQLite del Hub,
restaurar copias en entornos aislados, conservar copia fuera del servidor,
guardar imágenes rollback y argumentos Compose vigentes. Construir desde commits
verificados sin archivos `.env`. Recrear exclusivamente los tres servicios web
con `--no-deps --no-build`; no ejecutar migradores ni reiniciar bases o workers.

Verificar salud, HTTPS, rechazo anónimo y firma inválida, lectura de catálogo,
detalle, planes y auditoría a través de la sesión del Hub. Si se prueba escritura
en producción, usar una actualización explícita con nombre y slug actuales y
repetir el mismo UUID; documentar que cambia versión/auditoría, sin crear pagos,
renovar, suspender o cambiar credenciales de clientes.

Rollback: recrear solo el web afectado con su imagen y configuración guardadas.
Los conectores anteriores no cambian el esquema. OnlyCars agrega tres booleanos
compatibles con su imagen anterior: conservar esas columnas al volver de imagen;
ver `ONLYCARS_DEPLOYMENT_20261025.md`. No restaurar bases como parte de un rollback de
aplicación. No activar ni ejecutar tareas globales de infraestructura sobre otros
productos. Registrar las pruebas y revisiones exactas en el informe operativo.

