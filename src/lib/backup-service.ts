import { KNOWN_APPS } from "./apps-registry";
// Node-only engine shared with the scheduled worker. No shell interpolation of user inputs.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const backupEngine = require("../../scripts/backup-engine.cjs") as {
  createBackup(apps: typeof KNOWN_APPS, slug: string, trigger?: string, actor?: string): Promise<{id:string;filename:string;sizeBytes:number;checksum:string}>;
  list(apps: typeof KNOWN_APPS): Array<Record<string,unknown>>;
  download(apps: typeof KNOWN_APPS, id: string): Promise<{file:string;name:string;size:number}>;
  schedules(apps: typeof KNOWN_APPS): Array<{slug:string;name:string;enabled:boolean;hourLocal:number;weekdays:string;lastRunDay:string|null}>;
  schedule(apps: typeof KNOWN_APPS, slug:string, cfg:{enabled:boolean;hourLocal:number;weekdays:string}, actor:string):void;
  tick(apps: typeof KNOWN_APPS):Promise<Array<Record<string,unknown>>>;
};
