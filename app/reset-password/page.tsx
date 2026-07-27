"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ResetPasswordPage = () => {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      } else if (session) {
        setReady(true);
      }
    });

    // If the recovery link already resolved before this listener attached.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const timeout = setTimeout(() => {
      setReady((current) => {
        if (!current) setInvalidLink(true);
        return current;
      });
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setError("No se pudo actualizar la contraseña. Pide un enlace nuevo.");
      return;
    }

    router.push("/documents");
    router.refresh();
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
        <p className="text-sm text-[#9aa0ac]">Nueva contraseña</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-y-4 rounded-xl bg-[#252b34] p-6">
        {invalidLink ? (
          <p className="text-sm text-red-400">
            Este enlace no es válido o ha caducado. Pide uno nuevo desde la
            pantalla de inicio de sesión.
          </p>
        ) : !ready ? (
          <p className="text-sm text-[#9aa0ac]">Comprobando el enlace...</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-2">
              <label htmlFor="new-password" className="text-sm text-white">
                Contraseña nueva
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 rounded-md bg-[#e9ebf7] px-3 text-sm text-[#1b2028] outline-none"
              />
            </div>

            <div className="flex flex-col gap-y-2">
              <label
                htmlFor="confirm-password"
                className="text-sm text-white"
              >
                Repite la contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 rounded-md bg-[#e9ebf7] px-3 text-sm text-[#1b2028] outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 h-10 rounded-md bg-white text-sm font-medium text-[#1b2028] transition hover:bg-white/90 disabled:opacity-60"
            >
              {isSubmitting ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
