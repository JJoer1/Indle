"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-email", token }),
    })
      .then((r) => (r.ok ? setStatus("success") : setStatus("error")))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="card animate-in p-8 text-center shadow-2xl">
      {status === "loading" && (
        <>
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-blue-400" />
          <h2 className="text-xl font-bold text-white">Verifying your email…</h2>
        </>
      )}
      {status === "success" && (
        <>
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Email verified!</h2>
          <p className="mt-2 text-sm text-slate-400">Your email address has been confirmed.</p>
          <Link href="/dashboard" className="btn-accent mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-medium">
            Go to dashboard →
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Verification failed</h2>
          <p className="mt-2 text-sm text-slate-400">This verification link is invalid or has expired.</p>
          <Link href="/login" className="mt-5 inline-block text-sm font-medium text-blue-400">
            Back to sign in →
          </Link>
        </>
      )}
    </div>
  );
}
