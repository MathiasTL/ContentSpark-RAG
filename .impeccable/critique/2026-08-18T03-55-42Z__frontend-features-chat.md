---
target: frontend/features/chat
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-18T03-55-42Z
slug: frontend-features-chat
---
Method: dual-agent (A: revisión de diseño · B: detector + evidencia mecánica)

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado del sistema | 3 | Streaming/typing/stop bien cubiertos; no hay estado por mensaje (enviado/fallido), solo un banner global. |
| 2 | Correspondencia sistema / mundo real | 2 | Encuadre genérico "preguntame lo que sea"; el vocabulario del producto (nicho, formato, hook) no aparece en la UI. |
| 3 | Control y libertad del usuario | 2 | Sin editar último mensaje, sin regenerar, sin copiar. Reintentar solo reenvía el último turno y solo tras error de hilo completo. |
| 4 | Consistencia y estándares | 2 | 22 `border-white/*` + 3 `backdrop-blur-sm` (cuarto nivel de vidrio ilegal) en 7 archivos: chat quedó fuera de la barrida glass-edge. Botones hechos a mano en 8 archivos pese a existir `Button`/`buttonClass`. |
| 5 | Prevención de errores | 2 | Borrado de chat con confirmación inline (bien), pero Enter-para-enviar sin deshacer ni editar. |
| 6 | Reconocimiento antes que recuerdo | 3 | Sidebar con título + tiempo relativo; colapsado solo muestra inicial con tooltip. |
| 7 | Flexibilidad y eficiencia | 1 | Sin búsqueda ni filtro de chats, sin archivar, sin atajos más allá de Enter/Shift+Enter. `useChatList` trae la lista completa sin paginar. |
| 8 | Estética y diseño minimalista | 3 | Composición de vidrio limpia, pero dos blobs `blur-[120px]` en ChatView duplican la aurora global. |
| 9 | Recuperación de errores | 3 | `Alert` + Reintentar correctos; el error de fuentes tiene su propio estado inline. |
| 10 | Ayuda y documentación | 1 | Nada explica qué es "Fuentes", ni que las respuestas están personalizadas, ni cómo influir en eso. |
| **Total** | | **22/40** | **Aceptable (banda baja)** |

## Design Specificity Verdict

**Evaluación LLM:** otro clon de ChatGPT con abrigo violeta. El composer píldora con clip, las burbujas usuario-derecha/bot-izquierda con avatar, el footer "Powered by", el sidebar colapsable con "+": son las convenciones estructurales de todo producto de chat con IA desde 2023. Nada en el layout, el modelo de interacción o la jerarquía de información señala "asistente RAG anclado en la base de conocimiento propia del creador, personalizado por su perfil" — exactamente lo único que PRODUCT.md dice que un competidor no podría copiar sin rehacer la base.

Los dos lugares que podrían cargar especificidad están presentes pero estructuralmente invisibles:
- **Procedencia RAG:** existe (`SourcesModal.tsx`) pero es un botón de cabecera opcional, global (no por mensaje), y muestra una lista plana sin relación con la respuesta que estás leyendo.
- **Personalización por perfil:** cero superficie visible. Nada dice por qué una respuesta tiene la forma que tiene, ni siquiera que haya un perfil en juego.

**Escaneo determinista:** `detect.mjs` devolvió `[]` con exit 0. **Falso negativo confirmado** — es la segunda superficie de este proyecto donde el detector no ve violaciones reales (ya había pasado en profile). El barrido manual con `rg`, verificado en el hilo padre, encontró: 22 `border-white/*` en 7 archivos, 3 `backdrop-blur-sm` (cuarto nivel de difuminado, prohibido por la Regla de los Tres Vidrios), 1 `text-white/80`. Utilidades de paleta hardcodeadas: 0. Hex sueltos: 0. `scale`: 0. Gradientes: 0. Radios arbitrarios: 0. El ledger de DESIGN.md daba chat por cerrado, pero su barrida de `border-white` nunca incluyó `features/chat/**`.

**Falsos positivos descartados:** los dos `duration-300` son `transition-[width]` y `transition-transform`, y DESIGN.md limita la regla de 150ms a `color`/`background-color`. No son deuda.

**Evidencia de navegador:** no disponible. El dev server responde en :3000, pero `/chat` devuelve 307 al guard de auth de Supabase y no se intentó autenticar. Sin capturas ni overlay.

## Overall Impression

El motor está mejor construido que la interfaz. `chatSessionsStore.ts` maneja versionado de request por chat, aborto limpio y la distinción entre "esperando primer token" y "recibiendo tokens" con un cuidado que no se ve en muchos productos maduros. Los dos diálogos tienen focus trap manual correcto. Pero encima de esa base hay una carcasa de chat genérica que no muestra ni una sola de las tres cosas que hacen a ContentSpark distinto: la base de conocimiento del creador, su perfil, y el puente hacia el calendario.

La mayor oportunidad no es visual: es hacer que el chat **demuestre** que es RAG personalizado, en vez de afirmarlo en un párrafo de bienvenida.

## What's Working

1. **La máquina de estados de streaming** (`chatSessionsStore.ts`): `requestVersion` por chat protege contra condiciones de carrera al navegar mientras se streamea, el abort es limpio y `hasStartedStreaming` separa correctamente la espera del primer token de la recepción. Ingeniería real, no pulido visual.
2. **Semántica de diálogo en `SourcesModal` y `ChatMobileDrawer`**: `role`, `aria-modal`, focus trap con ciclo Tab/Shift+Tab, Escape, y devolución de foco al trigger. Los dos se comportan como diálogos de verdad.
3. **Separación drawer móvil / sidebar de escritorio**: `useChatMobileDrawer` y `useSidebarCollapsed` son hooks distintos a propósito, para no confundir una preferencia persistente con un overlay efímero. La decisión está comentada en el código.

## Priority Issues

**[P1] La personalización por perfil es invisible en la única superficie que debería anclarla**
- *Qué*: `WelcomeMessage` (ChatView.tsx:55-73) y `ChatHeader.tsx` no muestran rastro de nicho/tono/objetivo. `SUGGESTED_PROMPTS` (ChatView.tsx:28-32) son tres strings estáticos sin relación con ningún campo del perfil.
- *Por qué importa*: PRODUCT.md establece que el perfil es "la fuente de verdad que personaliza todo; ninguna feature debe ignorarlo". Hoy el usuario no puede saber desde la UI que la personalización siquiera ocurre — es una feature de backend sin prueba en la interfaz, lo que socava la diferenciación central del producto.
- *Fix*: prompts sugeridos derivados del perfil (nicho + formato), y una marca discreta en `ChatHeader.tsx` del tipo "Personalizado para: Fitness · TikTok".
- *Comando*: `$impeccable shape`

**[P1] El fallback a búsqueda web es silencioso y rompe la promesa de "tu base de conocimiento"**
- *Qué*: el pipeline CRAG cae a DuckDuckGo cuando el score de Qdrant no llega al umbral, pero nada en el render de mensajes (ChatView.tsx:252-269) ni en `SourcesModal.tsx` distingue una respuesta anclada en documentos ingeridos de una traída de la web abierta. Mientras tanto `WelcomeMessage` promete literalmente "ContentSpark busca en sus documentos ingestados".
- *Por qué importa*: es el mismo tipo de deshonestidad que ya se corrigió en calendar (ledger punto 17, métricas inventadas). Para un creador recién salido del onboarding y sin nada ingerido, es el peor momento posible para una sustitución callada: se lleva la impresión de que el producto no usa su contenido.
- *Fix*: insignia de procedencia por mensaje ("de tu base" / "de la web") usando el metadato de sources que el backend ya devuelve, junto a cada burbuja del asistente.
- *Comando*: `$impeccable harden`

**[P1] Chat quedó fuera de la barrida de glass-edge: 26 hardcodeos y un cuarto nivel de vidrio**
- *Qué*: 22 `border-white/*` (ChatView ×10, SourcesModal ×6, ChatHeader ×2, y uno en cada toggle/sidebar/drawer), 3 `backdrop-blur-sm` (ChatMobileDrawer:62, SourcesModal:71, ChatView:204) y 1 `text-white/80` (ChatView:246).
- *Por qué importa*: DESIGN.md mide un filo blanco sobre fondo claro en 1.03:1 — es decir, en modo claro esos 22 bordes no existen visualmente. Y `backdrop-blur-sm` es un cuarto nivel de difuminado que la Regla de los Tres Vidrios prohíbe explícitamente. El ledger daba chat por cerrado porque su verificación grepeó paleta y hex, no `border-white`.
- *Fix*: `border-glass-edge` / `border-glass-edge-soft` según el plano del elemento; los tres `backdrop-blur-sm` mapean a `backdrop-blur-md`; `text-white/80` a `text-on-primary`.
- *Comando*: `$impeccable polish`

**[P2] El modal de fuentes descarta las fuentes ingeridas por URL y no está scopeado a la conversación**
- *Qué*: `openSourcesModal()` (ChatView.tsx:143-163) trae la lista global de fuentes y filtra a solo PDFs (`type.includes("pdf") || title.endsWith(".pdf")`), descartando en silencio todo lo ingerido por URL — pese a que el pipeline soporta ambos. Además muestra la misma lista sin importar qué respuesta estabas leyendo.
- *Por qué importa*: en una superficie Operate donde la legibilidad de la procedencia es el trabajo central, un modal que descarta un tipo de fuente y no puede decirte "estos son los 3 documentos detrás de *esta* respuesta" no cumple su función.
- *Fix*: quitar el filtro de PDF y diferenciar por ícono según tipo; scopear al `Message.sources` de la respuesta activa, que ya existe en el modelo de datos.
- *Comando*: `$impeccable clarify`

**[P2] Sin acciones por mensaje: copiar es la acción de conversión de este producto**
- *Qué*: la burbuja del asistente (ChatView.tsx:253-268) renderiza Markdown sin ninguna afordancia: sin copiar, sin regenerar, sin reintento por mensaje.
- *Por qué importa*: un creador va a sacar hooks y guiones de las respuestas constantemente — copiar es literalmente cómo el chat se convierte en contenido. Es el puente entre estrategia y ejecución que PRODUCT.md nombra como principio, y hoy exige seleccionar texto a mano.
- *Fix*: fila de acciones revelada en hover bajo cada burbuja del asistente (copiar como mínimo), con el mismo patrón `opacity-0 group-hover:opacity-100` que ya usa `ChatListItem.tsx` para borrar.
- *Comando*: `$impeccable delight`

## Persona Red Flags

**Alex (usuario avanzado, muchos chats)**: sin búsqueda ni filtro en `ChatSidebarContent.tsx`, sin atajo de teclado para chat nuevo (solo el "+"), sin archivar, sin fijar. `useChatList` carga la lista completa sin paginación ni virtualización — se degrada visiblemente pasadas unas decenas de conversaciones.

**Jordan (primera vez)**: aterriza en un "Desata tu creatividad" genérico con tres prompts estáticos que no tienen que ver con nada de lo que configuró en el onboarding. El botón de adjuntar (`Paperclip`, ChatView.tsx:345) está permanentemente `disabled` con un `title="Próximamente"` — un tooltip que en táctil no existe: va a tocarlo y no va a pasar absolutamente nada.

**Creadora recién onboardeada, con cero documentos ingeridos**: la brecha más filosa. `WelcomeMessage` le afirma que el asistente "busca en sus documentos ingestados" cuando no hay ninguno. `SourcesModal` diría "No hay PDFs ingestados por ahora", pero solo si se le ocurre abrirlo. La superficie principal nunca le avisa que su base está vacía ni la empuja a ingerir antes de quemar su primera pregunta en una respuesta web que va a atribuir mal.

## Minor Observations

- Ocho archivos escriben `<button>` a mano pese a que `Button`/`buttonClass` existe; solo ChatView:359 lo usa. Consecuencia real: ninguno de esos botones tiene `focus-visible` explícito, así que dependen del anillo por defecto del navegador, inconsistente con la regla de foco de 2px del sistema.
- Los botones Sí/No de confirmar borrado (`ChatListItem.tsx:127,135`) solo tienen `px-2 py-0.5` y `text-[11px]`: muy por debajo de los 44px de la Regla del Pulgar. El cierre del drawer móvil (`ChatMobileDrawer.tsx:83`) es `h-9 w-9` (36px) en contexto táctil.
- El `<textarea>` del composer (ChatView.tsx:335) no tiene nombre accesible más allá del placeholder — placeholder no es label.
- Dos blobs `blur-[120px]` en ChatView.tsx:205-206 duplican la aurora global, que DESIGN.md define como capa única detrás de todo el vidrio.
- El punto indicador de streaming en la variante colapsada de `ChatListItem` no tiene `aria-live`: un lector de pantalla no se entera de que un chat de fondo empezó a responder.
- `formatRelative` en `ChatListItem.tsx` recalcula `new Date()` en cada render sin memoizar.

## Questions to Consider

1. Si un competidor no puede copiar ContentSpark "sin rehacer la base", ¿por qué la interfaz que más directamente toca esa base se ve y se comporta igual que un clon de ChatGPT, sin rastro visible del perfil ni del contenido ingerido?
2. ¿El fallback silencioso a la web abierta cuando el umbral RAG no se alcanza es una decisión de producto que alguien firmó para la experiencia visible, o una conducta de backend que el frontend necesita empezar a declarar?
3. Si DESIGN.md ya prohíbe métricas y personalización inventadas en calendar, ¿por qué chat tiene permiso para decirle a todo usuario —haya ingerido algo o no— que las respuestas vienen de "sus documentos ingestados"?
