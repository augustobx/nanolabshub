import { KNOWN_APPS } from "./apps-registry";
export interface HubJob {id:string;kind:string;resource:string;actor:string;state:"pending"|"running"|"succeeded"|"failed"|"uncertain"|"cancelled";attempts:number;maxAttempts:number;dueAt:number;createdAt:number;updatedAt:number;error:string|null;result:string|null}
export const backupRunner = require("../../scripts/backup-runner.cjs").getRunner() as {
  enqueue(apps: typeof KNOWN_APPS,slug:string,requestId:string,actor:string):{id:string;state:string};
  reconcile(apps: typeof KNOWN_APPS,id:string):Promise<unknown>;
  store:{list():HubJob[];get(id:string):HubJob|null;retry(id:string,actor:string):unknown;cancel(id:string,actor:string):unknown;events(id:string):unknown[]};
};
export const recoveryRunner = require("../../scripts/recovery-runner.cjs").getRunner() as {
  enqueue(apps:typeof KNOWN_APPS,backupId:string,requestId:string,actor:string):{id:string;state:string};
  tick(apps:typeof KNOWN_APPS):Promise<Array<Record<string,unknown>>>;
  reconcile(apps:typeof KNOWN_APPS,id:string):Promise<unknown>;
};
