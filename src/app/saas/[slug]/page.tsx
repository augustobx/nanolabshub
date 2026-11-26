"use client";

import { useParams } from "next/navigation";
import { MembershipsWorkspace } from "@/components/MembershipsWorkspace";

export default function SaaSWorkspacePage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "all";
  return <MembershipsWorkspace initialSaas={slug} initialTab="membresias" />;
}
