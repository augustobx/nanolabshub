import { getSessionUser } from "@/lib/auth";
import { getUniversalGovernanceOverview } from "@/lib/saas-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await getSessionUser()) return Response.json({ success: false, error: "Sesión requerida" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  try {
    const overview = await getUniversalGovernanceOverview();
    return Response.json({
      success: true,
      data: overview,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("Governance overview API error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to fetch governance overview",
      },
      { status: 500 }
    );
  }
}
