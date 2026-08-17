---
target: frontend/features/chat
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-17T03-31-55Z
slug: frontend-features-chat
---
Method: dual-agent (A: design review sub-agent · B: detector/browser evidence sub-agent)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Buenas señales de streaming/skeleton/typing, pero el fallo de stream produce un banner genérico desconectado del mensaje fallido. |
| 2 | Match System / Real World | 4 | UI en español, timestamps relativos, iconografía sensata. |
| 3 | User Control and Freedom | 2 | Sin control para detener la generación en curso; sin editar/regenerar; borrado sin undo. |
| 4 | Consistency and Standards | 2 | `SourcesModal` ignora el patrón de diálogo que `ChatMobileDrawer` ya establece; ningún componente de chat usa `Button`/`Field`/`Alert` pese a que la regla 5c de DESIGN.md nombra chat explícitamente. |
| 5 | Error Prevention | 2 | El paso de confirmación de borrado existe, pero su hit target es sub-44px y alcanzable desde el drawer móvil. |
| 6 | Recognition Rather Than Recall | 3 | El sidebar colapsado reduce cada chat a un avatar de inicial, dependiendo de `title=` (recall) en vez de una etiqueta visible. |
| 7 | Flexibility and Efficiency | 2 | Sin búsqueda/filtro de chats, sin copiar/regenerar mensaje, adjuntar permanentemente deshabilitado, sin abortar stream. |
| 8 | Aesthetic and Minimalist Design | 3 | Composición de vidrio fuerte, pero el `liquid-gradient` se sobreusa (cada burbuja + 2 botones) y `SourcesModal` queda destonificado. |
| 9 | Error Recovery | 1 | El error de stream es un string estático sin acción de reintento, en contraste con el error de la lista de chats que sí ofrece "Reintentar". |
| 10 | Help and Documentation | 3 | Mínimo pero apropiado para una herramienta Operate; el tooltip "Próximamente" del clip es un buen detalle. |
| **Total** | | **25/40** | **Aceptable** |

#### Design Specificity Verdict

**LLM assessment (A):** Chat es un híbrido genuino. Partes son inconfundiblemente "Estudio de Cristal" (las dos manchas de aurora difuminadas detrás del scroll, las burbujas de vidrio en tres capas), y otras partes podrían insertarse en cualquier chatbot genérico sin que nadie lo note — sobre todo `SourcesModal.tsx`, que usa `text-gray-800`, `bg-slate-900/25` y chips `rose-100/rose-700` sin ningún par oscuro, como si fuera un componente de Bootstrap caído en un producto violeta-vidrio. La identidad gobierna el hilo de mensajes y el composer, y prácticamente abandona el modal de fuentes y buena parte de los estados interactivos (anillos de foco, banners de error, color del estado "en vivo").

**Deterministic scan (B):** `detect.mjs --json frontend/features/chat` → exit 2, 1 hallazgo: regla `bounce-easing` en `ChatView.tsx:81` (`animate-bounce` de Tailwind). Coincide exactamente con uno de los issues que encontró la lectura manual (el indicador de "escribiendo"). El resto de las violaciones que Assessment A encontró a mano (gradientes, `hover:scale`/`active:scale`, `red-*`/`rose-*`/`gray-*`/`slate-*` sueltos) el detector NO los marcó — mismo patrón de falso negativo ya visto en la corrida de onboarding. Se toma como cobertura parcial del detector, no como señal de que el resto esté limpio.

**Visual overlays:** no disponibles. B navegó a `/chat/1` pero el guard de auth redirigió a `/login` sin credenciales de prueba — mismo bloqueo que en onboarding. A no tuvo navegador.

#### Overall Impression

Chat tiene el mejor componente accesible de todo el frontend hasta ahora (`ChatMobileDrawer.tsx`, con focus trap real y semántica de diálogo correcta) conviviendo con la superficie más densa en violaciones nombradas de DESIGN.md: el `liquid-gradient` y el `scale` en hover/active — prohibidos por nombre — están en cada burbuja de usuario y en los dos botones más presionados del feature. La oportunidad más grande es doble: aplanar la burbuja/CTA principal (igual que se hizo en auth y onboarding) y llevar `SourcesModal` al mismo patrón de diálogo que ya existe a metros de distancia en el propio folder.

#### What's Working

- `ChatMobileDrawer.tsx` — el único diálogo bien construido del feature: `role="dialog"`, `aria-modal`, focus trap real, cierre con Escape, foco devuelto al trigger. Debería ser la plantilla, no la excepción.
- `ChatView.tsx:192-193` — las dos manchas `blur-[120px]` de `primary`/`secondary` detrás del scroll son una instancia correcta y contenida de "el fondo de aurora se filtra a través de cada panel", no una decoración pegada encima.
- `ChatSidebarContent.tsx:75-85` — el estado de error de la lista de chats sí ofrece "Reintentar" en línea; es el patrón que el banner de error del hilo principal debería haber copiado y no copió.

#### Priority Issues

- **[P0] `liquid-gradient` + `hover:scale`/`active:scale` + `animate-bounce` repetidos en la superficie de mayor tráfico**
  Qué: `ChatView.tsx:235` (cada burbuja de usuario), `:337` (botón enviar, `hover:scale-110 active:scale-95`), `:301` (prompts sugeridos, `hover:scale-105`), `ChatSidebarContent.tsx:55` (botón nuevo chat, `hover:scale-105 active:scale-95`), `ChatView.tsx:81-83` (`animate-bounce` en el indicador de escritura, confirmado por el detector).
  Por qué importa: DESIGN.md prohíbe los tres por nombre. Como CADA burbuja de usuario es gradiente violeta completo, no es un desliz aislado — es una violación sistémica del 10% concentrada en la superficie que el usuario mira más tiempo.
  Fix: aplanar burbujas a `bg-primary`, quitar todos los `scale-*` (transición solo de color, 150ms), reemplazar el bounce por un pulso de translate/opacidad.
  Comando sugerido: `$impeccable polish`

- **[P0] `SourcesModal.tsx` no es un diálogo real y está completamente destonificado**
  Qué: sin `role="dialog"`/`aria-modal`/focus trap/Escape (a diferencia de `ChatMobileDrawer.tsx` en la misma carpeta); `bg-slate-900/25`, `text-gray-800/600/700`, `border-rose-200/70 bg-rose-50/70 text-rose-700`, `bg-rose-100/80 text-rose-700` — nada mapea a tokens, nada tiene par oscuro.
  Por qué importa: es el único lugar donde un usuario de teclado/lector de pantalla puede quedar atrapado detrás de un overlay sin trap, y es la defección más visible del sistema de tokens en todo el feature.
  Fix: reconstruir sobre el patrón de `ChatMobileDrawer` (role, aria-modal, focus trap, Escape) y retokenizar cada gris/rosa a `on-surface`/`on-surface-variant`/`danger`/`danger-container`.
  Comando sugerido: `$impeccable harden`

- **[P1] El textarea del composer elimina su propio anillo de foco sin reemplazo**
  Qué: `ChatView.tsx:321` — `focus:ring-0 focus:outline-none` en el input principal, sin cambio de borde compensatorio en foco.
  Por qué importa: es el control más usado del feature y ahora es invisible al foco de teclado, violando directamente la regla de DESIGN.md de anillo de 2px en `primary`.
  Fix: `focus-visible:ring-2 focus-visible:ring-primary/20`, o migrar al primitivo `Field`/`inputClass` por la regla 5c.
  Comando sugerido: `$impeccable audit`

- **[P1] Sin forma de detener o recuperarse de un stream que falla**
  Qué: durante `isStreaming` el botón de enviar solo muestra un spinner sin acción de cancelar; al fallar, `error` es un string estático sin botón de reintento (`ChatView.tsx:279-283`), a diferencia del propio patrón "Reintentar" que ya existe en la lista de chats.
  Por qué importa: es exactamente el momento de mayor tensión del producto (una respuesta de IA fallando a mitad de generación) y hoy ofrece la menor contención de todo el feature.
  Fix: botón de detener generación durante el streaming; acción "Reintentar" en el banner de error que reenvíe el último turno.
  Comando sugerido: `$impeccable harden`

- **[P2] Literales de color rojo/verde en vez de tokens (~6 apariciones)**
  Qué: `ChatListItem.tsx:83,109` (`bg-green-400`), `:124` (`bg-red-500/20 text-red-500 hover:bg-red-500/30`), `:147` (`hover:text-red-500`), `ChatView.tsx:280` (`border-red-300/30 bg-red-500/10 text-red-300`).
  Por qué importa: es exactamente la deuda que el propio ledger de DESIGN.md ya rastreaba (chat: 48 utilidades pendientes) y confirma que `ChatListItem.tsx` nunca migró al par `success`/`danger` pese a estar nombrado en el punto 10 del log. Nota: `success` explícitamente NO es el token correcto para el punto "en vivo" del streaming (DESIGN.md: "no se usa para estado positivo permanente... eso es dato, no confirmación") — necesita una decisión de diseño propia, no un swap mecánico.
  Fix: `danger`/`danger-container` para los controles de borrado; un tratamiento de indicador de actividad dedicado (no `success`) para el punto de streaming en vivo.
  Comando sugerido: `$impeccable colorize`

#### Persona Red Flags

**Alex (power-user)**: sin búsqueda/filtro en la lista plana de chats; sin control de detener generación; sin copiar/regenerar en las burbujas del asistente; adjuntar queda permanentemente deshabilitado sin roadmap más allá de un tooltip.

**Sam (accesibilidad)**: `ChatView.tsx:321` mata el anillo de foco del textarea; `SourcesModal.tsx` no tiene semántica de diálogo ni focus trap; el badge de streaming en el sidebar colapsado no tiene `aria-label` mientras que la variante expandida sí — soporte de lector de pantalla inconsistente para el mismo estado.

**Casey (mobile)**: los botones "Sí"/"No" de confirmación de borrado en `ChatListItem.tsx`, alcanzables desde el drawer móvil, miden ~20px de alto — muy por debajo de la regla de 44px del propio sistema; el botón de adjuntar mide 40px (`h-10 w-10`), también bajo el mínimo móvil, aunque hoy está deshabilitado.

#### Minor Observations

- Los radios (`rounded-3xl/2xl/xl`) numéricamente caen en la escala sancionada (24/16/12px) pero referencian clases crudas de Tailwind en vez de los tokens nombrados — riesgo de deriva si la escala cambia.
- `ChatSidebarContent.tsx:55` usa `shadow-[#6e2ce0]/20`, un hex suelto idéntico al valor del token `primary` — debería referenciar el token, no repetir el hex.
- El texto multilínea (Shift+Enter) se pierde visualmente al no tener `whitespace-pre-wrap` en la burbuja renderizada (`ChatView.tsx:236`).
- La mayoría de los botones-ícono del feature están escritos a mano en vez de sobre `buttonClass`/`Button` — mismo hallazgo de falta de adopción de primitivos, mejor resolverlo en una sola pasada.

#### Questions to Consider

- Si `liquid-gradient` está prohibido como relleno decorativo en todo el sistema, ¿por qué chat tiene tres excepciones (burbujas, botón enviar, botón nuevo chat) — es una decisión intencional de "chat tiene presupuesto propio de acento" o deriva que nadie atrapó porque chat se envió antes de que existiera la regla del 10%?
- `ChatMobileDrawer.tsx` ya prueba que el equipo sabe construir un modal accesible correctamente — ¿por qué `SourcesModal.tsx`, en la misma carpeta, no reutiliza ese patrón en vez de reinventar uno sin trap ni tokens?
- ¿"Detener generación" está genuinamente fuera de alcance para esta fase, o es un descuido — porque hoy una respuesta mala o lenta del LLM no tiene salida para el usuario más que esperar?
