/// <reference types="vite/client" />
import { useEffect, useRef, useState } from "react";

// Widget de Cloudflare Turnstile, reutilizable en los 3 formularios que
// llevan captcha (registro, login, olvidé mi contraseña).
//
// Cómo usarlo:
//   const [captchaToken, setCaptchaToken] = useState<string | null>(null);
//   <Turnstile onToken={setCaptchaToken} />
//   // y mandar captchaToken en el body del request

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

// El script de Cloudflare se carga una sola vez aunque haya varios
// widgets de Turnstile montados en la misma página a la vez.
let scriptLoadingPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Turnstile."));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

interface Props {
  onToken: (token: string | null) => void;
}

export default function Turnstile({ onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) {
      // En desarrollo, si todavía no configuraste VITE_TURNSTILE_SITE_KEY,
      // el widget simplemente no aparece (no rompe el formulario) — pero
      // el backend va a rechazar el submit igual si tiene la secret key
      // configurada, así que conviene setear ambas para probar el flujo
      // completo.
      console.warn("VITE_TURNSTILE_SITE_KEY no está definida — el widget de captcha no se va a mostrar.");
      return;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => {
            setError("No se pudo cargar la verificación. Recargá la página.");
            onToken(null);
          },
        });
      })
      .catch(() => setError("No se pudo cargar la verificación. Recargá la página."));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div className="turnstile-wrapper">
      <div ref={containerRef} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}