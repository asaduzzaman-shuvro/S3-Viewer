import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import { presignGet, contentTypeFromKey } from "@/lib/s3";

export async function GET(req: NextRequest) {
  if (!isAuthedRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  try {
    const url = await presignGet(key);
    const contentType = contentTypeFromKey(key);
    return NextResponse.json({ url, contentType });
  } catch (err) {
    console.error("[api/signed-url]", err);
    return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
  }
}
