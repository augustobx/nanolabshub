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
`HubLoginAttempt`, `HubPayment` y `HubCommand`. Se agregan `SaleItem.notes` y
`SaleItem.customName`, opcionales que el cliente Prisma ya esperaba y que faltaban
en producción. Ninguna columna histórica se renombra o elimina. Los comandos y su auditoría se confirman en una transacción
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

## Cierre productivo: 27/10/2026

Gestión disponible en `https://hub.nanoapps.ar/saas/onlyshop/manage`.

| Servicio | Revisión ejecutada | Imagen SHA-256 |
| --- | --- | --- |
| OnlyShop web | `d912c28e2e770e8866a074aa7d79297ea8fdafe1` | `6e2ada729c1e16d12227c2b49facffff501b3be73526462fb377d32d5f92c4f5` |
| Hub web | `e4ac03f61e70cbe3573df04dc402af70df767288` | `5f12fd8367a888b9d0c374b38b707326846e2cb04b6565589f8facbc601fe5b1` |

- [CI Hub 40435204662](https://github.com/augustobx/nanolabshub/actions/runs/40435204662)
  aprobado: tipos, lint, unitarias, build, UI móvil/escritorio, APIs de identidad,
  restores SQL reales y despliegue/rollback aislados. Local: 109 pruebas aprobadas
  y una omitida por el entorno. OnlyShop: cuatro grupos de integración SQLite,
  TypeScript, lint focalizado de los nuevos guards/contratos y build de producción.
- Interfaz nativa: 38 verificaciones en escritorio/móvil. Se retiró el saldo
  ficticio de cuentas corrientes cuando el comercio carece de registros.
- Prueba adicional: UI real del Hub, SDK real y HTTP real de OnlyShop contra
  datos sintéticos. Treinta verificaciones, once operaciones, escritorio/móvil;
  incluye alta y selección automática, planes y auditoría paginados por `items`.
  Las escrituras se ejecutaron exclusivamente en tmpfs de QA.
- SDK desde el Hub productivo: once operaciones, un plan ARS, dos tenants,
  dos dominios y ocho productos; governance disponible. Seis verificaciones HTTPS
  de salud y rechazo de anonimato, token incorrecto y firma vencida. Cero comandos
  de negocio en producción.
- El despliegue conservó los hashes de las 203 filas de las 15 tablas originales.
  Quedaron 21 tablas; las dos columnas nuevas son nulas en los registros previos.
  La actualización final conservó las 21 tablas y sus 203 filas sin cambios;
  reemplazo web de unos ocho segundos y 40 vecinos intactos, incluidos los dos QA.
- Los intentos rechazados recuperaron las imágenes anteriores sin restaurar datos.
  Se resolvieron permisos de archivos del checkout y la propagación `rslave` que
  Docker aplica al montaje SQLite anidado. Se declaró explícita y se firmó su
  configuración efectiva. El montaje de la base en el Hub es de sólo lectura.
- Release firmado del Hub `82ee27cf-2fd3-47d8-8101-335080511aa4` aprobado,
  con backup previo, restore aprobado y vecinos preservados. Identidad, MFA,
  secretos y worker independiente conservados; scheduler no reiniciado.

Backups a las **03/09/15/21 de Buenos Aires**, con restore automático aislado.
El primer ciclo produjo `onlyshop_20261027040925_efa8b03f.sqlite.gz`, SHA-256
`320ad420f1c519321ea2a914af89a65b99b6957b9988d481b38096418b81a3cb`.
Backup `efa8b03f-522a-4957-9c83-e820624e6d95` y restore
`03424df1-dca0-4a5f-bf8c-cf9af4c83223` aprobados: 21 tablas,
`integrity_check=ok`, ninguna violación de claves foráneas.

Respaldo previo a la actualización final:
`onlyshop_precontract_20261027T041133Z.sqlite`, SHA-256
`2a96a703d44cf6638327a945074f9138e61f83dd455df1b2bbf649e2051690bd`.
Restaurado en aislamiento, con copia adicional en la PC. El respaldo posterior
tuvo el mismo hash. El backup del release del Hub tiene SHA-256
`be6a280384ff29396eb87c6445979b13cf36d4533b06773ac8d420c47d6961dd`.

Configuración persistida de OnlyShop: `.env.hub` privado sólo para web; Compose
ya no ejecuta sincronización de esquema ni seeds sobre una base existente.
El checkout y `.deployed-commit` identifican la fuente. No se publicó su código
en el repositorio público vacío; el bundle Git privado queda entre las evidencias.
El Hub conserva su manifiesto efectivo firmado; `compose.onlyshop.yml` documenta
el montaje opcional para preparación, no sustituye esos controles productivos.

Rollback inmediato de OnlyShop:
`private/shop-compose.contract.rollback.json`, proyecto `onlyshop`, servicio
`web`, con `up -d --no-deps --no-build --pull never web`. Conserva las tablas
aditivas, la configuración y los datos actuales. Para el Hub, usar su rollback
firmado registrado por el release; no reemplazar su SQLite por un respaldo antiguo.

Cierre verificado a las **01:17 de Buenos Aires**: web OnlyShop, Hub, worker de
releases y scheduler saludables; configuración persistente coincidente con el
runtime; cero jobs pendientes, en ejecución o inciertos. Los dos comercios
responden por HTTPS y rechazan acceso anónimo al panel. Escaneo de los 41 assets
públicos de OnlyShop: ninguna coincidencia con las claves reales del conector.

Los dos contenedores de QA y su red interna se retiraron comprobando sus etiquetas
y tmpfs; ningún volumen productivo se eliminó. Copias del backup automático,
respaldos previos/posteriores y bundle Git en la PC, con SHA-256 verificado.
Configuración de recuperación de OnlyShop y manifiestos efectivos del Hub copiados
cifrados a la PC; descifrado verificado, con clave privada separada y ausente del
servidor. Esto es una copia manual externa; la réplica automática general sigue
diferida por la decisión previa del usuario.
