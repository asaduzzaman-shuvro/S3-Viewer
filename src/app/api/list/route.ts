import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import { listPrefix } from "@/lib/s3";

export async function GET(req: NextRequest) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";

  try {
    const result = await listPrefix(prefix);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/list]", err);
    return NextResponse.json({ error: "Failed to list bucket" }, { status: 500 });
  }
}
