"use client";

import { Button, Notice } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="error-page">
      <h1>We couldn’t load this page.</h1>
      <Notice tone="warning">
        Please try again. Your saved application is safe.
      </Notice>
      <Button onClick={reset}>Try again</Button>
      <a href="/workspace">Return to overview</a>
    </div>
  );
}
