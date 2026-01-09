import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = process.env.ADMIN_EMAILS?.split(",").map((e) => e.trim()).filter(Boolean) ?? [];
  return list.includes(email);
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const email = session?.user?.email;
  return NextResponse.json({ ok: true, data: { isAdmin: isAdminEmail(email) } });
}

