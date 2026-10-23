# NanoLabs Hub — Rediseño Fases 1 y 2

**Alcance implementado solo en rama de diseño. No desplegar automáticamente ni mezclar en main.**

## Diseño de navegación y gobierno

- `/` Inicio ejecutivo: prioridades, indicadores de SaaS, clientes reportados, contenedores y copias. No acumula el inventario técnico en el resumen.
- `/superadmin` Estado del control central; mapa de capacidades de las seis SaaS. Un aspecto visual homogéneo no garantiza integración completa.
- `/saas` Portafolio exclusivo de los seis productos SaaS.
- `/saas/[slug]` Ficha única de cada SaaS: Resumen, Tenants, Operación, Datos, Configuración, Auditoría.
- `/governance?saas=<slug>` Gestión global de tenants filtrable por producto; modal de funciones heredadas conservado.
- `/software?segment=internal|dedicated|saas|infrastructure` Inventario categorizado; `/software?archived=1` archivadas y reactivación.
- `/operations` Conserva íntegro el antiguo panel de operaciones técnicas (logs, repositorios, Docker, reinicio).
- `/hardware`, `/networking`, `/backups` conservan sus funcionalidades originales bajo una base visual compartida.

El diseño usa colores de significado consistentes, etiquetas legibles, acciones primarias claras y navegación móvil accesible; no confunde una *aplicación* con un *tenant* ni un *cliente dedicado* con una plataforma SaaS.

## Contrato SaaS homogéneo

`src/lib/product-taxonomy.ts` define los productos y capacidades reportadas. La misma ficha usa exclusivamente datos existentes de `/api/operations`, `/api/governance` y `/api/backups`. Una integración ausente nunca se simula.

Las capacidades de escritura se distinguen:
- Lectura de tenants: conector actual implementado, pero requiere verificación individual de calidad y disponibilidad.
- Estados de tenant: código heredado existente, **pendiente de auditoría** antes de considerarlo contrato estable entre SaaS.
- Módulos: solo existe implementación de escritura para OnlyGym; las demás SaaS muestran controles deshabilitados y la API rechaza llamadas de edición.
- Acceso delegado/suplantación de identidad: **NO integrado**. Se eliminó el generador de URL con token estático heredado.
- Configuración global (branding, módulos, facturación) y auditoría por producto: **pendientes**. No se simulan.

### Riesgos heredados abiertos
`src/lib/saas-bridge.ts` todavía contiene credenciales de bases de datos heredadas y consultas acopladas a cada esquema; por seguridad estas credenciales deben migrarse a secretos y **rotarse** antes de habilitar más operaciones Superadmin. Los conectores que silencian fallas devolviendo listas vacías requieren observabilidad explícita, de lo contrario 0 tenants podría significar error. El rediseño no modifica los esquemas ni reinicia contenedores de aplicaciones.

Las API mutativas de gobierno pasaron a exigir sesión y origen del Hub y validación de identificadores; los módulos simulados ahora generan un error real en lugar de éxito ficticio.

## Validación y despliegue

El workflow `.github/workflows/ui-verify.yml` ejecuta TypeScript, pruebas del motor de backup, build Next.js y smoke Playwright desktop/móvil. También debe comprobar rutas nuevas, tabs, clasificación y navegación.

Para actualizar solo el Hub manteniendo las funciones actuales de lifecycle y backups, reproducir el despliegue por Compose del entorno preview existente después del pipeline satisfactorio y de revisar diferencias del PR; mantener las capas `compose.lifecycle.yml` y `compose.backups.yml` si están habilitadas en producción. No hacer merge ni despliegue sin decisión explícita.

## Próximas fases

- Fase 3: ficha y contratos `Tenant` comunes para todas las SaaS, permisos RBAC reales, API adaptadora por plataforma, escribir/verificar operaciones y auditoría con transacciones.
- Fase 4: operaciones de infraestructura, salud y red clasificadas por recurso con datos verificables.
- Fases 5/6: continuidad, backups fuera del servidor y eliminación progresiva del código legado.
