// src/app/api/login/route.ts
import { NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_COOKIE = "journal_session";

export async function POST(request: Request) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD not configured" },
      { status: 500 }
    );
  }

  const { password } = await request.json().catch(() => ({ password: "" }));

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // ✅ only secure on prod
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

