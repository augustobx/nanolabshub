# Conservación del historial y de los backups

Política del Hub: **conservar todo, sin vencimiento ni purga automática**.
Se aplica a auditoría, métricas, trabajos y eventos, ciclo de vida, registro de
backups, pruebas de restauración y archivos registrados administrados por el Hub.
No se fija una cantidad de días que elimine silenciosamente información.
Los límites de consulta de las pantallas no eliminan filas persistidas.

El archivo recuperable es el backup consistente completo de SQLite del Hub,
comprimido y registrado con SHA-256. La agenda activa captura cada seis horas y
encola una restauración aislada. El panel Continuidad publica conteos actuales y
conteos del snapshot restaurado para siete tablas históricas. Solo acredita la
recuperación si el último backup propio tiene evidencia aprobada para el mismo
checksum, un manifiesto completo y un archivo cuya integridad se vuelve a
comprobar. Un snapshot no incluye escrituras posteriores a su captura.

Una importación no reemplaza la fecha de captura propia. Una copia nueva sin
prueba no hereda la validación de una anterior. Un fallo de lectura no equivale a
cero registros, espacio suficiente ni recuperación aprobada.

La capacidad se lee en los sistemas de archivos de datos y backups del Hub;
pueden ser el mismo disco, por lo que no se suman sus espacios. Se muestra aviso
desde 85% y capacidad crítica desde 95% de ocupación. No es una reserva futura.
Ante poco espacio, ampliar capacidad o trasladar copias verificadas a un destino
independiente. No se borran automáticamente historias, archivos o volúmenes.

Antes de habilitar una futura purga se necesita definir expresamente su alcance,
archivar y verificar recuperación del contenido, y obtener autorización para los
datos exactos que se eliminarían. Esta versión no incluye acciones de purga.

El alcance es el código y los archivos administrados por el Hub. No certifica
políticas de cron, almacenamiento u otros administradores del servidor. La
rotación de desafíos MFA, códigos consumidos y credenciales de recuperación es
parte de la seguridad de autenticación y no constituye purga del historial.

La retención local no resuelve una pérdida del servidor. C04 sigue abierto hasta
configurar una réplica cifrada independiente y demostrar una recuperación desde
ella. La restauración de SQLite verifica la base y sus históricos; no inicia la
aplicación ni acredita recuperación de imágenes, secretos o storage externo.

## Comprobación

- `node --test scripts/history-retention.test.cjs scripts/recovery-engine.test.cjs`
- CI incluye el nuevo contrato; API real autenticada publica política y conteos.
- Smoke Docker aislado crea, comprime, restaura y comprueba un snapshot completo
  del fixture; usa únicamente su directorio temporal y no monta datos productivos.
- UI escritorio/móvil muestra ausencia de evidencia cuando no está disponible.
