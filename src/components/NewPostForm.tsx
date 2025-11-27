// src/components/NewPostForm.tsx
"use client";

import { useState, useRef, FormEvent, ChangeEvent, KeyboardEvent } from "react";
import type { Post } from "@/lib/db";

type Props = {
  onCreated(post: Post): void;
};

export function NewPostForm({ onCreated }: Props) {
  const [body, setBody] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [postToMastodon, setPostToMastodon] = useState(true); // default ON for now
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // local vs Mastodon limits
  const maxForJournal = 1000;
  const maxForMastodon = 500;

  const effectiveMax = postToMastodon ? maxForMastodon : maxForJournal;
  const remaining = effectiveMax - body.length;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // keep things microbloggy — still single-line
    if (e.key === "Enter") {
      e.preventDefault();
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setImageData(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || trimmed.length > effectiveMax) return;

    setSubmitting(true);
    try {
      const targets: string[] = [];
      if (postToMastodon) targets.push("mastodon");

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          imageData,
          targets,
        }),
      });

      if (!res.ok) {
        console.error("Failed to post", await res.text());
        return;
      }

      const json = await res.json();
      const post: Post = json.post;
      onCreated(post);

      setBody("");
      setImageData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setSubmitting(false);
    }
  }

  const disabled =
    submitting || !body.trim() || body.length > effectiveMax;

  return (
    <section className="composer-card">
      <form onSubmit={handleSubmit}>
        <textarea
          className="composer-textarea"
          placeholder="New fragment..."
          value={body}
          maxLength={effectiveMax}
          onKeyDown={handleKeyDown}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="composer-footer">
          <div className="composer-left">
            <label className="composer-file-label">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="composer-file-input"
                onChange={handleFileChange}
              />
              attach photo
            </label>
            {imageData && (
              <span className="composer-meta">1 photo attached</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end" }}>
            {/* Target selection */}
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <span className="composer-meta">post to:</span>
              <label style={{ display: "flex", gap: "0.25rem", alignItems: "center", fontSize: "0.8rem" }}>
                <input
                  type="checkbox"
                  checked={postToMastodon}
                  onChange={(e) => setPostToMastodon(e.target.checked)}
                />
                mastodon
              </label>
              {/* later: add more platforms here */}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="composer-meta">
                {remaining} characters left
                {postToMastodon && " (mastodon limit)"}
              </span>
              <button type="submit" className="btn-primary" disabled={disabled}>
                publish
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

