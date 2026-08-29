"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { verifyAdminPin } from "./actions/auth";

export default function LandingPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter the PIN code.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await verifyAdminPin(pin);
      if (res.success) {
        router.push("/dashboard");
      } else {
        setError(res.error || "Incorrect PIN code. Access denied.");
        setPin("");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f4f6]">
      {/* Generation Header */}
      <header className="header-bg text-white shadow-md relative z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-2xl font-bold italic tracking-wide font-serif">
            Verity
          </div>
          <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-medium">
            Admin Portal
          </span>
        </div>
      </header>

      <div className="nav-back-bg text-white px-4 py-3 flex items-center text-sm font-medium z-10 relative shadow-inner">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <span>Administrator Access</span>
          <span className="text-xs text-blue-100">Secure Single-Admin Login</span>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-md p-6 sm:p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0056D2]/10 text-[#0056D2] mx-auto mb-4 font-bold">
            <KeyRound className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-center text-gray-800 mb-1">
            Admin Authentication
          </h2>
          <p className="text-xs text-center text-gray-500 mb-6">
            Enter your secure administrator PIN to access the dashboard.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter PIN..."
                autoFocus
                disabled={loading}
                className="w-full text-center tracking-[0.3em] font-mono text-xl py-3 px-4 bg-gray-50 border border-gray-300 focus:border-[#0056D2] focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0056D2] text-gray-900 placeholder:text-gray-400 transition"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="w-full py-3 px-4 rounded-lg bg-[#0056D2] hover:bg-[#0045A8] disabled:opacity-50 disabled:pointer-events-none text-white font-medium shadow flex items-center justify-center gap-2 transition"
            >
              {loading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <span>Authenticate & Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Server-side verification active</span>
          </div>
        </div>
      </main>
    </div>
  );
}
