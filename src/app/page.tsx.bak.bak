import { initDb, fetchPostsPage, type Post } from "@/lib/db";
import { JournalApp } from "@/components/JournalApp";
import { isRequestAuthed } from "@/lib/auth";

export default async function Page() {
  await initDb();

  // do both in parallel for fun
  const [posts, authed] = await Promise.all([
    fetchPostsPage(null, 12),
    isRequestAuthed(),               // ⬅️ now returns a Promise<boolean>
  ]);

  const initialCursor = posts.length ? posts[posts.length - 1].id : null;

  return (
    <JournalApp
      initialPosts={posts as Post[]}
      initialCursor={initialCursor}
      isAuthed={authed}
    />
  );
}

