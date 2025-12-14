// src/app/api/login/route.ts
import { NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const SESSION_COOKIE = "journal_session";

export async function POST(request: Request) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 },
    );
  }

  const isProd = process.env.NODE_ENV === "production";

  // In production we require a real secret to avoid trivial spoofing
  if (isProd && !ADMIN_SESSION_SECRET) {
    return NextResponse.json(
      { error: "ADMIN_SESSION_SECRET not configured" },
      { status: 500 },
    );
  }

  const { password } = await request.json().catch(() => ({ password: "" }));

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });

  // Dev: keep using "1" so curl / manual testing is easy
  // Prod: use ADMIN_SESSION_SECRET so cookies can't be guessed from the repo
  const sessionValue = isProd
    ? (ADMIN_SESSION_SECRET as string)
    : "1";

  res.cookies.set(SESSION_COOKIE, sessionValue, {
    httpOnly: true,
    secure: isProd, // only secure on prod
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}

