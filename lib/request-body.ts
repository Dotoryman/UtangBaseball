export class BodyTooLargeError extends Error {}

export async function readLimitedBody(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel('body-too-large');
        throw new BodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export async function readLimitedJson(request: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const bytes = await readLimitedBody(request, maxBytes);
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('object-required');
  return value as Record<string, unknown>;
}
