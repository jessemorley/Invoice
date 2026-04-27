import { NextRequest, NextResponse } from "next/server";
import { updateTag } from "next/cache";
import { createServerClient, PROTOTYPE_USER_ID } from "@/lib/supabase";
import { CACHE_TAGS } from "@/lib/queries";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const supabase = createServerClient();
  const path = `${PROTOTYPE_USER_ID}/${id}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: dbError } = await supabase
    .from("expenses")
    .update({ receipt_path: path })
    .eq("id", id)
    .eq("user_id", PROTOTYPE_USER_ID);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  updateTag(CACHE_TAGS.expenses);

  return NextResponse.json({ path });
}
