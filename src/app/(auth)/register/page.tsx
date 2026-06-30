"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="card animate-in p-8 text-center shadow-2xl">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600">
        <Building2 className="h-7 w-7 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white">Registration Disabled</h2>
      <p className="mt-3 text-sm text-slate-400">
        Self-registration is not available. <br />
        Please contact your company owner or administrator to be added to DD CRM.
      </p>
      <div className="mt-6">
        <Link href="/login" className="btn-accent inline-block rounded-xl px-6 py-2.5 text-sm font-medium">
          Back to Sign In
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        Owners can add team members from Settings → Team
      </p>
    </div>
  );
}
