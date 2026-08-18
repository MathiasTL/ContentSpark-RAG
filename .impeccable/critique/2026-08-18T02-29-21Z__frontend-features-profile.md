---
target: frontend/features/profile
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-18T02-29-21Z
slug: frontend-features-profile
---
Method: dual-agent (A: general-purpose · B: general-purpose)

#### Design Health Score

| # | Heurístico | Score | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Sin confirmación de éxito tras guardar |
| 2 | Coincidencia con el mundo real | 3 | Copy claro, falta contexto sobre efecto en el RAG |
| 3 | Control y libertad del usuario | 1 | Sin cancelar/descartar, sin aviso de cambios sin guardar |
| 4 | Consistencia y estándares | 1 | Reescribe clases a mano en vez de Field/Button/Alert |
| 5 | Prevención de errores | 2 | Vaciar un campo lo vuelve null sin advertencia |
| 6 | Reconocimiento antes que recuerdo | 3 | Labels presentes y persistentes |
| 7 | Flexibilidad y eficiencia de uso | 2 | Sin atajos ni guardado parcial |
| 8 | Diseño estético y minimalista | 2 | 9 campos sueltos sin agrupación real |
| 9 | Ayuda a reconocer/diagnosticar errores | 2 | Solo banner global, sin aria-describedby por campo |
| 10 | Ayuda y documentación | 1 | Campos abstractos sin hint (tono, objetivo, audiencia) |
| **Total** | | **19/40** | **Poor** |

#### Design Specificity Verdict

**LLM assessment**: No es autoral. ProfileForm.tsx es indistinguible de cualquier formulario CRUD genérico: labels uppercase + input blanco translúcido repetido 9 veces, botón degradado con hover:scale. Comparado con TimezoneNudge.tsx (tokens semánticos, copy con razón de negocio) o con auth/onboarding ya cerrados, esta vista parece congelada antes de que existieran los primitivos compartidos.

**Deterministic scan**: `detect.mjs --json` devolvió `[]` (exit 0) — cero findings. Sin embargo el grep manual de sanidad sobre el mismo árbol encontró 15+ matches de patrones prohibidos: `border-white` en 12 ubicaciones de ProfileForm.tsx (inputs, textarea, selects, botón, contenedor de ProfileView.tsx), `bg-white/20` en TimezoneNudge.tsx:78, `red-200/red-50/red-700` hardcodeados en el banner de error (ProfileForm.tsx:167), hex suelto `text-[#75777b]` en dos placeholders (líneas 305, 321), y `hover:scale-[1.02]`/`active:scale-95` en el botón submit (línea 377). Discrepancia fuerte entre detector y evidencia real — el detector no está capturando estos patrones en este target (posible gap de reglas o path-matching), así que el grep manual es la fuente confiable acá, no el `[]` del detector.

Uso de primitivos compartidos: 0/11 controles (7 inputs + 1 textarea + 2 selects) usan `Field`; el banner de error no usa `Alert`; el botón no usa `Button`. El patrón de clase de input se repite casi idéntico en 9 lugares.

**Visual overlays**: no disponibles — no hay dev server corriendo y no se levantó uno en este pase.

#### Overall Impression

Profile es, tal como decía el ledger, la superficie con más deuda reconocida y la última en recibir migración: cero primitivos, cero tokens semánticos en los inputs, y una funcionalidad de producto directamente ausente (gestión de cuentas sociales). Lo que sí funciona (TimezoneNudge, lógica de timezone, diffEditable) revela que el resto del feature fue escrito por otra mano, o en otro momento, sin pasar por el sistema.

#### What's Working

1. **TimezoneNudge.tsx** — manejo defensivo de localStorage (Safari privado, políticas empresariales) documentado, degradación elegante, tokens semánticos correctos.
2. **Lógica de timezone (ProfileForm.tsx:140-160)** — antepone zona detectada + guardada a la lista curada, evita pérdida silenciosa de datos fuera de la lista.
3. **diffEditable (ProfileForm.tsx:61-86)** — PUT parcial correcto, no resobrescribe campos no tocados.

#### Priority Issues

**[P0] Falta la edición de cuentas sociales en el perfil**
- Por qué importa: el creador no tiene ruta en la UI para corregir un handle o desconectar una red tras el onboarding.
- Fix: sección "Cuentas sociales" en ProfileForm.tsx reutilizando el patrón de Step4Formats.tsx; incluir social_accounts en el diff de ProfileUpdateInput.
- Suggested command: $impeccable shape (para diseñar la sección antes de escribir código) o directo a implementación si el alcance ya está claro.

**[P1] Violación sistemática del design system**
- Por qué importa: exactamente la regla que el ledger ya marcó como defecto para profile/landing; border-white/40 no responde a modo oscuro/claro.
- Fix: reemplazar cada input/label por Field, el banner por Alert tone="danger", el botón por Button.
- Suggested command: $impeccable harden o implementación directa (mismo patrón usado en auth/onboarding/chat/calendar).

**[P1] Sin confirmación de éxito tras guardar**
- Por qué importa: viola peak-end rule en un momento de alto riesgo; sin señal de que el guardado ocurrió (WCAG 4.1.3 status messages).
- Fix: estado saveSuccess en profileStore.ts, Alert tone="success" role="status" transitorio.

**[P1] Vaciar un campo lo convierte en null sin advertencia**
- Por qué importa: puede revertir el perfil a "incompleto" sin feedback.
- Fix: distinguir campos opcionales de obligatorios; bloquear submit con error inline para obligatorios vacíos.

**[P2] Sin agrupación/jerarquía visual entre 9 campos sueltos**
- Por qué importa: falla chunking ≤4 y agrupación de la checklist de carga cognitiva.
- Fix: agrupar en secciones (Identidad, Estrategia de contenido, Cuándo publicás).

#### Persona Red Flags

**Alex (Power User)**: no puede editar ni desconectar una cuenta social desde /profile — única vía es el wizard de onboarding, probablemente no re-invocable.

**Jordan (First-Timer)**: "Tono" y "Objetivo principal" son inputs de texto libre sin placeholder ni hint, a diferencia de "Frecuencia" que sí tiene placeholder de ejemplo.

**Sam (Accesibilidad)**: único error es un banner global sin aria-describedby hacia ningún campo específico; ni error ni botón usan los primitivos accesibles que ya resuelven esto en otras superficies.

#### Minor Observations

- "Cargando perfil..." sin spinner visual, solo texto.
- Checkboxes de formato sin estilo de foco visible custom (dependen del default del browser).
- Botón "Guardar cambios" no se deshabilita sin cambios pendientes; el submit sin diff se descarta silenciosamente.

#### Questions to Consider

- Si el perfil personaliza el RAG, ¿por qué no comunica el impacto de cada campo en las respuestas del chat?
- ¿Por qué las cuentas sociales tienen alta de creación pero ningún flujo de gestión?
- ¿Por qué profile, con más deuda reconocida, fue la última en recibir la migración a primitivos?
