import { getPrincipal, getSessionUser } from "@/lib/auth";
import { requireMutatingSession } from "@/lib/action-security";
import { authorizeResource } from "@/lib/authorization-policy";
import { independentBilling } from "@/lib/independent-billing";
import { limitedText } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers });
  const slug = new URL(req.url).searchParams.get("slug");
  try {
    if (!slug) {
      return Response.json({ success: true, data: independentBilling.listContracts() }, { headers });
    }
    authorizeResource((await getPrincipal())!, slug, false);
    return Response.json({ success: true, data: independentBilling.getContractDetail(slug) }, { headers });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudieron consultar los contratos." },
      { status: 400, headers }
    );
  }
}

export async function POST(req: Request) {
  let actor: string;
  try {
    actor = await requireMutatingSession(req);
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Acceso no autorizado" }, { status: 403, headers });
  }
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ success: false, error: "Se requiere JSON" }, { status: 415, headers });
  }
  try {
    const body = JSON.parse(await limitedText(req)) as {
      requestId?: string;
      operation?: string;
      input?: Record<string, unknown>;
    };
    const slug = String(body.input?.slug || "");
    authorizeResource((await getPrincipal())!, slug, true);
    const requestId = String(body.requestId || "");
    const input = body.input || {};
    let data: unknown;
    switch (body.operation) {
      case "contract.update":
        data = independentBilling.updateContract(requestId, input, actor);
        break;
      case "contract.renew":
        data = independentBilling.renewContract(requestId, input, actor);
        break;
      case "payment.record":
        data = independentBilling.recordPayment(requestId, input, actor);
        break;
      case "payment.status":
        data = independentBilling.updatePaymentStatus(requestId, input, actor);
        break;
      default:
        return Response.json({ success: false, error: "Operación inválida" }, { status: 400, headers });
    }
    return Response.json({ success: true, data }, { headers });
  } catch (error) {
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo guardar el cambio." },
      { status: 422, headers }
    );
  }
}
