"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "reset-password", token, password }),
      });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card animate-in p-7 text-center shadow-2xl">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-400" />
        <h2 className="text-xl font-bold text-white">Invalid link</h2>
        <p className="mt-2 text-sm text-slate-400">This password reset link is missing a token.</p>
        <Link href="/forgot-password" className="mt-5 inline-block text-sm font-medium text-blue-400">
          Request a new link →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card animate-in p-7 text-center shadow-2xl">
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
        <h2 className="text-xl font-bold text-white">Password updated</h2>
        <p className="mt-2 text-sm text-slate-400">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="card animate-in p-7 shadow-2xl">
      <h2 className="text-xl font-bold text-white">Set a new password</h2>
      <p className="mt-1 text-sm text-slate-400">Choose a strong password for your account.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="New password" required>
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="Confirm password" required>
          <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </Field>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Update password
        </Button>
      </form>
    </div>
  );
}
