import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth/server";
import { getUserMembershipDetails } from "@/lib/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({
      ok: true,
      data: { isPaid: false, period: null, hasPaidHistory: false, reason: "unauth" as const },
    });
  }

  const status = await getUserMembershipDetails(userId);
  return NextResponse.json({
    ok: true,
    data: { isPaid: status.isPaid, period: status.period, hasPaidHistory: status.hasPaidHistory, reason: status.reason },
  });
}
