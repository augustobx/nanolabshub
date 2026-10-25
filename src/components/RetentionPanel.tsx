import Link from "next/link";
export type RetentionReport={policy:{mode:string;automaticDeletion:boolean};checkedAt:string;histories:Array<{table:string;rows:number|null}>;recovery:{status:string;backupId:string|null;capturedAt:string|null;checkedAt:string|null;checksum:string|null;tables:Array<{table:string;rows:number}>};volumes:Array<{volume:string;status:string;freeBytes:number|null;usedPercent:number|null}>};
const labels:Record<string,string>={audit_log:"Auditoría",metrics_history:"Métricas",hub_jobs:"Trabajos",hub_job_events:"Eventos de trabajos",app_lifecycle_events:"Cambios de ciclo de vida",backup_jobs:"Registro de backups",backup_restore_checks:"Pruebas de restauración"};
export function RetentionPanel({report}:{report:RetentionReport|null}){
 return <section aria-label="Conservación del historial" className="hub-card p-5">
  <h2 className="hub-section-heading">Conservación del historial</h2>
  {!report?<p className="mt-3 text-xs text-amber-200">Sin lectura de la política y su evidencia. No se asume cobertura.</p>:<>
   <p className="mt-2 text-xs leading-6 text-slate-400">El Hub conserva auditoría, métricas, trabajos y backups registrados sin vencimiento automático. No hay purga habilitada. Esta política cubre los procesos del Hub; no certifica tareas externas del servidor ni una copia fuera del dedicado.</p>
   <div className="mt-4 grid gap-3 lg:grid-cols-2">
    <div className="space-y-2 rounded-xl border border-white/10 p-4">
     <h3 className="text-sm text-white">Registros actuales</h3>
     {report.histories.map(t=><p key={t.table} className="flex justify-between gap-3 text-xs text-slate-400"><span>{labels[t.table]||t.table}</span><span>{t.rows==null?"Sin lectura":t.rows.toLocaleString("es-AR")}</span></p>)}
     <p className="text-[11px] text-slate-500">Los límites de las pantallas no borran el historial.</p>
    </div>
    <div className="space-y-2 rounded-xl border border-white/10 p-4">
     <h3 className="text-sm text-white">Historial dentro del último backup del Hub</h3>
     <p className={`text-xs ${report.recovery.status==="passed"?"text-emerald-300":"text-amber-200"}`}>{report.recovery.status==="passed"?"SHA-256 y restauración aislada aprobados":"Sin evidencia completa de recuperación del historial"}</p>
     {report.recovery.capturedAt&&<p className="text-xs text-slate-400">Captura: {new Date(report.recovery.capturedAt).toLocaleString("es-AR")}</p>}
     {report.recovery.tables.map(t=><p key={t.table} className="flex justify-between gap-3 text-xs text-slate-400"><span>{labels[t.table]||t.table}</span><span>{t.rows.toLocaleString("es-AR")}</span></p>)}
     <p className="text-[11px] text-slate-500">Conteos del snapshot restaurado: no incluyen escrituras posteriores. La prueba recupera la base; no inicia la aplicación.</p>
     <Link href="/backups" className="hub-text-link">Ver y descargar las copias</Link>
    </div>
   </div>
   <div className="mt-4 flex flex-wrap gap-3">{report.volumes.map(v=><p key={v.volume} className={`text-xs ${v.status==="critical"||v.status==="warning"?"text-amber-200":"text-slate-400"}`}>{v.volume==="hub-data"?"Disco de datos":"Disco de backups"}: {v.freeBytes==null?"capacidad desconocida":`${(v.freeBytes/1024**3).toFixed(1)} GiB libres · ${v.usedPercent!.toFixed(1)}% ocupado`}{v.status==="critical"?" · Capacidad crítica":v.status==="warning"?" · Revisar capacidad":""}</p>)}</div>
   <p className="mt-2 text-[11px] text-slate-500">Los dos directorios pueden compartir disco. Sin reserva de capacidad futura; no se eliminan datos para liberar espacio.</p>
  </>}
 </section>;
}
