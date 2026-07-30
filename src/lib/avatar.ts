import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Reduz e comprime a imagem no browser antes do upload. */
export async function compressImage(file: File, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("Falha ao processar imagem");
  return blob;
}

/** Envia a foto para o armazenamento privado e devolve uma URL assinada de longa duração. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Imagem muito grande (máx. 5MB)");

  const blob = await compressImage(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Falha ao gerar URL");

  // limpa uploads antigos do usuário
  try {
    const { data: list } = await supabase.storage.from(BUCKET).list(userId);
    const stale = (list ?? []).filter((f) => `${userId}/${f.name}` !== path).map((f) => `${userId}/${f.name}`);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
  } catch {
    /* silencioso */
  }

  return data.signedUrl;
}
