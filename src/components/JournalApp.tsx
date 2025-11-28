// src/components/JournalApp.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/db";
import { NewPostForm } from "./NewPostForm";
import { PostCard } from "./PostCard";
import Link from "next/link";

type Props = {
  initialPosts: Post[];
  initialCursor: number | null;
  isAuthed: boolean;
};

export function JournalApp({ initialPosts, initialCursor, isAuthed }: Props) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState<boolean>(
    initialCursor === null
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cursor || reachedEnd) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !loadingMore) {
          void loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();

    async function loadMore() {
      if (!cursor || reachedEnd) return;
      setLoadingMore(true);
      try {
        const res = await fetch(`/api/posts?cursor=${cursor}`);
        if (!res.ok) return;

        const json = await res.json();
        const newPosts: Post[] = json.posts;
        const nextCursor: number | null = json.nextCursor;

        if (!newPosts.length) {
          setReachedEnd(true);
        } else {
          setPosts((prev) => [...prev, ...newPosts]);
          setCursor(nextCursor);
          if (nextCursor === null) {
            setReachedEnd(true);
          }
        }
      } finally {
        setLoadingMore(false);
      }
    }
  }, [cursor, reachedEnd, loadingMore]);

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }
  return (
    <div className="main-shell">
      <div className="page-head">
        <div>
          <div className="site-heading">journal</div>
          <div className="site-subtitle">
            an ongoing stream of photos &amp; fragments
          </div>
        </div>

        {!isAuthed && (
          <Link
            href="/login"
            style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--muted)",
            }}
          >
            log in
          </Link>
        )}
      </div>

      {isAuthed && <NewPostForm onCreated={handleCreated} />}

      <section className="feed">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}

        <div ref={sentinelRef} className="sentinel" />
      </section>

      {loadingMore && (
        <p className="composer-meta" style={{ marginTop: "1rem" }}>
          loading more…
        </p>
      )}

      {reachedEnd && posts.length > 0 && (
        <p className="composer-meta" style={{ marginTop: "1rem" }}>
          you’ve reached the first page.
        </p>
      )}
    </div>
  );
}
