"use client";

import React from "react";
import type { Post } from "@/lib/db";

type Props = {
  post: Post;
  onTagClick?(tag: string): void;
};

function formatDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Turn #tags into clickable pills that call onTagClick
function renderHashtags(
  text: string,
  onTagClick?: (tag: string) => void,
): React.ReactNode[] {
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("#")) {
      const tag = part.slice(1);
      if (onTagClick) {
        return (
          <button
            key={idx}
            type="button"
            className="hashtag"
            onClick={() => onTagClick(tag)}
          >
            {part}
          </button>
        );
      }
      return (
        <span key={idx} className="hashtag">
          {part}
        </span>
      );
    }
    return part;
  });
}

function getHost(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return null;
  }
}


export function PostCard({ post, onTagClick }: Props) {
  const isPhoto = post.kind === "photo";
  const isLink = post.kind === "link";
  const content = renderHashtags(post.body || "", onTagClick);

  const primaryLink = post.link_url || post.external_url || null;
  const hostForLink = getHost(primaryLink);

  const cardClassNames = ["post-card"];
  if (isPhoto) cardClassNames.push("post-card--photo");
  if (isLink) cardClassNames.push("post-card--link");

  return (
    <article className={cardClassNames.join(" ")}>
      <div className="post-media">
        {isPhoto && post.image_data ? (
          // PHOTO CARD
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.image_data} alt="" className="post-image" />
        ) : isLink && post.link_url ? (
          // LINK CARD
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="post-media-link"
          >
            <div className="post-link-host">
              {hostForLink ?? post.link_url}
            </div>
            <div className="post-link-body">
              {post.body && post.body.length > 0
                ? post.body
                : post.link_url}
            </div>
          </a>
        ) : (
          // TEXT CARD
          <div className="post-media-text">
            <div className="post-body">{content}</div>
          </div>
        )}
      </div>

      <div className="post-meta">
        <span>{formatDate(post.created_at)}</span>
        {post.external_url && (
          <>
            <span>·</span>
            <a
              href={post.external_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              view on {getHost(post.external_url) ?? "source"}
            </a>
          </>
        )}
      </div>
    </article>
  );
}
