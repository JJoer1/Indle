"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await apiFetch<{ token?: string }>("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "forgot-password", email }),
      });
      setToken(r.token ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-in p-7 shadow-2xl">
      {token ? (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15">
            <MailCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Check your email</h2>
          <p className="mt-2 text-sm text-slate-400">
            We&apos;ve sent a password reset link to <span className="text-slate-200">{email}</span>.
          </p>
          <p className="mt-4 rounded-lg bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
            Demo mode: click below to continue to the reset page.
          </p>
          <div className="mt-5 space-y-2">
            <Link href={`/reset-password?token=${token}`} className="btn-accent block rounded-xl px-4 py-2.5 text-center text-sm font-medium">
              Reset my password →
            </Link>
            <Link href="/login" className="block text-center text-sm text-slate-400 hover:text-white">
              ← Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold text-white">Reset your password</h2>
          <p className="mt-1 text-sm text-slate-400">Enter your email and we&apos;ll send you a reset link.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email address" required>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </Field>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Send reset link
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
