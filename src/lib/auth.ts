// src/lib/auth.ts
import { cookies } from "next/headers";

const SESSION_COOKIE = "journal_session";

export async function isRequestAuthed() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  return session?.value === "1";
}

