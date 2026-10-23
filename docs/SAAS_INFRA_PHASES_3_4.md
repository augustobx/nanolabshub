# NanoLabs Hub — Fases 3 y 4: contrato SaaS seguro e infraestructura

## Estado
Código preparado en ramas de integración. No fusionado ni desplegado en SaaS productivas.
**No se ejecutó ninguna migración, seed, DELETE, UPDATE, cambio de volumen, contenedor o reinicio** en OnlyFood, OnlyERP, OnlyPadel o OnlyCars.

### PRs por SaaS (todos draft)
| SaaS | Base | PR | Estado de datos |
|---|---|---|---|
| OnlyFood | main | https://github.com/augustobx/onlyfood/pull/27 | Sin cambios de datos/esquema |
| OnlyPadel | main | https://github.com/augustobx/onlypadel/pull/5 | Sin cambios de datos/esquema |
| OnlyCars | master | https://github.com/augustobx/onlycars/pull/1 | Sin cambios de datos/esquema |
| OnlyERP | main | https://github.com/augustobx/onlyerp/pull/1 | Sin cambios de datos/esquema |
| OnlyGym | main | https://github.com/augustobx/onlygym/pull/1 | Sin cambios de datos/esquema |
| OnlyTurn | main | https://github.com/augustobx/onlyturn/pull/12 | Sin cambios de datos/esquema |
| OnlyMob | main | https://github.com/augustobx/onlymob/pull/28 | Sin cambios de datos/esquema |

## Contrato de tenants v1

Endpoint por SaaS: `GET /api/integrations/nanolabs/tenants?offset=0`.

- Autenticación: encabezado `Authorization: Bearer <HUB_INTEGRATION_TOKEN>`, token de al menos 32 bytes. Sin credencial se rechaza.
- Resultado: `contract: nanolabs.saas.tenants.v1`, `product`, `capturedAt`, `tenants`, `nextOffset`, `capabilities`.
- Solo campos: ID, slug, nombre de empresa, estado, plan (cuando exista) y fecha de alta.
- Prisma `findMany` con selección explícita y paginación, 100 registros por petición.
- Prohibidos: exportación de clientes finales, métodos mutativos, migraciones, SQL crudo, contraseñas, impersonación por URL, cambiar estados o módulos.

El Hub consume HTTPS y nunca sigue redirecciones. Valida producto, versión de contrato, permiso de solo lectura y paginación. Si un endpoint no responde, marca **fuente no disponible**, nunca reemplaza la ausencia por cero tenants. Cada producto tiene un token diferente.

El Hub ya no contiene el código antiguo de acceso directo SQL con contraseñas incrustadas. **Las credenciales publicadas anteriormente pueden seguir presentes en el historial Git** y deberán rotarse en una ventana de mantenimiento con respaldos verificados, sin hacerlo como parte de esta rama.

## Advertencia de despliegue (revisión de Compose, 22/10/2026)

**No ejecutar `docker compose up -d` sin especificar un servicio en las cuatro SaaS críticas.** La revisión del código detectó que:
- OnlyFood dispone de imágenes `database-migrate` / `database-init`; la segunda ejecuta seeds.
- OnlyPadel tiene un servicio `migrate` vinculado a la app.
- OnlyCars usa `prisma db push` y scripts de bootstrap en imágenes auxiliares.
- OnlyERP tiene un servicio `migrate` que depende de la base y precede al web.

Los cambios de integración NO requieren migraciones de esquema. Antes de desplegar alguno de esos PR es obligatorio comparar el contenedor actual y su revisión con la rama de Git, revisar `docker compose config`, y garantizar que **solo** se reconstruye y recrea el contenedor web sin activar migradores ni otros servicios. `--no-deps` es requisito, pero no sustituye una inspección de la configuración final.

La primera etapa de despliegue se limita al **Hub**, con la bandera `HUB_SAAS_INTEGRATION_ENABLED=false`. Esta etapa tiene una consecuencia esperada: **los recuentos de tenants estarán como «sin conexión» hasta desplegar y configurar sus APIs**, sin consultar bases por SQL como antes. No se debe declarar Superadmin integrado solo por ver el rediseño.

La comprobación de claves del Hub ahora detiene la expansión de Docker Compose si faltan `ADMIN_PASS` o `HUB_MASTER_KEY`; no hay valores por defecto seguros en el Compose de desarrollo. Conservar el estado de `HUB_LIFECYCLE_ENABLED` y `HUB_BACKUPS_ENABLED` y la clave del programador.

Validaciones de GitHub: Hub compilación, TypeScript, backup engine y smoke en escritorio/móvil aprobados. OnlyFood, OnlyPadel y OnlyTurn CI aprobadas; OnlyCars, OnlyERP y OnlyGym tienen workflows de verificación de tipos recién incorporados y aprobados. OnlyMob queda bloqueada por auditoría de dependencias alta/crítica (no habilitar por fuerza).

## Activación gradual, sin afectar datos

Los nuevos endpoints no entran en producción hasta revisar, fusionar y desplegar por separado el PR de cada SaaS.

1. Validar CI y compilación de cada PR con su versión y Prisma correspondiente.
2. Antes de cambios en OnlyFood, OnlyPadel, OnlyCars u OnlyERP, guardar una copia de respaldo restaurable y probar restauración en contenedor aislado. El cambio de ruta de lectura no requiere modificación de tablas.
3. Generar una clave aleatoria distinta para cada SaaS, con `openssl rand -hex 32`. No publicarla, ni pegarla en chats o logs.
4. Inyectar como **secreto de entorno** `HUB_INTEGRATION_TOKEN` únicamente en la aplicación SaaS correspondiente (servicio web, no contenedor DB). No guardar en GitHub ni exponerla en el cliente.
5. Inyectar la misma clave en la variable correspondiente del Hub:
   - `HUB_INTEGRATION_ONLYFOOD_TOKEN`
   - `HUB_INTEGRATION_ONLYPADEL_TOKEN`
   - `HUB_INTEGRATION_ONLYCARS_TOKEN`
   - `HUB_INTEGRATION_ONLYERP_TOKEN`
   - `HUB_INTEGRATION_ONLYGYM_TOKEN`
   - `HUB_INTEGRATION_ONLYTURN_TOKEN`
   - `HUB_INTEGRATION_ONLYMOB_TOKEN`
6. Incluir `compose.integrations.yml` como capa opcional en el despliegue **solo del Hub**. Con `HUB_SAAS_INTEGRATION_ENABLED=false`, no consulta ninguna SaaS, aun con los tokens definidos.
7. Activar la integración tras validar endpoint por endpoint y comprobar que los recuentos de tenants coinciden con los de los superadmin de origen.
8. Verificar respuesta 401 sin token, 200 con token y paginación; las rutas POST/PATCH/DELETE siguen inexistentes. Verificar que nunca aparecen credenciales en HTML, JSON o logs.
9. Ante una falla, establecer `HUB_SAAS_INTEGRATION_ENABLED=false` y redeplegar **solo el Hub**. No modificar bases ni los superadmin originales.

**Nota:** la integración de lectura usa las identidades Prisma propias de cada SaaS. Una futura edición segura requerirá contratos específicos con autenticación por rol, idempotencia, transacciones, permisos de módulos, auditoría y reversión independiente. Las escrituras centralizadas anteriores se deshabilitaron y fueron eliminadas del Hub.

## Fase 4 — Infraestructura

- `/infrastructure` consulta clasificada de CPU, memoria, discos y contenedores: núcleo, bases, web, workers y no asignados.
- `/hardware` sigue disponible como telemetría avanzada.
- `/networking` muestra URLs registradas con estado HTTP observado, no un listado estático afirmando configuraciones NPM inexistentes.
- `/api/infrastructure` es autenticada y de solo lectura. No ejecuta cambios de Docker, DNS o proxy.
- Estados `suspended` y `archived` no se contabilizan como fallas imprevistas.

## Puntos pendientes antes de declarar Superadmin completo

- Integrar edición segura de tenants y planes **desde las APIs nativas de cada SaaS**, nunca SQL directo desde Hub.
- Auditar roles, permisos, module overrides, facturación, dominios y eventos de cada producto con pruebas reales y rotación de credenciales legadas.
- Determinar estado real de dominios mediante API de NPM de solo lectura, sin sobreinterpretar verificaciones HTTP.
- Validar todas las integraciones por aplicación con smoke test real, diferenciando conexión inactiva de base sin tenants.

Este documento es una guía de despliegue controlado y no implica que las bases críticas estén migradas ni validadas en producción.
