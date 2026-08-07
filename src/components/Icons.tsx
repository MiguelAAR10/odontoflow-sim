/**
 * Iconos.
 *
 * El diente está trazado a mano siguiendo el estilo de Healthicons (CC0), que
 * es el set de referencia para producto sanitario. Los demás son line art de la
 * misma familia: un solo grosor de trazo, sin relleno, sin decoración. Un
 * calendario genérico haría que esto pareciera cualquier agenda.
 */

type Props = { size?: number; className?: string };

export function Diente({ size = 15, className }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden>
      <path d="M12 3.2c-1.1 0-1.9.5-2.9.5-1 0-1.6-.5-2.7-.5C4.5 3.2 3 5.1 3 8.1c0 2.2.6 3.9 1.2 5.8.5 1.6.7 3.1.9 4.6.2 1.4.6 2.3 1.6 2.3 1.1 0 1.4-1 1.6-2.5.2-1.6.4-3.4 1.7-3.4s1.5 1.8 1.7 3.4c.2 1.5.5 2.5 1.6 2.5 1 0 1.4-.9 1.6-2.3.2-1.5.4-3 .9-4.6.6-1.9 1.2-3.6 1.2-5.8 0-3-1.5-4.9-3.4-4.9-1.1 0-1.7.5-2.7.5-.4 0-.8-.1-1.2-.2" />
    </svg>
  );
}

const trazo = (d: React.ReactNode, size: number, className?: string) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {d}
  </svg>
);

export const Ingresos = ({ size = 14, className }: Props) =>
  trazo(<path d="M4 19V9M9.5 19V5M15 19v-7M20.5 19v-4" />, size, className);

export const Flujo = ({ size = 14, className }: Props) =>
  trazo(
    <>
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="11" rx="1" />
      <rect x="17" y="4" width="4" height="7" rx="1" />
    </>,
    size,
    className,
  );

export const Pendientes = ({ size = 14, className }: Props) =>
  trazo(
    <>
      <path d="M4 5h16M4 12h10M4 19h6" />
      <circle cx="18" cy="17" r="3" />
    </>,
    size,
    className,
  );

export const Reglas = ({ size = 14, className }: Props) =>
  trazo(
    <>
      <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.6" />
    </>,
    size,
    className,
  );

export const Reloj = ({ size = 14, className }: Props) =>
  trazo(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>,
    size,
    className,
  );
