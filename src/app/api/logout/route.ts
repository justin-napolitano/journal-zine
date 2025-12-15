import { NextResponse } from "next/server";

const SESSION_COOKIE = "journal_session";

export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
