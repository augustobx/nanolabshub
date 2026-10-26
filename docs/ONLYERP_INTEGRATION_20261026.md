# OnlyERP: integración del plano de administración

Autorizada por el usuario el 26/10/2026, después de OnlyCars. OnlyERP ya reside
en el dedicado; esta integración conserva su aplicación, MySQL 8.0.43, base
`onlyerp_db`, esquema `tommasi_legacy`, IDs y configuración fiscal.

## Diferencias frente a OnlyCars

- Accesos nativos por username, no por correo.
- Planes en ARS; límites de usuarios, sucursales y depósitos.
- Membresía en las fechas del tenant; `SuscripcionSaaS` es historial de cobros por
  mes/año. Renovar no crea cobros. Registrar conserva acceso por defecto.
- Módulos nativos y herencia/overrides: 15 capacidades con guards de servidor.
  `WMS` permanece como configuración histórica no administrable por separado.
- Dominios existentes visibles; no se habilitan mutaciones de DNS/TLS.
- Dos cambios de esquema explícitos: `Usuario.sessionVersion` con valor inicial
  cero y tabla de recibos/auditoría `HubCommand`. No ejecuta migrador ni seeds.

## Hub

`/saas/onlyerp/manage`, registro de productos, selección de tenants, scopes,
administración por Bearer/HMAC y respaldo/restauración aislada MySQL. Sólo se
habilita con selección explícita y claves de servicio independientes:

| Runtime | Variables agregadas o seleccionadas |
| --- | --- |
| OnlyERP web | `HUB_INTEGRATION_ENABLED`, `HUB_INTEGRATION_TOKEN`, `HUB_MANAGEMENT_ENABLED`, `HUB_MANAGEMENT_TOKEN` |
| Hub web | `HUB_INTEGRATION_ONLYERP_TOKEN`, `HUB_MANAGEMENT_ONLYERP_TOKEN`; añadir `onlyerp` a ambas listas |

No entregar las claves nuevas a DB, migradores, worker o scheduler. Se conserva
la protección de reinicios y ciclo de vida genéricos para contenedores OnlyERP.

MySQL usa su imagen local exacta oficial, datos en tmpfs, red `none`, sin
credenciales productivas, `CHECK TABLE` sobre esquemas de aplicación y validación
de cada FK. No requiere el binario opcional `mysqlcheck`. Importaciones rechazan
formatos ajenos al motor. Los motores MariaDB/PostgreSQL conservan sus contratos.

## Evidencia previa al despliegue

Respaldo completo inicial: 81 tablas, 21.413 filas, 155 FKs validadas al restaurar.
SHA-256: `90daadc6397df0f0e23f391b9f34bd2ed00242c65ee5447499042d0f4bdbafa0`.
Copia adicional en la PC. Es evidencia de ese instante, no de un backup externo
automático ni de un RTO completo.

El clon de QA usa una red interna, sin salida a proveedores y con AFIP simulado.
Las verificaciones HTTP cubren todas las operaciones, replay/concurrencia,
versiones, cuentas ajenas, módulos, sesiones y semántica de cobros/renovación.
No crear datos ficticios ni ejecutar cobros de prueba en producción.

## Despliegue y recuperación

Antes del cambio: nuevas imágenes con revisión verificada y CI aprobado, backup
inmediato restaurable, manifiestos privados efectivos, comparación de datos y
snapshot de contenedores vecinos. Reemplazar exclusivamente los servicios web
OnlyERP y Hub. El web OnlyERP requiere `--no-deps --no-build --pull never` para
no activar migrador/DB. El Hub usa catálogo firmado y worker independiente.

La auditoría encontró una imagen productiva del Hub con revisión `unknown`.
El montaje del catálogo sí existe en `Mounts` (no aparece en `HostConfig.Binds`);
se preserva. La configuración debe capturarse desde el runtime real y actualizar
sus controles firmados; no reconstruirla desde una plantilla genérica ni asumir
la revisión de la imagen por el estado documentado de OnlyCars.

Rollback por imagen y manifiesto previos; conservar columna/tabla aditivas.
No restaurar bases ni quitar volúmenes para revertir una imagen.

## Cierre productivo: 26/10/2026, 15:06 Buenos Aires

Integración desplegada y comprobada en `https://hub.nanoapps.ar/saas/onlyerp/manage`.
Las revisiones siguientes identifican el código ejecutado; los commits posteriores
de documentación o fixtures no cambian esas imágenes.

| Servicio | Revisión | Imagen SHA-256 |
| --- | --- | --- |
| OnlyERP web | `f23732d1baed2507098f757ce6937d49d9b7d434` | `7d641e0880232e004ba093e4deac213f21da1f5064854dacdee20a43202d50e1` |
| Hub web | `f52cb09d7cd8bf9373de3650c88937bd5a0419e6` | `8ba06c35458fa3bcd38a5af03916ccb9140da01ad6ad23858cc2c64b47deb9bc` |

- CI OnlyERP `40328552380` aprobado; Hub `40328786868` aprobado, incluidos
  restore MySQL/MariaDB/PostgreSQL y release/rollback aislados.
- QA: 145 verificaciones HTTP y 52 verificaciones de UI nativa en escritorio/móvil.
  Se eliminaron los dos contenedores y la red de QA al cerrar.
- Backup inmediato `onlyerp_predeploy_20261026T175136Z.sql.gz`, SHA-256
  `7c2ff769053ed646c0b435b91b9c2733bfa5b094470effedd89a48ee5d43f498`:
  81 tablas, 21.509 filas y 155 FKs restauradas. La actividad entre el primer
  respaldo y éste explica el crecimiento; no se sustituyeron datos productivos.
- Los hashes de todas las columnas originales de esas 81 tablas coincidieron
  antes/después, incluida la configuración fiscal. Se agregaron sólo la columna
  y tabla previstas. MySQL no se reinició; interrupción del web: unos 38 segundos.
- Release firmado del Hub `6778a86c-df4c-449a-b2f9-25b6135f5cd0` exitoso,
  con backup previo y restore aprobado. Worker independiente conservado;
  37 contenedores vecinos conservaron ID, imagen e inicio.
- Lectura con el SDK real desde Hub: 11 operaciones, moneda ARS, tres planes,
  un tenant, un dominio y 286 productos. Cero comandos de negocio en producción.
  Credenciales ausentes y firmas vencidas reciben 401. No se emitieron
  comprobantes fiscales reales como prueba.
- Se corrigió la ruta pública del Hub: proxy NPM específico id 21 hacia
  `nanolabshub:3000`, con certificado wildcard existente. Se conservaron las 19
  entradas previas, sin cambiar DNS ni reiniciar NPM. Salud y login públicos 200;
  gestión anónima 401. OnlyERP y el login de `sanusistem` respondieron 200.
- Control de releases sano, configuración coincidente y sin jobs pendientes,
  en ejecución o de resultado incierto al cierre.

OnlyERP tiene agenda a las **03/09/15/21 de Buenos Aires**, con restauración
aislada automática. Las agendas existentes no cambiaron. El ciclo de las 15:00
produjo `onlyerp_20261026180025_e4f0c8dc.sql.gz`, SHA-256
`73ad716b6b5b7dfee2f15eaeeb6876dfee5e1177401eda19a1e2397f852facaa`.
Backup `e4f0c8dc-4033-491c-9ff0-ae7e0c63f480` y restore
`11929a92-e6cc-43ce-9a97-c8f05987205b` aprobados: 82 tablas (incluye
`HubCommand`), 21.509 filas y 155 FKs. Esto acredita recuperación de la base,
no un RTO integral de aplicación.

Manifiestos efectivos, rollback y evidencias en el servidor:
`/home/augusto/onlyerp-hub-20261026` (secretos sólo en `private/`). Copias de
los respaldos previos de ERP/Hub y reportes en la PC:
`C:\Users\abasq\.codex\artifacts\onlyerp-hub-20261026`.
El checkout histórico de `/opt/apps/onlyerp` no se actualizó: operar con los
manifiestos efectivos registrados, no reconstruir desde su Compose anterior.
Un rollback de imagen conserva el proxy público corregido y el esquema aditivo.

La réplica externa automatizada general (C04) permanece diferida por decisión
previa del usuario.
