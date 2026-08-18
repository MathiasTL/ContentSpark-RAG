import type { ReactNode } from "react";

/**
 * Adaptado de Magic UI "Marquee" (magicui.design/docs/components/marquee) al
 * stack del proyecto: animación en CSS puro (sin dependencia nueva), pausa en
 * hover/focus y se anula bajo `prefers-reduced-motion` vía la clase
 * `motion-reduce:animate-none` de Tailwind.
 */
export default function Marquee({
  children,
  reverse = false,
  durationS = 32,
}: {
  children: ReactNode;
  reverse?: boolean;
  durationS?: number;
}) {
  return (
    <div className="group flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className="landing-marquee-track flex shrink-0 items-center justify-around gap-4 group-hover:[animation-play-state:paused]"
          style={{
            animationName: reverse ? "landing-marquee-reverse" : "landing-marquee",
            animationDuration: `${durationS}s`,
          }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
