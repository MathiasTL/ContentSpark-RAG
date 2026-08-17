---
target: frontend/features/calendar
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T03-57-43Z
slug: frontend-features-calendar
---
Method: dual-agent (A: design review sub-agent · B: detector/browser evidence sub-agent)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Generando…" es solo texto en el botón, sin progreso; sin skeleton de carga inicial en `CalendarView.tsx`. |
| 2 | Match System / Real World | 3 | Labels en español correctos; "Visual Timeline" en `TimelineCards.tsx:120` queda en inglés dentro de un producto todo en español. |
| 3 | User Control and Freedom | 2 | Sin undo al borrar un calendario (`ConfirmBar.tsx:46`, `remove(id)` directo); sin aviso de cambios sin guardar al cerrar `EntryEditModal`. |
| 4 | Consistency and Standards | 1 | Cinco botones "Próximamente" distintos sin patrón compartido; radios `rounded-[2rem]`/`rounded-[3rem]` arbitrarios conviviendo con `rounded-2xl`/`rounded-3xl` en la misma vista. |
| 5 | Error Prevention | 2 | El input de frecuencia tiene `min/max` pero sin pista visible del rango; los inputs de cantidad por formato no tienen tope superior. |
| 6 | Recognition Rather Than Recall | 3 | Los chips de entrada dependen del color de borde para identificar plataforma/formato, sin ícono. |
| 7 | Flexibility and Efficiency | 1 | El toggle Mes/Semana de `TopBar.tsx` usa un `useState` local desconectado del `viewMode` que lee `CalendarGrid.tsx` del store — son dos estados distintos. Timeline/Grid/Statistics, navegación prev/next y sync están todos deshabilitados. |
| 8 | Aesthetic and Minimalist Design | 1 | Sidebar con 3 paneles semi-decorativos (GoogleSyncButton deshabilitado, PerformancePanel y ActivityPanel con datos falsos, CreatorTip con dato inventado) apilados junto a la columna real — ruido visual alto para una pantalla cuyo trabajo real es "generar y revisar". |
| 9 | Error Recovery | 2 | Los errores sí tienen `role="alert"`, pero en `text-red-300` crudo (no `danger`/`Alert`) y sin indicar qué hacer después. |
| 10 | Help and Documentation | 2 | `CreatorTip.tsx` simula ser ayuda contextual pero es dato inventado, no ayuda real. |
| **Total** | | **19/40** | **Pobre** |

#### Design Specificity Verdict

**LLM assessment (A):** es la superficie menos "Estudio de Cristal" del producto. `PerformancePanel.tsx` tiene un gráfico de barras con valores `[40, 60, 30, 90, 50, 75, 45]` hardcodeados y relleno de gradiente decorativo (prohibido explícitamente); `ActivityPanel.tsx` inventa ítems de actividad ficticios con hex por ítem (`#b08cff`, `#3b82f6`, `#ec4899`) que no existen en ningún otro lugar del sistema; `CreatorTip.tsx` hardcodea "tu audiencia está más activa a las 7:00 PM... 20% más de alcance" como si fuera dato real — PRODUCT.md prohíbe explícitamente inventar métricas o prueba social. Ninguno de los tres paneles del sidebar está conectado a store o API real: son decoración estática presentada como producto funcionando. Sumado a ~80 utilidades hardcodeadas (la deuda más grande del ledger) y `hover:scale`/`active:scale` casi universal — un Don't nombrado explícitamente — esta superficie no recibió el mismo tratamiento que auth, onboarding y chat.

**Deterministic scan (B):** `detect.mjs --json frontend/features/calendar` → exit 0, `[]`. Un grep manual de sanidad sobre patrones conocidos (gradientes, scale, `red-*`/`green-*`/`gray-*`/`slate-*`/`rose-*`, hex sueltos) encontró 40 líneas con coincidencias en 10 de los 12 archivos. Mismo patrón de falso negativo ya confirmado en onboarding y chat — se toma como evidencia de cobertura parcial del detector, no como superficie limpia.

**Visual overlays:** no disponibles — B navegó a `/calendar` pero el guard de auth redirigió a `/login` sin credenciales, mismo bloqueo de siempre. A no tuvo navegador.

#### Overall Impression

Calendar es la superficie más grande y la que más se aleja del sistema de diseño. El problema no es solo estético: hay datos fabricados presentados como reales (rendimiento, actividad, tip de audiencia) en un producto cuya propuesta de valor es justamente la personalización basada en datos reales — eso es un riesgo de confianza, no solo de deuda visual. Además hay un bug funcional real: el toggle Mes/Semana probablemente no hace nada porque lee de un estado que nadie escribe.

#### What's Working

- `CalendarGrid.tsx:172-184` — el indicador "+N entradas adicionales" para días con muchas entradas es un detalle de UX genuinamente bien pensado, con comentario que explica la intención.
- `EntryEditModal.tsx:87-90` — a diferencia de otros overlays históricos del proyecto (como `SourcesModal` antes de su fix), este sí lleva `role="dialog"` y `aria-modal="true"` — crédito parcial, falta el resto del patrón (ver P0).
- `CalendarEmptyState.tsx` + `CalendarView.tsx:31-40` — distingue "sin calendarios todavía" de "perfil incompleto" vía un `errorStatus` tipado, no matching de substring frágil. Disciplina de ingeniería real al servicio de una distinción de UX real.

#### Priority Issues

- **[P0] `EntryEditModal.tsx` no es un diálogo accesible real pese a tener `role="dialog"`**
  Qué: sin focus trap, sin Escape, sin foco inicial gestionado, sin devolver el foco al trigger al cerrar — comparado con `ChatMobileDrawer.tsx`, el patrón ya probado en este mismo repo.
  Por qué importa: es exactamente la misma clase de bug que tenía `SourcesModal.tsx` antes de su fix; un usuario de teclado puede tabular fuera del modal hacia la página de atrás.
  Fix: portar el mismo focus-trap/Escape/focus-restore de `ChatMobileDrawer.tsx`.
  Comando sugerido: `$impeccable harden`

- **[P0] El toggle Mes/Semana de `TopBar.tsx` está desconectado del estado real del grid**
  Qué: `TopBar.tsx` mantiene `useState` local para la vista; `CalendarGrid.tsx` lee `viewMode` de `useCalendarStore` — son dos estados distintos, sin puente entre ellos en ninguno de los 12 archivos leídos.
  Por qué importa: es muy probable que clickear Mes/Semana no cambie nada en el grid — un control silenciosamente roto en la herramienta de planificación central del producto.
  Fix: subir `viewMode` al store y que `TopBar` use el setter del store en vez de estado local.
  Comando sugerido: revisar y corregir directamente (bug funcional, no solo de diseño)

- **[P1] Datos fabricados en `PerformancePanel.tsx`, `ActivityPanel.tsx` y `CreatorTip.tsx` presentados como reales**
  Qué: alturas de barra hardcodeadas, ítems de actividad ficticios, y una estadística inventada ("7:00 PM", "20% más de alcance"), ninguno conectado a store o API.
  Por qué importa: PRODUCT.md prohíbe explícitamente inventar métricas o prueba social; una vez que el usuario nota que el "+12%" nunca cambia, la confianza en el resto de los números del producto se erosiona.
  Fix: conectar a datos reales del backend si existen, o reemplazar por un estado vacío honesto ("Aún no hay datos de rendimiento").
  Comando sugerido: `$impeccable audit`

- **[P1] Borrado de calendario sin confirmación ni undo**
  Qué: `ConfirmBar.tsx:44-52` dispara `remove(id)` directo en el click, sin paso de confirmación.
  Por qué importa: borrar un calendario (potencialmente semanas/meses de contenido planificado) es una acción de alto riesgo e irreversible desde la UI, sin ninguna red de contención.
  Fix: agregar confirmación de dos pasos, mismo patrón "Sí/No" que ya existe en `ChatListItem.tsx`.
  Comando sugerido: `$impeccable harden`

- **[P2] Deuda de paleta hardcodeada y gradientes en casi todos los archivos**
  Qué: `red-300/400/500`, `pink-*`, `blue-*`, `sky-*`, `emerald-400` dispersos en `ConfirmBar.tsx`, `EntryEditModal.tsx`, `GenerateControl.tsx`, `CalendarGrid.tsx`, `TimelineCards.tsx`, `PerformancePanel.tsx`, `ActivityPanel.tsx`; hex sueltos (`text-[#75777b]/50`, mismo literal ya corregido en onboarding); gradiente decorativo en `PerformancePanel.tsx:35` y `TimelineCards.tsx:167`.
  Por qué importa: es el ítem de deuda más grande del ledger (~80 utilidades) y esta pasada confirma que el conteo es plausible.
  Fix: migración sistemática a tokens, mismo tratamiento que auth/onboarding/chat ya recibieron; DESIGN.md ya sugiere `secondary` para la segunda serie del panel de rendimiento.
  Comando sugerido: `$impeccable colorize` / `$impeccable harden`

- **[P2] `hover:scale`/`active:scale` en casi todos los controles interactivos**
  Qué: presente en `CalendarEmptyState.tsx`, `ConfirmBar.tsx`, `GenerateControl.tsx`, `GoogleSyncButton.tsx`, `CalendarGrid.tsx`, `TimelineCards.tsx`, `EntryEditModal.tsx`, `TopBar.tsx` — prácticamente todos los botones primarios.
  Por qué importa: DESIGN.md prohíbe esto por nombre y ya fue el defecto P0 corregido en chat (ledger 14) — calendar reintroduce el mismo defecto ya eliminado en otro lado.
  Fix: quitar todos los `scale-*`, migrar a `Button`/`buttonClass`.
  Comando sugerido: `$impeccable polish`

- **[P3] Cero adopción de primitivos compartidos (Button/Field/Alert) en las 12 vistas**
  Qué: cada botón, input, select y mensaje de error está escrito a mano.
  Por qué importa: la regla 5c de DESIGN.md nombra calendar explícitamente; cero adopción aquí significa que cada cambio futuro de token/radio/foco se aplica a mano en 12 archivos en vez de 3 componentes compartidos.
  Fix: reemplazar por `Field`/`Button`/`Alert` en `GenerateControl.tsx`, `EntryEditModal.tsx`, `ConfirmBar.tsx`.
  Comando sugerido: `$impeccable harden`

#### Persona Red Flags

**Alex (power-user):** toda la superficie de control avanzado está deshabilitada — tabs Timeline/Grid View/Statistics, navegación prev/next, y "Sync Calendar" son `disabled title="Próximamente"`. Sin el toggle Mes/Semana (que además está roto), no hay forma de navegar entre meses.

**Sam (accesibilidad):** `EntryEditModal.tsx` no cumple el estándar de foco/Escape ya probado en el propio repo (P0). Los chips de entrada en `CalendarGrid.tsx` renderizan texto en `text-[8px]` en mobile — por debajo de cualquier tamaño mínimo legible razonable.

**Riley (stress-test):** el caso de muchas entradas en un día está bien resuelto (indicador +N, fortaleza real). Pero una generación fallida no tiene tratamiento distinto de un error de validación menor — mismo texto rojo plano, sin reintento con los mismos parámetros, sin indicación de cuánto puede tardar antes de asumir que se colgó.

#### Minor Observations

- `TimelineCards.tsx:120` — "Visual Timeline" queda en inglés.
- `TopBar.tsx:83-87` — avatar hardcodea la inicial "M" en vez de derivarla del usuario real.
- `ActivityPanel.tsx:60` — `scale-110` en hover anidado dentro de un botón ya deshabilitado, doblemente innecesario.
- `CalendarGrid.tsx` y `TimelineCards.tsx` duplican mapeos casi idénticos de plataforma→color en dos archivos con valores levemente distintos — un solo módulo compartido evitaría la deriva.
- Radios `rounded-[2rem]`/`rounded-[3rem]` arbitrarios en vez del token `lg` (24px) sancionado.

#### Questions to Consider

- Si `PerformancePanel` y `ActivityPanel` no tienen ninguna fuente de datos real, ¿cuál es el argumento de producto para mostrarlos siempre en vez de cortarlos hasta que haya datos reales que mostrar?
- Dado que el estado Mes/Semana parece estructuralmente desconectado del grid que debería controlar, ¿esta pantalla se probó alguna vez clickeando en la app corriendo?
- Onboarding ya resolvió "no mostrar 5+ opciones simultáneas" con revelado progresivo (ledger 13) — ¿por qué el fieldset de cantidad por formato en `GenerateControl.tsx` regresa al mismo patrón que se acaba de arreglar tres archivos más allá en el mismo repo?
