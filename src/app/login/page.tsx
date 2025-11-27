// src/app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Login failed");
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-shell">
      <header style={{ marginBottom: "2rem" }}>
        <div className="site-heading">journal · login</div>
        <div className="site-subtitle">
          enter your admin password to post
        </div>
      </header>

      <form onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.85rem",
            marginBottom: "0.35rem",
          }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem 0.6rem",
            borderRadius: 999,
            border: "1px solid var(--border)",
            font: "inherit",
            marginBottom: "0.75rem",
          }}
        />
        {error && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#b3261e",
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !password}
        >
          {loading ? "signing in…" : "sign in"}
        </button>
      </form>
    </div>
  );
}

