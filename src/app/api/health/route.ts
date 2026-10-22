export async function GET() {
  return Response.json({
    status: "healthy",
    service: "nanolabshub",
    version: "1.0.0",
    role: "supreme-governance",
    timestamp: new Date().toISOString(),
  });
}
