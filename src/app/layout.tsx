import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/manrope";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/600.css";
import "./globals.css";
import { Providers } from "@/components/providers";
export const metadata: Metadata = {
  title: {
    default: "JanVidya | Education without barriers",
    template: "%s | JanVidya",
  },
  description:
    "AI-assisted scholarship and fellowship management. A Smart India Hackathon 26239 prototype with explainable verification and human decisions.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language =
    (await cookies()).get("janvidya-language")?.value === "hi" ? "hi" : "en";
  return (
    <html
      lang={language}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body>
        <Providers initialLanguage={language}>{children}</Providers>
      </body>
    </html>
  );
}
