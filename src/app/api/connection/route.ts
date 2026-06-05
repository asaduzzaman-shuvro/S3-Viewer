import { NextRequest, NextResponse } from "next/server";
import { isAuthedRequest } from "@/lib/auth";
import {
  addConnection,
  getStoredConnection,
  removeConnection,
  setActiveConnection,
  updateConnection,
  type S3Connection,
} from "@/lib/connection";
import { validateConnection } from "@/lib/s3";

interface ConnectionBody {
  label?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Map raw AWS SDK errors to messages a user can act on.
function friendlyError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "InvalidAccessKeyId":
      return "That access key ID isn't recognized by AWS.";
    case "SignatureDoesNotMatch":
      return "The secret access key doesn't match that access key ID.";
    case "NoSuchBucket":
      return "No bucket with that name exists in this region.";
    case "AccessDenied":
      return "These credentials don't have permission to list that bucket.";
    case "PermanentRedirect":
    case "AuthorizationHeaderMalformed":
      return "Wrong region for this bucket — check the region.";
    default:
      return "Couldn't connect with those details. Double-check the values and try again.";
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthedRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ConnectionBody;
  const region = body.region?.trim();
  const bucket = body.bucket?.trim();
  const accessKeyId = body.accessKeyId?.trim();
  const secretAccessKey = body.secretAccessKey?.trim();
  const label = body.label?.trim() || bucket || "";

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { error: "Region, bucket, access key ID, and secret access key are all required." },
      { status: 400 }
    );
  }

  const candidate: S3Connection = {
    id: "pending",
    label,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
  };

  // Validate the credentials with a real (tiny) S3 call before saving.
  try {
    await validateConnection(candidate);
  } catch (err) {
    return NextResponse.json({ error: friendlyError(err) }, { status: 400 });
  }

  try {
    await addConnection({ label, region, bucket, accessKeyId, secretAccessKey });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the connection." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

// Edit a saved connection. Omitted/blank secret or access key keep the current value.
export async function PUT(req: NextRequest) {
  if (!(await isAuthedRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ConnectionBody & { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }

  const existing = await getStoredConnection(id);
  if (!existing) {
    return NextResponse.json(
      { error: "That connection can't be edited." },
      { status: 400 }
    );
  }

  // Merge: each field falls back to the stored value when omitted/blank.
  const merged: S3Connection = {
    ...existing,
    label: body.label?.trim() || existing.label,
    region: body.region?.trim() || existing.region,
    bucket: body.bucket?.trim() || existing.bucket,
    accessKeyId: body.accessKeyId?.trim() || existing.accessKeyId,
    secretAccessKey: body.secretAccessKey?.trim() || existing.secretAccessKey,
  };

  // Re-validate only if a connection-affecting field actually changed.
  const credsChanged =
    merged.region !== existing.region ||
    merged.bucket !== existing.bucket ||
    merged.accessKeyId !== existing.accessKeyId ||
    merged.secretAccessKey !== existing.secretAccessKey;

  if (credsChanged) {
    try {
      await validateConnection(merged);
    } catch (err) {
      return NextResponse.json({ error: friendlyError(err) }, { status: 400 });
    }
  }

  try {
    await updateConnection(id, {
      label: merged.label,
      region: merged.region,
      bucket: merged.bucket,
      accessKeyId: merged.accessKeyId,
      secretAccessKey: merged.secretAccessKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save the connection." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

// Activate an existing connection (env default or a saved one).
export async function PATCH(req: NextRequest) {
  if (!(await isAuthedRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }
  try {
    await setActiveConnection(id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not switch connection." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

// Remove a saved connection (the env default cannot be removed).
export async function DELETE(req: NextRequest) {
  if (!(await isAuthedRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
  }
  try {
    await removeConnection(id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not remove connection." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
