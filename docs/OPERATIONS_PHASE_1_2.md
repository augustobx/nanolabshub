# NanoLabs Hub — Fases 1 y 2: núcleo operativo y centro de control

## Objetivo

Mostrar la operación verificable en una única pantalla: recursos reales del servidor, contenedores, aplicaciones, Git local, Git remoto y versión de imagen Docker efectivamente ejecutada.

## Componentes y fuentes

| Dato | Fuente de verdad | Limitación explícita |
| --- | --- | --- |
| CPU del host | Dos muestras separadas de `/host/proc/stat` | No se sustituye con la carga promedio |
| RAM / swap | `/host/proc/meminfo` | Error de lectura significa consulta fallida |
| Disco | Filesystem del host montado en `/opt/apps` | No representa múltiples volúmenes independientes |
| Inventario Docker | `docker ps -a` | No se inventan contenedores |
| CPU/RAM por contenedor | `docker stats --no-stream` | Si falla, se muestra «—» |
| Git en servidor | `git -C <ruta> log -1` | La ruta necesita una copia Git real |
| Git remoto | `git ls-remote origin refs/heads/<rama>` | Repos privados pueden requerir credenciales para lectura |
| Imagen desplegada | `docker inspect` + etiqueta OCI de revisión | Si no tiene etiqueta de SHA, solo se puede mostrar ID de imagen |
| Salud web | HTTP HEAD desde el contenedor Hub | 401/403 se identifica como acceso restringido, no como caída |

El endpoint `GET /api/operations` devuelve un snapshot con fecha. Si el daemon Docker o la lectura del host falla, devuelve error explícito (no datos de muestra). Su acceso utiliza el middleware existente.

Los botones de logs y reinicio utilizan las rutas ya existentes. El reinicio requiere confirmación. No se modifica ninguna base de datos ni se inicia ningún respaldo en estas dos fases.

### Imágenes Docker y commit exacto

Para NanoLabs Hub el `Dockerfile` admite el argumento `BUILD_REVISION` y lo guarda en la etiqueta `org.opencontainers.image.revision`. Hay que pasarlo al construir; si no, el valor «unknown» será informado como desconocido.

Para lograr la misma precisión en cada SaaS, integrar ese argumento/etiqueta en sus pipelines en una fase posterior. Hasta entonces el Hub muestra el ID de imagen y evita atribuirle un commit no comprobado.

### Validación segura en servidor

La instalación original está en `/opt/apps/nanolabshub` y el código versionado del rediseño se descargó en `/opt/apps/nanolabshub-redesign`. Las operaciones deben usar un override de Compose, conservar el servicio y volúmenes originales y reconstruir únicamente `nanolabshub`.

```bash
cd /opt/apps/nanolabshub-redesign
git pull --ff-only origin design/governance-hub-redesign-0.1.0
export BUILD_REVISION="$(git rev-parse HEAD)"
cat > compose.preview.yml <<'EOF'
services:
  nanolabshub:
    build:
      context: /opt/apps/nanolabshub-redesign
      dockerfile: Dockerfile
      args:
        BUILD_REVISION: ${BUILD_REVISION:-unknown}
EOF

cd /opt/apps/nanolabshub
docker compose -f docker-compose.yml -f ../nanolabshub-redesign/compose.preview.yml build nanolabshub
docker compose -f docker-compose.yml -f ../nanolabshub-redesign/compose.preview.yml up -d --no-deps nanolabshub
docker compose ps nanolabshub
docker inspect --format '{{.State.Health.Status}}' nanolabshub
```

No hacer merge ni reconfigurar apps. La ejecución del plan requiere confirmar de antemano que no hay cambios locales, que la configuración Compose original está disponible y que la versión original puede reconstruirse para rollback.

### Pruebas manuales pendientes

1. Comprobar acceso y carga de Centro de control desde una sesión real.
2. Verificar CPU/RAM/disco frente a `top`, `free -h` y `df -h /opt/apps` del host.
3. Verificar nombres, memoria y CPU de contenedores frente a `docker stats --no-stream`.
4. Comparar SHA local en `git rev-parse HEAD` y remoto en `git ls-remote origin` para dos repos.
5. Para Hub, contrastar la etiqueta de imagen con `docker inspect nanolabshub`.
6. Abrir logs de un contenedor no crítico; probar reinicio solo si el usuario lo autoriza.
7. Revisar apps y webchecks en celular y escritorio.

**Fuera de alcance:** motor de backups descargables, integraciones de funciones reales de clientes, rotación de credenciales y refactorización de autenticación. Corresponden a otras etapas.
