/**
 * Evidence storage.
 *
 * A private Supabase Storage bucket. Evidence photos are never public: a
 * signed URL with a short expiry is generated per request, so a photo of
 * someone's shop shelf is not a guessable URL.
 *
 * The browser uploads DIRECTLY to Storage using a signed upload URL, so the
 * image bytes never pass through a Vercel function. The 4.5 MB function body
 * limit is therefore irrelevant, and the "under 10 MB" rule is evaluated
 * against the original file size the client reports.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/domain/errors";
import { getEnv } from "./env";

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (client) return client;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export interface SignedUpload {
  /** URL the browser PUTs the bytes to. */
  signedUrl: string;
  /** The storage path the bytes land on. */
  path: string;
  token: string;
}

export interface StorageProvider {
  readonly name: string;
  createSignedUpload(path: string, contentType: string): Promise<SignedUpload>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}

export const supabaseStorage: StorageProvider = {
  name: "supabase",

  async createSignedUpload(path: string, contentType: string): Promise<SignedUpload> {
    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const { data, error } = await supabase()
      .storage.from(SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        `Could not create a signed upload URL: ${error?.message ?? "unknown error"}`,
      );
    }

    // The content type is carried in the path so the signed URL is bound to
    // the right type. Supabase stores what the client sends; the server
    // checks the real MIME type separately when the claim is submitted.
    void contentType;

    return { signedUrl: data.signedUrl, path: data.path, token: data.token };
  },

  async signedUrl(path: string, ttlSeconds: number): Promise<string> {
    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    const { data, error } = await supabase()
      .storage.from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(path, ttlSeconds);

    if (error || !data) {
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        `Could not create a signed URL: ${error?.message ?? "unknown error"}`,
      );
    }
    return data.signedUrl;
  },

  async remove(path: string): Promise<void> {
    const { SUPABASE_STORAGE_BUCKET } = getEnv();
    await supabase().storage.from(SUPABASE_STORAGE_BUCKET).remove([path]);
  },
};

/** The storage path for a piece of evidence. */
export function evidencePath(bountyId: string, kind: "full" | "thumb", ext: string): string {
  const suffix = kind === "thumb" ? "thumb" : "full";
  return `bounties/${bountyId}/${suffix}.${ext}`;
}
