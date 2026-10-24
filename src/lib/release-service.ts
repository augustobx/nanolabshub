export interface ReleasePlan {
 slug:string; currentImageId:string; currentRevision:string|null;
 configurationMatches:boolean; workerHealthy:boolean; ready:boolean;
 releases:Array<{id:string;revision:string;imageId:string;available:boolean;ci:{runId:number;conclusion:string}}>;
 services:string[]; backupRequired:boolean; isolatedRestoreRequired:boolean; automaticDatabaseRestore:boolean;
}
export const releaseService=require("../../scripts/release-catalog.cjs").createReleasePublic() as {
 plan():Promise<ReleasePlan>;
 enqueue(store:unknown,releaseId:string,requestId:string,actor:string):{id:string;state:string};
 reconcile(store:unknown,id:string):Promise<unknown>;
};
