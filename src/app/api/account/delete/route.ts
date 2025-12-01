import { auth } from "@/auth";

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.email || session?.user?.name || null;
    return new Response(JSON.stringify({ ok: true, userId }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
}
