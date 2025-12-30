// src/components/JournalApp.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Post } from "@/lib/db";
import { NewPostForm } from "./NewPostForm";
import { PostCard } from "./PostCard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { journalContent } from "@/data/journal-content";

type Props = {
  initialPosts: Post[];
  initialCursor: number | null;
  isAuthed: boolean;
  initialQuery?: string;
};

export function JournalApp({
  initialPosts,
  initialCursor,
  isAuthed,
  initialQuery = "",
}: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [cursor, setCursor] = useState<number | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState<boolean>(initialCursor === null);

  const [search, setSearch] = useState<string>(initialQuery);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLoginHint, setShowLoginHint] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const secretBuffer = useRef<string[]>([]);

  const { masthead, quickFilters, search: searchContent } = journalContent;

  function buildQuery(q: string, cursorOverride: number | null = null): string {
    const params = new URLSearchParams();
    if (cursorOverride != null) {
      params.set("cursor", String(cursorOverride));
    }
    if (q.trim() !== "") {
      params.set("q", q.trim());
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  function handleFilterClick(query: string) {
    setSearch(query);
    void reloadWithQuery(query);
  }

  async function reloadWithQuery(nextQ: string) {
    setLoadingInitial(true);
    setReachedEnd(false);

    const res = await fetch(`/api/posts${buildQuery(nextQ, null)}`, {
      method: "GET",
    });

    if (!res.ok) {
      setLoadingInitial(false);
      return;
    }

    const json = await res.json();
    const nextPosts: Post[] = json.posts ?? [];
    const nextCursor: number | null = json.nextCursor ?? null;

    setPosts(nextPosts);
    setCursor(nextCursor);
    if (!nextPosts.length || nextCursor === null) {
      setReachedEnd(true);
    }

    setLoadingInitial(false);
  }

  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd || cursor == null) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/posts${buildQuery(search, cursor)}`, {
        method: "GET",
      });

      if (!res.ok) return;

      const json = await res.json();
      const newPosts: Post[] = json.posts ?? [];
      const nextCursor: number | null = json.nextCursor ?? null;

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
  }, [cursor, loadingMore, reachedEnd, search]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || reachedEnd) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, reachedEnd]);

  useEffect(() => {
    const secretCode = ["f", "i", "e", "l", "d", "n", "o", "t", "e"];

    function handleKeydown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key.length !== 1) return;

      secretBuffer.current.push(key);
      if (secretBuffer.current.length > secretCode.length) {
        secretBuffer.current.shift();
      }

      const matches = secretCode.every(
        (codeKey, index) => secretBuffer.current[index] === codeKey,
      );

      if (matches) {
        setShowLoginHint(true);
        window.setTimeout(() => setShowLoginHint(false), 6000);
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void reloadWithQuery(search);
  }

  function handleTagClick(tag: string) {
    const token = `tag:${tag}`;
    const base = search.trim();
    const next = base ? `${base} ${token}` : token;
    setSearch(next);
    void reloadWithQuery(next);
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const searchPlaceholder = searchContent.placeholder;
  const searchHint = searchContent.hint;

  return (
    <div className="main-shell">
      <div className="journal-column">
        <header className="masthead">
          {masthead.eyebrow && (
            <p className="masthead__eyebrow">{masthead.eyebrow}</p>
          )}
          <h1>{masthead.title}</h1>
          {masthead.subhead && (
            <p className="masthead__subhead">{masthead.subhead}</p>
          )}
          {masthead.note && (
            <p className="masthead__note">{masthead.note}</p>
          )}
          {showLoginHint && (
            <div className="masthead__actions">
              {isAuthed ? (
                <button
                  type="button"
                  className="cta ghost"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                >
                  {loggingOut ? "logging out…" : "log out"}
                </button>
              ) : (
                <Link className="cta ghost" href="/login">
                  editor login
                </Link>
              )}
            </div>
          )}
        </header>

        {/* Single search bar */}
        <div className="journal-search">
          <form
            className="journal-search-form"
            onSubmit={handleSearchSubmit}
          >
            <div className="journal-search-row">
              <input
                className="journal-search-input"
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="journal-search-button"
                type="submit"
                disabled={loadingInitial}
              >
                {loadingInitial ? "…" : "Search"}
              </button>
            </div>
            {searchHint && (
              <p className="journal-search-hint">{searchHint}</p>
            )}
          </form>
          {quickFilters.length > 0 && (
            <div className="quick-filters">
              {quickFilters.map((filter) => (
                <button
                  key={filter.label}
                  type="button"
                  className="chip"
                  onClick={() => handleFilterClick(filter.query)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        {isAuthed && <NewPostForm onCreated={handleCreated} />}

        {/* Feed */}
        <section className="feed">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onTagClick={handleTagClick}
            />
          ))}

          <div ref={sentinelRef} className="sentinel" />
        </section>
      </div>

      {/* Status text */}
      {loadingMore && (
        <p className="composer-meta" style={{ marginTop: "1rem" }}>
          loading more…
        </p>
      )}

      {reachedEnd && posts.length > 0 && !loadingInitial && (
        <p className="composer-meta" style={{ marginTop: "1rem" }}>
          you’ve reached the first page.
        </p>
      )}
    </div>
  );
}
