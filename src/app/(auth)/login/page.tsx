"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [step, setStep] = useState<"creds" | "2fa">("creds");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await apiFetch<{ requiresTwoFactor?: boolean }>("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "login", email, password, remember }),
      });
      if (r.requiresTwoFactor) setStep("2fa");
      else router.replace("/dashboard");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  async function submit2fa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "verify-2fa", email, password, remember, code }),
      });
      router.replace("/dashboard");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card animate-in p-7 shadow-2xl">
      {step === "creds" ? (
        <>
          <h2 className="text-xl font-bold text-white">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-400">Sign in to your DD CRM workspace</p>
          <form onSubmit={submitCreds} className="mt-6 space-y-4">
            <Field label="Email address" required>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
            </Field>
            <Field label="Password" required>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-blue-500" />
                Remember me
              </label>
              <Link href="/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                Forgot password?
              </Link>
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-400">
            Don&apos;t have an account? Contact your company owner to get access.
          </p>
        </>
      ) : (
        <>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Two-factor authentication</h2>
          <p className="mt-1 text-sm text-slate-400">Enter the 6-digit code from your authenticator app.</p>
          <form onSubmit={submit2fa} className="mt-6 space-y-4">
            <Field label="Authentication code" required>
              <Input
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-lg tracking-[0.5em]"
                autoFocus
              />
            </Field>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Verify & sign in
            </Button>
            <button type="button" onClick={() => setStep("creds")} className="w-full text-center text-sm text-slate-400 hover:text-white">
              ← Back to sign in
            </button>
          </form>
        </>
      )}
    </div>
  );
}
