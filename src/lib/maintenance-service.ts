import { backupRunner } from "./job-service";
export interface MaintenancePreview {slug:string;minimumAgeDays:number;candidates:Array<{imageId:string;tag:string;createdAt:string;sizeBytes:number;ageDays:number}>;workerHealthy:boolean;automaticDeletion:boolean;volumesIncluded:boolean;selectionLimit:number}
export const maintenanceService=require("../../scripts/image-maintenance.cjs").createImageMaintenance({store:backupRunner.store}) as {
 preview():Promise<MaintenancePreview>;
 enqueue(imageIds:string[],requestId:string,confirmation:string,actor:string):Promise<{id:string;state:string}>;
 reconcile(job:unknown):Promise<unknown>;
};
