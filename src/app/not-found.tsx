import Link from "next/link";
export default function NotFound() {
  return (
    <div className="error-page">
      <span className="error-code">404</span>
      <h1>This page isn’t here.</h1>
      <p>Check the address or return to your JanVidya workspace.</p>
      <Link className="button" href="/workspace">
        Go to overview
      </Link>
    </div>
  );
}
