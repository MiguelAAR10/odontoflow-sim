import { useEffect } from "react";

/**
 * Toast de confirmación.
 *
 * Tras ejecutar una acción (confirmar, posponer, guardar reglas), aparece un
 * mensaje breve que confirma que el sistema la registró. Sin esto, la cita
 * desaparece de la lista sin feedback y el usuario queda sin saber si funcionó.
 */

export function Toast({ mensaje, onCerrar }: { mensaje: string | null; onCerrar: () => void }) {
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(onCerrar, 2600);
    return () => clearTimeout(t);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="anim-arriba pointer-events-auto flex items-center gap-2.5 rounded-xl bg-dark px-4 py-3 text-[14px] font-medium text-white shadow-lg"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {mensaje}
      </div>
    </div>
  );
}
