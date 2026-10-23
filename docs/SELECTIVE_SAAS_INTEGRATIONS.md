# Activación selectiva de integraciones SaaS

`HUB_SAAS_INTEGRATION_ENABLED=true` habilita el interruptor global, pero solo se
consulta cada producto enumerado en `HUB_SAAS_INTEGRATION_PRODUCTS` (slugs exactos
separados por comas). Sin lista explícita, no se consulta ningún producto.

Para la primera etapa: `HUB_SAAS_INTEGRATION_PRODUCTS=onlygym,onlyturn`.
Las otras cinco fuentes aparecen como `disabled`, con recuento `null`, y no
generan alertas de conectividad. Una fuente seleccionada que falla conserva
`unavailable`; nunca se interpreta como cero tenants.

Cada fuente necesita su token privado `HUB_INTEGRATION_<PRODUCTO>_TOKEN`, de al
menos 32 bytes, inyectado en ejecución. No copiar `.env` al contexto de build.
La API exige `tenantsRead=true`, `tenantWrite=false` y `moduleWrite=false`.
Las operaciones de escritura del Hub continúan bloqueadas.

Antes de desplegar: respaldar SQLite con la API de backup consistente, comprobar
integridad, guardar imagen rollback y preservar las capas Compose vigentes.
Construir el Hub en un checkout aislado y recrear exclusivamente `nanolabshub`
con `--no-deps --no-build`. No recrear el scheduler ni otras aplicaciones.
Validar login, catálogo, fichas, superadmin, governance autenticada y rechazo de
accesos anónimos. Comprobar estados y cantidades contra ambas fuentes.

Rollback: restaurar la imagen anterior y su configuración con el interruptor
global desactivado, recreando únicamente el Hub. No restaurar ni sobrescribir
datos productivos como parte del rollback de esta integración de lectura.

Pruebas: `node --test scripts/saas-bridge.test.cjs`, `npx tsc --noEmit` y build.
