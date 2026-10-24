// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "Studio Journal · Justin Napolitano",
  description:
    "Field notes tying together the creative resume aesthetic and the littlelink hub.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="brand-site-surface">
        {children}
              </div>
      </body>
    </html>
  );
}
