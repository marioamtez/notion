"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SignInPage = () => {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "forgot">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsSubmitting(false);

    if (error) {
      setError("Credenciales inválidas. Usa tu cuenta de Mbrand AI.");
      return;
    }

    router.push("/documents");
    router.refresh();
  };

  const onRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsSubmitting(false);

    if (error) {
      setError("No se pudo enviar el email. Inténtalo de nuevo.");
      return;
    }

    setMessage("Si ese email tiene cuenta, te llegará un enlace para cambiar la contraseña.");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-y-8 bg-[#1b2028] px-4">
      <div className="flex flex-col items-center gap-y-3">
        <Image
          src="/logo-mbrand.svg"
          alt="Mbrand"
          width={180}
          height={42}
          priority
        />
        <p className="text-sm text-[#9aa0ac]">Acceso a Notion corporativo</p>
      </div>

      {mode === "sign-in" ? (
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-sm flex-col gap-y-4 rounded-xl bg-[#252b34] p-6"
        >
          <div className="flex flex-col gap-y-2">
            <label htmlFor="email" className="text-sm text-white">
              Email corporativo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md bg-[#e9ebf7] px-3 text-sm text-[#1b2028] outline-none"
            />
          </div>

          <div className="flex flex-col gap-y-2">
            <label htmlFor="password" className="text-sm text-white">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md bg-[#e9ebf7] px-3 text-sm text-[#1b2028] outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-10 rounded-md bg-white text-sm font-medium text-[#1b2028] transition hover:bg-white/90 disabled:opacity-60"
          >
            {isSubmitting ? "Entrando..." : "Iniciar sesión"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
              setMessage(null);
            }}
            className="text-center text-xs text-[#9aa0ac] hover:text-white"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      ) : (
        <form
          onSubmit={onRequestReset}
          className="flex w-full max-w-sm flex-col gap-y-4 rounded-xl bg-[#252b34] p-6"
        >
          <div className="flex flex-col gap-y-1">
            <h1 className="text-sm font-medium text-white">
              Recuperar contraseña
            </h1>
            <p className="text-xs text-[#9aa0ac]">
              Te enviaremos un enlace a tu email para poner una contraseña
              nueva.
            </p>
          </div>

          <div className="flex flex-col gap-y-2">
            <label htmlFor="reset-email" className="text-sm text-white">
              Email corporativo
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md bg-[#e9ebf7] px-3 text-sm text-[#1b2028] outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 h-10 rounded-md bg-white text-sm font-medium text-[#1b2028] transition hover:bg-white/90 disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar enlace"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("sign-in");
              setError(null);
              setMessage(null);
            }}
            className="text-center text-xs text-[#9aa0ac] hover:text-white"
          >
            Volver a iniciar sesión
          </button>
        </form>
      )}

      <p className="text-xs text-[#6b7280]">
        ¿Problemas para acceder? Contacta con el administrador.
      </p>
    </div>
  );
};

export default SignInPage;
