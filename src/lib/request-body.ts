export async function limitedText(req: Request, limit = 32768): Promise<string> {
  const size = Number(req.headers.get("content-length") || "0");
  if (!Number.isFinite(size) || size > limit) throw new Error("Solicitud demasiado grande");
  const reader = req.body?.getReader(); if (!reader) return "";
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength; if (length > limit) { await reader.cancel(); throw new Error("Solicitud demasiado grande"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(output);
}
