// src/lib/auth.ts
import { cookies } from "next/headers";

const SESSION_COOKIE = "journal_session";

export async function isRequestAuthed() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  const secret = process.env.ADMIN_SESSION_SECRET;

  // Development convenience: allow the long-standing "1" cookie locally so
  // curl/manual testing keeps working without needing env var plumbing.
  if (process.env.NODE_ENV !== "production" && session === "1") {
    return true;
  }

  if (!secret) {
    // Fail closed in production so we don't fall back to an always-on session.
    // In development this mirrors the previous behavior until the secret
    // exists.
    return false;
  }

  return session === secret;
}
