import { NextResponse, type NextRequest } from "next/server";
import { looksLikePdf, UPLOAD_MAX_BYTES, UPLOADS_BUCKET, uploadPath } from "@/lib/upload/bucket";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// The uploaded-report intake (t-020-spec.md D1). Authenticates the session,
// checks the bytes are a PDF, stores under the caller's own folder through the
// service role (the bucket has no client policy at all), returns the path the
// trigger route will validate again.

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return fail("Please sign in to upload a report.", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Please choose a PDF file.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Please choose a PDF file.", 400);
  if (file.size === 0 || file.size > UPLOAD_MAX_BYTES) {
    return fail("The report must be a PDF of at most 20 MB.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return fail("The report must be a PDF.", 400);

  const path = uploadPath(userId, crypto.randomUUID());
  const service = createServiceClient();
  const { error } = await service.storage
    .from(UPLOADS_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });

  if (error) {
    console.error("report upload failed", userId, error.message);
    return fail("We could not store the report. Please try again.", 500);
  }

  return NextResponse.json({ path }, { status: 201 });
}
