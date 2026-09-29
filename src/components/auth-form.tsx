"use client";
import { Localize } from "@/components/localize";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui";
import { api } from "./providers";
export function AuthForm({
  register = false,
  officer = false,
  demo,
}: {
  register?: boolean;
  officer?: boolean;
  demo: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Localize>
      <div className="auth-form">
        <h1>
          {register
            ? "Your opportunity starts here."
            : officer
              ? "Welcome to your workspace."
              : "Welcome back."}
        </h1>
        <p>
          {register
            ? "Create one profile for your scholarship journey."
            : "Sign in to keep your scholarship journey moving."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setError("");
            setBusy(true);
            try {
              await api(`auth/${register ? "register" : "login"}`, {
                email: data.get("email"),
                password: data.get("password"),
                ...(register
                  ? {
                      name: data.get("name"),
                      consent: data.get("consent") === "on",
                    }
                  : {}),
              });
              router.push("/workspace");
              router.refresh();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Full name
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              defaultValue={officer ? "officer@janvidya.demo" : ""}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
            />
            {register && <small>Use at least 12 characters.</small>}
          </label>
          {register && (
            <label className="checkbox-label">
              <input type="checkbox" name="consent" required />
              <span>
                I agree to the{" "}
                <Link href="/about/privacy" className="text-button">
                  privacy notice
                </Link>{" "}
                and will use fictional information in this prototype.
              </span>
            </label>
          )}
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <Button type="submit" busy={busy}>
            {register ? "Create account" : "Sign in"}
            <ArrowRight size={16} />
          </Button>
        </form>
        <div className="auth-links">
          {register ? "Already have an account?" : "New to JanVidya?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </div>
        {demo && (
          <div className="auth-demo">
            <p>Just exploring? No account setup needed.</p>
            <Link href="/demo" className="button secondary">
              Launch SIH Demo
            </Link>
            <p style={{ fontSize: 9, marginTop: 13 }}>
              Demo accounts use the password <strong>JanVidyaDemo!2026</strong>
            </p>
          </div>
        )}
      </div>
    </Localize>
  );
}
