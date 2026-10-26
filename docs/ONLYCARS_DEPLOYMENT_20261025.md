# OnlyCars integrado al Hub — evidencia productiva

Ejecución: 25 de octubre de 2026, Buenos Aires; cierre técnico UTC del 26/10.
Autorización expresa: integrar OnlyCars y su base antes de OnlyFood. OnlyFood,
OnlyPadel y OnlyERP quedaron fuera de las modificaciones de esta entrega.

## Versiones y contratos

| Componente | Revisión ejecutada | CI aprobado | PR |
| --- | --- | --- | --- |
| OnlyCars web | `5678249509acc064ea813b2c4c9196be4ae114d6` | `40258210676` | `augustobx/onlycars#2` |
| Hub web y release worker | `312f484993845390352deaea29f20764d873b827` | `40257978309` | `augustobx/nanolabshub#15` |

Imagen OnlyCars:
`sha256:e3fcae80861e869eb8f60918739d330ff1d38b8e787bc72cd438b232d54184e7`.
Imagen Hub:
`sha256:b55f81a3731ec1d9153b2aae5eb707a080609e6cb268e416c5cf823a81645920`.

Las imágenes se construyeron desde archivos Git limpios de esos commits,
con etiquetas de revisión verificadas y sin secretos reales incorporados.
La rama productiva del Hub incorpora el merge `afccfed`; OnlyCars, `e99dd0c`.
Los hashes anteriores son los commits exactos utilizados para construir imágenes.

El SDK real, ejecutado dentro del Hub productivo, autenticó el catálogo de
12 operaciones y leyó 1 plan en USD, 3 tenants, 5 dominios y 144 vehículos.
No ejecutó comandos de negocio en producción. La administración está en
`https://hub.nanoapps.ar/saas/onlycars/manage`, sujeta a sesión, MFA, rol y alcance.

Se habilitaron solamente dos tokens nuevos independientes y se agregó OnlyCars
a las dos listas explícitas del Hub. No se rotaron credenciales existentes.
El worker y el scheduler no recibieron esos tokens. Se volvió a firmar el
catálogo de releases desde la clave privada conservada en la PC; el control de
configuración y la salud del worker quedaron aprobados después de la activación.

## Funcionalidad

Tenants y contacto, estados, planes y límites, suscripciones y renovación,
módulos con herencia/excepción, administradores y revocación de sesiones,
pagos recibidos con moneda/período y dominios con verificación manual explícita.
Se conserva el identificador del tenant. Los pagos históricos/futuros no
reactivan acceso; renovar no inventa cobros. OnlyCars no ofrece `payment.status`.
El alta de dominio no automatiza DNS ni certificados.

Los módulos `pwa_clientes`, `seller_pwa` y `branding_documentos` tienen efectos
en rutas, acciones y configuración nativas. Deshabilitar conserva historial y
configuración. Las funciones históricas no gestionadas del plan se preservan.
El SuperAdmin nativo continúa disponible; no se retiró como parte de esta entrega.
Los reinicios y el ciclo de vida genéricos de contenedores siguen protegidos.

## Preservación y pruebas

- 44 tablas, 2.983 filas y 79 claves foráneas en `onlycars` y
  `carshop_legacy_stage`. Hashes de todas las filas y columnas originales iguales
  antes y después del cambio y de las lecturas de aceptación.
- Solo se agregaron `Plan.hubManaged`, `TenantFeature.hubManaged` y
  `TenantFeature.hubInherit`, booleanos no nulos con valor inicial falso.
  Sin db push, seeds, reconstrucción de bases ni reinicios de MariaDB.
- Se conservaron los nueve SQL no rastreados y el checkout original del servidor.
  El código nuevo se compiló en un directorio separado.
- Configuración R2, secretos, prefijo, dominios y referencias de archivos intactos.
  Los 10 enlaces históricos de medios/documentos almacenados en la base apuntan
  a Unsplash/W3C, respondieron HTTP 200 y no se sustituyeron ni se borraron.
  Esa comprobación no acredita una copia de objetos R2 ni una réplica externa.
- 85 verificaciones HTTP contra un clon restaurado; nueve pruebas de contrato;
  concurrencia, versiones, pagos, roles, sesiones, aislamiento, fechas y módulos.
- 36 verificaciones de la app nativa y 64 del Hub, en escritorio y móvil.
  El login nativo se corrigió para evitar navegación/refresh simultáneos.
- Hub: 107 pruebas aprobadas y una omitida en la ejecución local; 77 controles
  reales de identidad por HTTP aislado; tipos, lint y build aprobados. CI completo
  aprobado, incluidos restore SQL y release/rollback aislados.
- Las escrituras funcionales se probaron en fixtures y clones. No se crearon
  tenants, pagos, dominios ni usuarios de prueba en producción.
- 34 contenedores ajenos al cambio conservaron ID, imagen, inicio y estado;
  OnlyCars DB incluido. Los dos contenedores y la red temporal de QA se retiraron
  después de comprobar su pertenencia, sin eliminar volúmenes productivos.

## Backups y continuidad

Copia anterior al cambio:
`/home/augusto/onlycars-hub-20261025/onlycars_predeploy_20261026T021403Z.sql.gz`,
SHA-256 `dfaba338c12cc7b5a4429a962fe2571dc86d27241dd7240056eb7699eb635705`.
Restauración aislada aprobada; copia adicional conservada en la PC.

Agenda OnlyCars: 02/08/14/20 de Buenos Aires, todos los días, con restauración
aislada automática. Las otras cuatro agendas se conservaron.

Primer backup automático: `6ed90912-e28f-4246-ba33-c87e00f571b9`, archivo
`/opt/backups/onlycars/onlycars_20261026022324_6ed90912.sql.gz`,
SHA-256 `1c70a018cc81a5657fea535464075bed930f0774c97573603cf77b6173e9b39d`.
Restore `dcb22cb4-cfe3-4dc5-bf75-b7491d92efe2` aprobado contra ese checksum:
44 tablas, 2.983 filas, 79 claves foráneas, aproximadamente 5,1 segundos.
La duración del test SQL no es el RTO de recuperación completa de la app.

El release del Hub fue ejecutado por el worker independiente con job
`6347f031-a211-4990-bbff-21697844bc43`, respaldo y restore aprobados antes del cambio.
La activación posterior conservó identidad/MFA, montajes y configuración ajena a
los cuatro campos autorizados. Se respaldó SQLite también antes de esa activación.

## Configuración vigente y rollback

OnlyCars usa el Compose privado efectivo
`/home/augusto/onlycars-hub-20261025/private/compose.production.json`.
El checkout `/opt/apps/onlycars` conserva la revisión original y los SQL históricos;
no reconstruir ni ejecutar el Compose anterior suponiendo que representa la imagen
actual. No mostrar el manifiesto privado: contiene el entorno de ejecución.

Rollback de OnlyCars preparado en
`/home/augusto/onlycars-hub-20261025/private/compose.rollback.json`, imagen
`sha256:acaf8894b8e14c6ba7cac521d94f0ab7db4342eaf00e4251ae4801412002634d`,
también etiquetada `onlycars-app:rollback-pre-hub-20261026`.
Recrear exclusivamente `app`, proyecto `onlycars`, con `--no-deps --no-build
--pull never`; conservar las columnas nuevas y los datos. No restaurar la base
para revertir una imagen. Al retirar el conector, deshabilitar su selección en el
Hub y volver a firmar su configuración, sin exponer ni borrar claves existentes.

El Hub conserva su catálogo firmado y configuración efectiva en
`/home/augusto/nanohub-safe-release-20261024`; después de modificar su entorno,
el manifiesto base y su huella se actualizaron, preservando el bind del worker.
Los releases posteriores deben usar ese mecanismo, no un Compose genérico.

## Pendiente explícito

C04: destino externo independiente, cifrado y recuperación completa desde remoto.
El usuario decidió no definirlo todavía. No se considera operativo ni se declara
cerrado el 100 % global del Hub. OnlyFood y las siguientes migraciones permanecen
fuera de esta entrega; no se alteraron para finalizar OnlyCars.
