# NanoLabs Hub — ciclo de vida real de aplicaciones

## Alcance y seguridad

Implementado en la rama `design/governance-hub-redesign-0.1.0`, dentro de **Productos y versiones**.

| Acción | Docker | Monitoreo | Visibilidad |
| --- | --- | --- | --- |
| Activa | Servicio sin intervención | HTTP/Docker activos | Panel principal |
| Suspender | Deshabilita políticas de reinicio y detiene contenedores registrados | HTTP pausado | Visible como suspendida |
| Baja pendiente | Sin operaciones Docker; solo estado administrativo persistido | HTTP pausado | Visible como pendiente |
| Archivar | Deshabilita políticas y detiene contenedores registrados | HTTP pausado | Oculta del panel principal; visible con Mostrar archivadas |
| Reactivar | Inicia contenedores previamente activos y restaura políticas | HTTP habilitado | Visible en panel principal |

Las acciones se aplican a los nombres exactos de `containerNames` del registro, nunca a `docker compose down` ni a `docker rm`.
Se conservan imágenes, volúmenes, bases de datos, `/opt/apps`, Git, archivos, respaldos y el registro histórico.
**Archivar no elimina ni desactiva los registros DNS, dominios o Proxy Hosts de Nginx Proxy Manager**. El dominio puede mostrar 502 tras parar la app. Se debe revisar ese aspecto por separado, identificando cada Proxy Host, antes de tocarlo.

La aplicación `nanolabshub` y las apps de tipo `infrastructure` (NPM/Portainer) están protegidas y no admiten cambios de ciclo de vida.

Los datos se guardan en `/app/data/hub.sqlite` (montado desde `/opt/apps/nanolabshub/data`). Se crean tablas `app_lifecycle` y `app_lifecycle_events` automáticamente.
No se permiten acciones si SQLite persistente está indisponible. Hay historial de usuario, fecha, acción y estado previo/nuevo en SQLite y `audit_log`. Antes de detener Docker se guarda el plan de restauración de políticas de reinicio.

Si un cambio Docker falla parcialmente, el API devuelve un error y no confirma la transición. Consultar Docker y revisar antes de repetir. Se conserva el plan de recuperación registrado antes de tocar los contenedores.

## Activación segura (requiere intervención explícita)

**No se activa por defecto**, porque detiene servicios productivos. Deben existir:
- `HUB_LIFECYCLE_ENABLED=true` (en el contenedor Hub).
- `ADMIN_PASS` distinto del valor predeterminado y de longitud **>=16**.
- `HUB_MASTER_KEY` distinto del valor predeterminado y de longitud **>=32**.
- `HUB_PUBLIC_ORIGIN` igual al dominio desde el que se ingresa al panel (valor por defecto `https://hub.nanoapps.ar`).
- Sesión del administrador autenticada y petición POST desde el mismo origen.
- Confirmación escribiendo el `slug` exacto y, para archivar, aceptación explícita de que el respaldo no está verificado.

Cambiar `HUB_MASTER_KEY` invalida cookies existentes y requiere un nuevo login. Mantener los secretos solo en el archivo `.env` del directorio de producción, con permisos limitados; **no** subirlos a GitHub.

Usando el esquema de despliegue de vista previa existente:

```bash
cd /opt/apps/nanolabshub-redesign
git pull --ff-only origin design/governance-hub-redesign-0.1.0

cd /opt/apps/nanolabshub
# Verificar aquí que /opt/apps/nanolabshub/.env contiene las credenciales seguras
export BUILD_REVISION="$(git -C /opt/apps/nanolabshub-redesign rev-parse HEAD)"
export HUB_LIFECYCLE_ENABLED=true

docker compose \
  -f docker-compose.yml \
  -f /opt/apps/nanolabshub-redesign/compose.preview.yml \
  -f /opt/apps/nanolabshub-redesign/compose.lifecycle.yml \
  config --services

docker compose \
  -f docker-compose.yml \
  -f /opt/apps/nanolabshub-redesign/compose.preview.yml \
  -f /opt/apps/nanolabshub-redesign/compose.lifecycle.yml \
  up -d --build --no-deps nanolabshub

docker inspect --format='{{.State.Health.Status}}' nanolabshub
```

**Cuidado:** si el archivo de producción `docker-compose.yml` no inyecta las variables o el `.env` no tiene las credenciales correctas, habilitar la opción no funciona. Verificar dentro del contenedor solo la **presencia**, no revelar sus valores en terminal compartida.

## Proceso recomendado para retirar San Pedro Padel

1. Corroborar que no haya clientes activos; exportar la base de datos mediante un procedimiento de backup verificable **antes** de archivar (la fase de backups verificados todavía es independiente).
2. En `/software` seleccionar **Baja pendiente** o directamente **Suspender** cuando se quiera cortar el servicio.
3. Confirmar el `slug` exacto `sanpedropadel`.
4. Verificar que `sanpedropadel-web` y `sanpedropadel-db` queden detenidos y con restart policy `no`.
5. Elegir **Archivar aplicación** y reconocer explícitamente que el Hub no garantiza un backup restaurable.
6. Verificar en `/software` → **Mostrar archivadas**, y en historial.
7. Revisar manualmente DNS y proxy correspondientes cuando corresponda. No eliminar volúmenes/DB sin un backup restaurado de prueba.

Para GastosApp, el slug es `gastosapp` y el único contenedor gestionado es `gastosapp-web`.

Reactivar: ingresar a **Mostrar archivadas**, pulsar **Reactivar** y confirmar el slug. Se usan el plan guardado de contenedores previamente activos y sus políticas originales de reinicio.

## Limitaciones deliberadas

- No se purgan datos ni se renombran carpetas; este es un archivado **lógico y reversible**, no un borrado definitivo.
- No se desactiva NPM automáticamente: un Proxy Host puede servir más de una aplicación o tener reglas personalizadas.
- No se crea ni valida automáticamente un backup al archivar.
- El Hub solo administra contenedores **registrados explícitamente**; comprobar contenedores fuera de su inventario antes de considerar terminada una baja.
- Un `docker compose up` externo al Hub puede volver a crear o encender servicios. Las rutas de despliegue y reinicio **del Hub** bloquean apps no activas.
- Los fallos de Docker a mitad de operación requieren revisión del inventario y una nueva operación controlada. No supone éxito silencioso.
