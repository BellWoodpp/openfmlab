import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { checkUserPaidMembership } from "@/lib/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({
      ok: true,
      data: { isPaid: false, reason: "unauth" as const },
    });
  }

  const status = await checkUserPaidMembership(userId);
  return NextResponse.json({
    ok: true,
    data: { isPaid: status.isPaid, reason: status.reason },
  });
}
