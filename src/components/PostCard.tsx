// src/components/PostCard.tsx
"use client";

import React, { useMemo } from "react";
import type { Post } from "@/lib/db";

type Props = {
  post: Post;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function linkifyHashtags(text: string): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("#")) {
      return (
        <a
          key={idx}
          href={`/?tag=${encodeURIComponent(part.slice(1))}`}
          className="hashtag"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function PostCard({ post }: Props) {
  const content = useMemo(() => linkifyHashtags(post.body), [post.body]);
  const isPhoto = Boolean(post.image_data);

  return (
    <article className="post-card">
      {/* Fixed media box – SAME size for text + photo */}
      <div className="post-media">
        {isPhoto ? (
          // PHOTO POST: image fills frame
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_data!} alt="" className="post-image" />
        ) : (
          // TEXT POST: text centered in frame
          <div className="post-media-text">
            <div className="post-body">{content}</div>
          </div>
        )}
      </div>

      {/* Meta row – same for all posts */}
      <div className="post-meta">
        {formatDate(post.created_at)} · {isPhoto ? "photo" : "note"}
      </div>
    </article>
  );
}

