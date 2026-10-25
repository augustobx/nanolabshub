# Agendas y evidencia de continuidad

Las agendas admiten intervalos de 6, 12 o 24 horas, hora base, días de la semana
y una opción explícita para probar cada copia mediante restauración aislada.
La zona horaria es Buenos Aires. Para seis horas, una hora base 2 produce turnos
a las 02:00, 08:00, 14:00 y 20:00 de los días habilitados. La hora base debe ser
menor que el intervalo. Elegir solo domingos no promete un RPO de seis horas
durante el resto de la semana.

## Persistencia y compatibilidad

La migración es aditiva: `interval_hours=24`, `auto_restore=0` y
`last_run_slot=NULL` conservan el comportamiento de las agendas existentes.
Un cliente anterior que omita las opciones nuevas conserva sus valores actuales.
Los turnos diarios sin prueba automática mantienen su clave histórica.

El worker reclama un solo trabajo costoso por polling. Cada turno tiene una
clave persistente e idempotente. Si se pierde un polling, se encola solo el
último turno vencido; no se inventan snapshots históricos. La fecha del archivo
sigue siendo la creación real. Un cambio de agenda invalida los trabajos
pendientes de su configuración anterior. Los productos protegidos nunca entran
en la lista permitida del runner.

Los backups programados nuevos usan la identidad `service:backup-scheduler`.
El actor humano que reintenta un fallo se revalida antes de ejecutarlo. El
resultado ya confirmado no se repite si el proceso se interrumpe antes de
encolar su prueba de restauración: el siguiente polling recupera ese paso.

## Restauración automática

Una prueba automática usa `service:backup-restore` y referencia el job de backup
programado exitoso, su mismo ID de archivo y su checksum. No alcanza con enviar
ese nombre de actor: la procedencia y la agenda vigente se comprueban en el
servidor. La API humana no permite construir esa procedencia.

La prueba abre una copia temporal o un contenedor aislado. No reemplaza bases
productivas ni inicia las aplicaciones. Deshabilitar la agenda o su prueba
automática impide ejecutar las pendientes. Un fallo se conserva y requiere un
reintento explícito; un resultado incierto conserva su bloqueo y evidencia.

## Mediciones

- `createdAt` conserva la fecha de registro existente. En un import, esa fecha
  no demuestra cuándo se capturaron sus datos.
- `capturedAt` solo se informa para backups creados por el motor del Hub
  (manuales, programados o previos a un release). Las importaciones conservan
  fecha de captura desconocida y no acreditan un RPO reciente.
- Continuidad muestra la edad de la última captura propia y el objetivo según
  una agenda diaria activa. Si supera ese objetivo, lo indica.
- `duration_ms` mide la prueba aislada con reloj monotónico. Los registros
  anteriores conservan duración desconocida. Esta duración no acredita un RTO
  integral de aplicación, archivos externos, DNS y proveedores.

El ciclo nativo de CI crea un SQLite de QA, ejecuta su backup programado y su
restore real, comprueba idempotencia y conserva los datos originales. MariaDB y
PostgreSQL mantienen sus pruebas nativas de dumps, importación, deduplicación e
integridad relacional. El cierre operativo requiere además observar un ciclo
real de cada recurso autorizado y registrar su evidencia.

La copia externa continúa siendo una condición independiente: una agenda y un
restore local exitosos no protegen frente a la pérdida del dedicado.
