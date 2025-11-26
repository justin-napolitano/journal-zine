// app/page.tsx
import { initDb, fetchPostsPage, type Post } from "@/lib/db";
import { JournalApp } from "@/components/JournalApp";

export default async function Page() {
  await initDb();
  const posts = await fetchPostsPage(null, 12);
  const initialCursor = posts.length ? posts[posts.length - 1].id : null;

  return <JournalApp initialPosts={posts as Post[]} initialCursor={initialCursor} />;
}

