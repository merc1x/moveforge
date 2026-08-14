"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Ungültige E-Mail oder Passwort.");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Anmelden</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-gray-400">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm text-gray-400">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Noch kein Konto?{" "}
          <Link href="/register" className="text-amber-500 hover:underline">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  );
}
