import { KNOWN_APPS } from "./apps-registry";
// Runs only on the server. Shared engine never executes SQL against application production databases.
export const recoveryEngine = require("../../scripts/recovery-engine.cjs") as {
 listChecks(slug?: string): Array<{id:string;backupId:string;slug:string;checkedAt:string;status:"passed"|"failed";details:string}>;
 checkIsolated(apps:typeof KNOWN_APPS,id:string,actor:string):Promise<{id:string;backupId:string;slug:string;checkedAt:string;status:"passed"|"failed";details:string}>;
};
