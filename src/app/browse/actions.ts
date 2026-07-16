"use server";

import { revalidatePath } from "next/cache";
import { getActiveConnection } from "@/lib/connection";
import { invalidateList } from "@/lib/s3";

/**
 * "Reload from remote" — drop the cached listing for the current folder and
 * re-render the route so the browse page fetches a fresh listing from S3.
 */
export async function reloadCurrentFolder(prefix: string, pathname: string): Promise<void> {
  const conn = await getActiveConnection();
  if (conn) invalidateList(conn, prefix);
  revalidatePath(pathname);
}
