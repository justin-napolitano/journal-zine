// app/layout.tsx
import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fraunces",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-space-grotesk",
});

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
      <body className={`${fraunces.variable} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}
