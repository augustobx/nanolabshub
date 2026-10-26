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

La auditoría encontró una imagen productiva del Hub con revisión `unknown` y sin
montajes del catálogo, aunque conservaba sus variables de ruta. La configuración
debe capturarse desde el runtime real y volver a ser verificable antes del release;
no reconstruirla desde una plantilla genérica ni asumir el estado de OnlyCars.

Rollback por imagen y manifiesto previos; conservar columna/tabla aditivas.
No restaurar bases ni quitar volúmenes para revertir una imagen.

El informe de despliegue debe registrar revisiones e imágenes finales, backup
inmediato, hashes de columnas originales, salud, lecturas autenticadas, agenda
MySQL y verificación del control de releases. Este documento describe el alcance
y la preparación; por sí solo no certifica un despliegue terminado.

La réplica externa automatizada general (C04) permanece diferida por decisión
previa del usuario.
