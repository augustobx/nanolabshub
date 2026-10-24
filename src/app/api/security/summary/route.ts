import { getSessionUser, identity } from "@/lib/auth";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import { isSaaSIntegrationEnabled } from "@/lib/integration-settings";
import { isManagementEnabled } from "@/lib/saas-management";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 if(!await getSessionUser())return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
 const users=identity.securitySummary();
 const connectorEnabled=process.env.HUB_SAAS_INTEGRATION_ENABLED==="true";
 return Response.json({success:true,data:{
   access:{adminCredentialsConfigured:users.activeOwners>0,multiFactorAvailable:true,
     roleBasedPermissionsAvailable:true,revocableSessions:true,mfaRequired:true,...users,localAudit:true},
   switches:{backups:process.env.HUB_BACKUPS_ENABLED==="true",
     lifecycle:process.env.HUB_LIFECYCLE_ENABLED==="true",saasConnectors:connectorEnabled},
   connectors:SAAS_PRODUCTS.map(p=>({slug:p.slug,name:p.name,
     enabled:isSaaSIntegrationEnabled(p.slug),credentialConfigured:
       Buffer.byteLength(process.env["HUB_INTEGRATION_"+p.slug.toUpperCase()+"_TOKEN"]||"")>=32,
     safeWriteContract:isManagementEnabled(p.slug)
   })),
   offsite:{providerConfigured:false,lastVerifiedAt:null},
   legacy:{dbCredentialsRotation:"not_verified", superadminMigration:"incomplete"}
 }},{headers});
}

