export const dynamic = "force-static";
export const runtime = "nodejs";

function pngTransparent1x1(): ArrayBuffer {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
  const bin = Buffer.from(base64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

export function GET() {
  const body = pngTransparent1x1();
  return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
}
