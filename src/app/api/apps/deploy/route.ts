import { deployApp } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug } = body;

    if (!slug) {
      return Response.json({ success: false, error: "slug is required" }, { status: 400 });
    }

    const output = await deployApp(slug);

    return Response.json({
      success: true,
      data: {
        slug,
        output,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Deploy error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to deploy app",
      },
      { status: 500 }
    );
  }
}
