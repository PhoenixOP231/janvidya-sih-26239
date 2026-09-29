import Link from "next/link";
export default function Unauthorized() {
  return (
    <div className="error-page">
      <h1>This workspace requires another role.</h1>
      <p>Your account does not have access to this page.</p>
      <Link className="button" href="/workspace">
        Return to your workspace
      </Link>
    </div>
  );
}
