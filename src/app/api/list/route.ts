import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import { getActiveConnection } from "@/lib/connection";
import { listPrefix } from "@/lib/s3";

export async function GET(req: NextRequest) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conn = await getActiveConnection();
  if (!conn) {
    return NextResponse.json({ error: "No S3 connection configured" }, { status: 409 });
  }

  const prefix = req.nextUrl.searchParams.get("prefix") ?? "";

  try {
    const result = await listPrefix(conn, prefix);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/list]", err);
    return NextResponse.json({ error: "Failed to list bucket" }, { status: 500 });
  }
}
