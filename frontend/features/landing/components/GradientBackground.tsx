// Fondo fijo del estudio: canvas cálido + dos manchas de acento muy diluidas
// que derivan lento (ver .landing-glow-* en ../landing-tokens.css). Reemplaza
// el ciclo de gradientes violeta/magenta heredado del template — acá el
// acento es escaso a propósito, el fondo solo sugiere profundidad.
export default function GradientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--landing-canvas)]"
    >
      <div
        className="landing-glow landing-glow-1 absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--landing-accent-soft-strong)" }}
      />
      <div
        className="landing-glow landing-glow-2 absolute -bottom-52 -left-32 h-[30rem] w-[30rem] rounded-full blur-3xl"
        style={{ backgroundColor: "var(--landing-accent-soft)" }}
      />
      {/* Vignette sutil: profundiza los bordes sin tocar el centro de lectura. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, var(--landing-canvas-veil) 100%)",
        }}
      />
    </div>
  );
}
