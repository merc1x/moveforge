"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:     formData.get("name"),
        email:    formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Unbekannter Fehler.");
      return;
    }

    router.push("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Registrieren</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm text-gray-400">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm text-gray-400">E-Mail</label>
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
            <label htmlFor="password" className="text-sm text-gray-400">Passwort</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? "Wird registriert…" : "Registrieren"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Bereits ein Konto?{" "}
          <Link href="/login" className="text-amber-500 hover:underline">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
