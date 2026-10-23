import { getSessionUser } from "@/lib/auth";
import { getInfrastructureInventory } from "@/lib/infrastructure-inventory";
export const dynamic="force-dynamic";
export const revalidate=0;
export async function GET() {
  if (!await getSessionUser()) return Response.json({success:false,error:"Sesión requerida"},{status:401});
  try { return Response.json({success:true,data:await getInfrastructureInventory()}, {headers:{"Cache-Control":"private, no-store"}}); }
  catch(error){ console.error("[infrastructure] inventory failed");
    return Response.json({success:false,error:"No se pudo consultar el inventario operativo"},{status:503});}
}
