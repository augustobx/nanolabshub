# Despliegue seguro del Hub

El único recurso habilitado por este módulo es `nanolabshub`. El endpoint genérico
de streaming permanece retirado. OnlyPadel, OnlyCars, OnlyERP y sus bases continúan
protegidos; esta entrega no habilita las migraciones del paso 2.

## Aprobación y preparación

Un operador prepara fuera de Git el manifiesto **efectivo** de Compose: un único
servicio web del Hub, sus variables y bind mounts actuales, las redes existentes,
sin build, dependencias, volúmenes nuevos ni recursos de otros stacks. Nunca usar
una plantilla histórica que pierda overrides o secretos. El archivo es privado.

El catálogo público tiene una envoltura `{payload,signature}` en base64, firmada
con Ed25519. La clave privada permanece fuera del servidor. La clave pública y el
catálogo se montan de solo lectura en web y worker. El payload incluye:

- `version:1`, slug/proyecto/servicio/contenedor `nanolabshub` y repositorio
  `augustobx/nanolabshub`;
- `expiresAt` en milisegundos (máximo 31 días), `configurationSha256` del archivo
  privado exacto, `runtimeFingerprint` y `environmentKeys` de su entorno declarado;
- `releases`: ID, imagen local `sha256:…`, revisión Git completa,
  `schemaCompatibility:"additive-only"` y CI `{runId,headSha,conclusion:"success"}`.

El operador debe comprobar en GitHub que el run corresponde a la revisión, que
todos sus gates aprobaron y que el esquema permite volver a la imagen anterior.
La firma acredita esa revisión operativa. El worker no acepta una imagen, un
comando, una ruta Compose o una URL enviados por el navegador, ni hace pulls.

## Worker independiente

`node /app/scripts/release-worker.cjs` debe ejecutarse en un contenedor propio,
sin puertos publicados y con `network_mode: none`. Requiere Docker socket,
`DATA_DIR` compartido del Hub, el directorio de backups **solo del Hub**, y estos
controles:

| Variable | Archivo / directorio |
| --- | --- |
| `HUB_RELEASE_CATALOG_PATH` | Catálogo firmado público, solo lectura |
| `HUB_RELEASE_PUBLIC_KEY_PATH` | Clave pública Ed25519, solo lectura |
| `HUB_RELEASE_CONFIGURATION_PATH` | Compose efectivo privado, solo worker, solo lectura |
| `HUB_RELEASE_RUNTIME_DIR` | Directorio privado escribible para manifiestos por job |

El directorio de manifiestos debe estar montado en su misma ruta absoluta del
host, para que Compose y sus etiquetas sigan siendo utilizables por el operador.
Aplicar filesystem de solo lectura, tmpfs limitado en `/tmp`, rotación de logs,
`no-new-privileges`, quitar capabilities y conservar solo las necesarias para
leer los archivos privados y asignar su propietario. El socket Docker mantiene
privilegios elevados: no equivale a aislamiento de seguridad frente al daemon.

Web requiere solo catálogo, clave pública y `DATA_DIR`; nunca la clave privada ni
el Compose privado. La salud del worker usa `release-worker-health.cjs`, con un
heartbeat máximo de 60 segundos. No reutilizar el healthcheck HTTP de Next.js.

## Flujo

1. Propietario con MFA y verificación reciente elige una versión aprobada en
   Software. POST responde 202 con un job persistido e idempotente.
2. El worker reclama el job atómicamente. Backups/restores/imports y releases se
   excluyen durante su ejecución. Un estado incierto conserva el bloqueo.
3. Revalida propietario/MFA, firma/vigencia, manifiesto, imagen/revisión y estado
   inicial saludable. Registra IDs/imágenes/arranques de todos los vecinos.
4. Crea un backup consistente del SQLite del Hub y lo restaura en aislamiento,
   comprobando integridad y claves foráneas. No inicia la app sobre esa copia.
5. Revalida aprobación, lease y ausencia de cambios. Genera manifiestos privados
   de avance y rollback; escapa dólares para conservar secretos literalmente.
6. Compose usa imagen por ID, `--no-deps --no-build --pull never` y solo el
   servicio Hub. El worker sobrevive al reemplazo del proceso web.
7. Verifica salud Docker, HTTP público 200, API privada anónima 401, configuración
   preservada y vecinos intactos. Si falla, intenta volver a la imagen anterior.

La reversión nunca restaura automáticamente la base ni elimina datos. Una
reversión aprobada registra el despliegue como fallido. Si no se puede confirmar
el estado final, conserva el lock y el job incierto. No hay replay automático.
La reconciliación comprueba imagen/salud/configuración/vecinos/backup del mismo
job; no acepta una afirmación de éxito enviada por el cliente.

Un operador local autorizado puede registrar un job identificado como
`local-operator:…`, con aprobación Ed25519 adicional que vincula kind, slug,
releaseId, requestId, actor, issuedAt y expiresAt (máximo 30 minutos). Esto permite
verificación operativa sin suplantar el MFA humano. La API humana no admite esa
aprobación desde el cuerpo de la solicitud.

## Verificación

`release-engine.test.cjs` cubre firma, scope, CI, caducidad, exclusión, éxito,
rollback, pérdida de estado, reconciliación y caracteres especiales.
`release-sandbox-smoke.cjs` crea su propio proyecto y SQLite sintético; ejecuta
Compose real, cambio de imagen y rollback por salud fallida, con dos backups
restaurados. Solo elimina sus propios contenedores e imágenes de prueba.
Los tests HTTP ejercitan permisos reales; la UI de escritorio y móvil usa
fixtures explícitos. Ninguna de estas pruebas sustituye el cierre productivo.
