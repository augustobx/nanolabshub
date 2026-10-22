import { getUniversalGovernanceOverview } from "@/lib/saas-bridge";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overview = await getUniversalGovernanceOverview();
    return Response.json({
      success: true,
      data: overview,
    });
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
