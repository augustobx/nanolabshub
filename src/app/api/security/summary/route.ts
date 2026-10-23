import { getSessionUser } from "@/lib/auth";
import { SAAS_PRODUCTS } from "@/lib/product-taxonomy";
import { isSaaSIntegrationEnabled } from "@/lib/integration-settings";
import { isManagementEnabled } from "@/lib/saas-management";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 if(!await getSessionUser())return Response.json({success:false,error:"Sesión requerida"},{status:401,headers});
 const password=process.env.ADMIN_PASS||"",master=process.env.HUB_MASTER_KEY||"";
 const adminSecure=password.length>=16 && password!=="Qap.1029Qap.1029" &&
   master.length>=32 && master!=="nanolabs_governance_supreme_2026";
 const connectorEnabled=process.env.HUB_SAAS_INTEGRATION_ENABLED==="true";
 return Response.json({success:true,data:{
   access:{adminCredentialsConfigured:adminSecure,multiFactorAvailable:false,
     roleBasedPermissionsAvailable:false,localAudit:true},
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

