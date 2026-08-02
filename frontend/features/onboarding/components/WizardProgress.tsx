"use client";

interface WizardProgressProps {
  step: number;
  totalSteps: number;
  titles: string[];
}

// Comunica el avance del wizard tanto visualmente (barra de segmentos) como
// a lectores de pantalla (role="progressbar" + región aria-live con texto).
export default function WizardProgress({ step, totalSteps, titles }: WizardProgressProps) {
  const percent = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Paso ${step + 1} de ${totalSteps}`}
    >
      <p className="sr-only" aria-live="polite">
        {`Paso ${step + 1} de ${totalSteps}: ${titles[step]}`}
      </p>
      <ol className="flex items-center gap-2">
        {titles.map((title, index) => (
          <li
            key={title}
            aria-hidden="true"
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= step ? "bg-[#6e2ce0]" : "bg-white/30"
            }`}
          />
        ))}
      </ol>
    </div>
  );
}
