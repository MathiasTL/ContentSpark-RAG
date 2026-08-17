---
target: frontend/features/onboarding
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T02-51-44Z
slug: frontend-features-onboarding
---
Method: dual-agent (A: design review sub-agent · B: detector/browser evidence sub-agent)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Progress bar + aria-live es sólido; el estado `isSubmitting` solo cambia el texto del botón, sin peso visual extra, y no hay transición entre pasos. |
| 2 | Match System / Real World | 4 | Copy natural en español, ejemplos de dominio apropiados. |
| 3 | User Control and Freedom | 2 | No hay forma de salir del wizard antes de terminarlo (sin X, sin "completar después"). Solo Atrás/Siguiente. |
| 4 | Consistency and Standards | 1 | Cada input de los 4 steps reescribe a mano la misma clase (`rounded-2xl border border-white/40 bg-surface-container-lowest/30...`) en vez de usar `Field`/`Button` de `shared/components/ui`. |
| 5 | Error Prevention | 2 | Validación por paso existe, pero `current_frequency`/`desired_frequency` son texto libre sin guarda de formato donde un select serviría. |
| 6 | Recognition Rather Than Recall | 3 | Opciones visibles (chips, checkboxes, selects). Diccionarios de labels duplicados por archivo (deuda menor de mantenimiento). |
| 7 | Flexibility and Efficiency | 2 | No hay atajo de teclado para avanzar (no hay `<form>`), la barra de progreso no permite saltar a un paso completado. |
| 8 | Aesthetic and Minimalist Design | 2 | Gradiente en el CTA choca con inputs de color plano; `red-50/red-600/red-700` y `text-[#75777b]/50` sueltos rompen la gramática visual del resto del sistema. |
| 9 | Error Recovery | 3 | Errores de campo específicos y bien atribuidos (aria-describedby/role=alert). El error de submit es genérico pero aceptable. |
| 10 | Help and Documentation | 1 | Cero tooltips o explicación de "para qué preguntamos esto" en un flujo de primer uso, donde más importa. |
| **Total** | | **23/40** | **Aceptable** |

#### Design Specificity Verdict

**LLM assessment (Assessment A):** El wizard es intercambiable con cualquier categoría. Nada en la composición, el ritmo de copy o la interacción dice "estudio de cristal atravesado por violeta escaso": es un wizard de 4 pasos genérico sobre una tarjeta translúcida. El botón de cierre del flujo — el momento emocional más alto de todo el onboarding — es un gradiente con `hover:scale-[1.02] active:scale-95`, exactamente lo que DESIGN.md prohíbe por nombre y ya registra como deuda en otros dos archivos; onboarding suma un tercero. Ninguno de los cuatro primitivos compartidos (`Button`, `Field`, `Alert`, `PasswordField`) que el propio DESIGN.md exige para esta superficie (punto 5c del backlog) se usa en ninguno de los 7 archivos.

**Deterministic scan (Assessment B):** `detect.mjs --json frontend/features/onboarding` → exit code 0, `[]` (cero hallazgos). Esto contradice directamente lo que la lectura manual encontró (gradiente + scale en el CTA, `red-50/600/700` sueltos, `text-[#75777b]/50`, `rounded-2xl` fuera de los 4 radios sancionados). Se interpreta como una laguna del detector automático sobre este target, no como que el código esté limpio — la evidencia de código (líneas citadas por Assessment A) es concreta y verificable a mano. No se tratan como falsos positivos: son falsos negativos del detector.

**Visual overlays:** no disponibles. Assessment B navegó a `/onboarding` pero el guard de auth de `frontend/app/(app)/layout.tsx` redirigió a `/login` sin credenciales de prueba disponibles; no se intentó inyección de overlay contra la página equivocada. Assessment A tampoco tuvo navegador — evaluación a nivel de código fuente únicamente.

#### Overall Impression

Funciona, es prolijo, y sin embargo no *es* ContentSpark. La arquitectura del hook (`useOnboardingWizard`) y la accesibilidad de la barra de progreso son de calidad real — pero la piel del wizard ignora el sistema de diseño que la propia superficie de auth ya demostró que funciona. La mayor oportunidad es mecánica y barata: consumir los primitivos que ya existen (`Button`, `Field`, `Alert`) en vez de seguir escribiendo la misma clase 8 veces.

#### What's Working

- `useOnboardingWizard.ts` separa limpiamente validación de UX vs. reglas de completitud del backend, con comentario explícito para no confundirlas — disciplina real, poco común en código de onboarding.
- `WizardProgress.tsx` comunica el progreso por dos canales (barra visual + `role="progressbar"` + región `aria-live`) — accesibilidad genuina, no un gesto de compliance.
- El patrón de reset en fase de render (`renderedStep`/`setShowErrors`) más el foco automático al heading en cada cambio de paso es una solución correcta a un problema de accesibilidad en SPAs que casi siempre se salta.

#### Priority Issues

- **[P0] El CTA primario viola dos reglas explícitas de DESIGN.md a la vez**
  Qué: `OnboardingWizard.tsx:132` — gradiente `from-primary to-primary-container` + `hover:scale-[1.02] active:scale-95` en el botón Finalizar/Siguiente.
  Por qué importa: es el elemento más presionado del flujo (4 veces por usuario) e incluye el momento de cierre emocional del onboarding; contradice ambas prohibiciones nombradas explícitamente en DESIGN.md y no usa el primitivo `Button` que ya encapsula el spec correcto.
  Fix: reemplazar por `Button`/`buttonClass` de `shared/components/ui`, fondo plano `primary` con `hover:bg-primary-hover`, sin transform, transición de 150ms solo en color.
  Comando sugerido: `$impeccable polish`

- **[P0] Cero reutilización de primitivos compartidos en las 4 vistas de paso**
  Qué: cada input/select/checkbox/botón secundario en Step1-4 reescribe su propia clase (duplicada 8+ veces) en vez de usar `Field`, `Button`, `Alert`.
  Por qué importa: DESIGN.md ya nombra esto como regla obligatoria para onboarding (punto 5c del backlog) y lo cataloga como defecto, no variante; cualquier cambio de token futuro requiere hoy 8+ ediciones sincronizadas.
  Fix: migrar cada `<input>`/`<select>` a `Field`, cada `<button>` a `Button`, cada bloque de error a `Alert`.
  Comando sugerido: `$impeccable harden`

- **[P1] Utilidades hardcodeadas y hex sueltos rompen el modo oscuro en toda la superficie**
  Qué: `border-white/20`, `border-white/40`, `bg-red-50/80`, `text-red-700`, `text-red-600`, `text-[#75777b]/50` repetidos en los 4 steps + wizard — el patrón que DESIGN.md nombra explícitamente como anti-patrón.
  Por qué importa: en modo oscuro estos bordes van en la dirección de tinte equivocada y el error rojo no tiene el par de contraste medido que sí tienen los tokens `danger`/`danger-container`.
  Fix: `border-white/40` → `border-glass-edge`; `bg-red-50/80 text-red-700` → `bg-danger-container text-danger`; `text-[#75777b]/50` → `text-on-surface-variant/60`.
  Comando sugerido: `$impeccable colorize`

- **[P1] Step4Formats apila dos superficies de decisión de +4 opciones sin secuenciar (falla de carga cognitiva)**
  Qué: 5 checkboxes de formato + select de 5 plataformas + input de handle + lista visibles simultáneamente, en lo que el propio comentario del código llama el paso opcional de menor riesgo.
  Por qué importa: invierte la experiencia esperada — el paso pensado como rápido y saltable es visualmente el más denso del wizard, justo antes del cierre.
  Fix: separar en secciones con más aire, o esconder "Redes sociales" detrás de un toggle "+ Agregar red social" con revelado progresivo.
  Comando sugerido: `$impeccable layout`

- **[P2] Sin salida/skip del wizard y sin confirmación de cierre**
  Qué: no hay X ni "completar después"; al enviar con éxito se redirige a `/chat` sin ningún estado de éxito intermedio.
  Por qué importa: golpea el heurístico de control del usuario y desperdicia el momento de cierre emocional (peak-end) del flujo.
  Fix: agregar enlace discreto "Completar más tarde" y una confirmación breve antes del redirect.
  Comando sugerido: `$impeccable onboard`

#### Persona Red Flags

**Jordan (First-Timer)**: en Step1Niche.tsx, "Sub-nicho (opcional)" tiene el mismo peso visual que el select obligatorio de Nicho — nada salvo la palabra "opcional" distingue requerido de opcional en todo el flujo. Sin salida visible si se traba en preguntas abstractas como "Tono de tu contenido" (solo un placeholder de ejemplo, sin explicar para qué se usa).

**Casey (Mobile)**: el botón "Agregar" en Step4Formats.tsx usa `px-4 py-2.5` sin `min-height` explícito, probablemente por debajo de la regla de 44px que el propio DESIGN.md exige para controles táctiles. El enlace "Quitar" es texto inline sin caja de padding — objetivo de toque muy pequeño para una acción destructiva.

**Sam (Accessibility)**: el auto-foco al heading en cada cambio de paso (correcto en principio) obliga a un Tab extra antes de llegar al primer campo real, en cada uno de los 4 pasos, para todo usuario de teclado/lector de pantalla.

#### Minor Observations

- `NICHE_LABELS`/`FORMAT_LABELS`/`PLATFORM_LABELS` duplicados inline por archivo en vez de vivir junto a `NICHES`/`FORMATS`/`PLATFORMS` en `shared/constants`.
- `Step4Formats.tsx` seedea `platform` con `PLATFORMS[0]` — default implícito y frágil si el array cambia de orden.
- Dos canales de error de submit superpuestos (`submitError` local + `error` del hook) renderizados por el mismo bloque `role="alert"`.
- `rounded-2xl` en los inputs no es ninguno de los 4 radios sancionados (`sm`/`md`/`lg`/`full`) — viola la "Regla del Cuarto Radio" en cada input del feature.

#### Questions to Consider

- Si los primitivos `Field`/`Button`/`Alert` se construyeron para que features como esta no reinventaran estilos por paso, ¿por qué onboarding — la superficie de mayor impacto de primer uso — es la que los evita por completo?
- ¿Cómo se sentiría si el botón de cierre en Step4Formats se distinguiera visualmente de "Siguiente" en los pasos 1-3, marcando que ahí se desbloquea la experiencia personalizada?
- ¿Step4Formats es realmente un paso, o son dos decisiones (preferencia de formato, vínculo de redes) disfrazadas de un solo fieldset — y separarlas bajaría el pico de densidad justo antes del cierre?
