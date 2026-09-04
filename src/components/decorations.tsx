import { cn } from "@/lib/utils";

/**
 * Elementos decorativos com vocabulário de consultório: a cruz da farmácia/saúde
 * e a linha do eletrocardiograma. Usados em fundos, sempre discretos.
 */

/** Malha de cruzinhas, tipo papel de parede de clínica. */
export function CrossPattern({
  id,
  className,
  size = 30,
}: {
  /** Precisa ser único por página — o SVG referencia o pattern pelo id. */
  id: string;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(12)"
        >
          <path
            d={`M${size / 2} ${size / 2 - 4.5}v9M${size / 2 - 4.5} ${size / 2}h9`}
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** Traçado de eletrocardiograma. */
export function PulseLine({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 640 64"
      preserveAspectRatio="none"
      className={cn("pointer-events-none w-full", className)}
    >
      <path
        d="M0 32h96l10-16 12 34 11-24 9 12h84l12-20 13 38 12-26 10 8h92l11-18 13 34 11-22 10 8h94l12-14 12 26 11-14h97"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Marca do produto: cruz + batimento, dentro de um quadrado arredondado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[62%]" aria-hidden>
        <path
          d="M3 12.5h3.2l1.6-3.6 2.4 7.2 2-5.2 1.3 2.4h2.1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.2 8.4v4.2M17.1 10.5h4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
