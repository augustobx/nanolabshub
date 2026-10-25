# Mantenimiento de imágenes de NanoHub

Hardware permite al propietario con MFA y verificación reciente revisar y
seleccionar imágenes antiguas del Hub. La limpieza global sigue retirada.

Una candidata debe tener **una sola etiqueta `nanolabshub:…`**, al menos siete
días de antigüedad y ningún contenedor asociado, incluido cualquier contenedor
detenido. Se excluyen imágenes compartidas, sin etiqueta, con referencias a
repositorios externos, etiquetas de rollback y todas las versiones del catálogo
firmado. La ausencia de catálogo válido impide operar.

La interfaz informa etiquetas, edad y tamaño declarado. El usuario selecciona
como máximo veinte imágenes y escribe la confirmación exacta que muestra la
pantalla. Los tamaños incluyen capas compartidas y no garantizan el espacio que
se recuperará. No se seleccionan volúmenes, bases ni archivos de backups.

POST `/api/maintenance/images` registra un job persistente e idempotente. El
worker independiente revalida identidad, permiso, catálogo, referencias y edad
antes de cada retirada. Solo ejecuta `docker image rm ETIQUETA_PROPIA`, sin
`--force`, sin borrar por ID y sin usar prune. Así, una etiqueta externa agregada
concurrentemente queda fuera del comando de retirada. Los registros de inicio y
de cada imagen retirada quedan en auditoría.

La capacidad de mantenimiento del worker se verifica junto con su heartbeat y
el identificador de su instancia. Un worker anterior que solo procesa releases
no se presenta como listo para esta función. Releases, mantenimiento y tareas de
backups/restores/imports se excluyen atómicamente.

No hay reintento automático ni replay de una limpieza parcial. Ante resultado
incierto, la reconciliación requiere que el proceso haya terminado o haya sido
reemplazado; contrasta la selección persistida con las etiquetas actuales. Una
limpieza parcial termina como fallida conservando las restantes. Nunca borra
imágenes adicionales para resolver un estado incierto.

La prueba nativa crea una imagen propia de QA y simula únicamente la edad en el
reloj inyectado al fixture, sin alterar el servidor ni la política productiva.
Comprueba retirada real, preservación del pin de rollback y cero volúmenes
eliminados. La verificación productiva usa la vista previa; retirar imágenes
reales requiere la selección y confirmación explícita del propietario.
