---
name: ContentSpark
description: Un estudio de cristal para creadores — vidrio translúcido, violeta escaso, instrumentos precisos.
colors:
  primary: "#6e2ce0"
  primary-hover: "#5f22c9"
  on-primary: "#ffffff"
  primary-container: "#b08cff"
  secondary: "#b4005d"
  surface: "#f5f6fb"
  surface-container: "#e6e8ee"
  surface-container-lowest: "#ffffff"
  on-surface: "#2c2f33"
  on-surface-variant: "#595c60"
  glass-edge: "rgba(41, 28, 66, 0.18)"
  glass-edge-soft: "rgba(41, 28, 66, 0.10)"
  danger: "#b3261e"
  danger-container: "#fceceb"
  success: "#1b6b45"
  success-container: "#e4f4ea"
  primary-dark: "#a97dff"
  primary-hover-dark: "#bd97ff"
  on-primary-dark: "#1a1024"
  primary-container-dark: "#d6c2ff"
  secondary-dark: "#ff7fb0"
  surface-dark: "#1a1625"
  surface-container-dark: "#241f33"
  surface-container-lowest-dark: "#0e0c16"
  on-surface-dark: "#f1eef8"
  on-surface-variant-dark: "#b3aec4"
  glass-edge-dark: "rgba(255, 255, 255, 0.12)"
  glass-edge-soft-dark: "rgba(255, 255, 255, 0.06)"
  danger-dark: "#f2b8b5"
  danger-container-dark: "#3b1512"
  success-dark: "#7fd7a6"
  success-container-dark: "#0f2a1d"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 300
    lineHeight: 1.6
    letterSpacing: "normal"
  body-strong:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.1em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  full: "9999px"
spacing:
  "2xs": "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.body-strong}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "#5f22c9"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "{colors.glass-edge-soft}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.full}"
    padding: "12px 24px"
  button-ghost-hover:
    backgroundColor: "{colors.glass-edge}"
    textColor: "{colors.on-surface}"
  input-field:
    backgroundColor: "{colors.glass-edge-soft}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  card-glass:
    backgroundColor: "{colors.glass-edge-soft}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.glass-edge-soft}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
---

# Design System: ContentSpark

## Overview

**Creative North Star: "El Estudio de Cristal"**

ContentSpark es un taller profesional construido en vidrio. Cada superficie es translúcida y deja ver la estructura que tiene debajo: el fondo con aurora de color no es un adorno detrás de la interfaz, es el piso del estudio que se filtra a través de cada panel. El glassmorphism acá no decora — es el material del que está hecho el espacio de trabajo, y por eso obedece reglas físicas: el vidrio más cercano al usuario difumina más, el vidrio del fondo difumina menos, y ninguna superficie es opaca sin una razón funcional.

La densidad es de herramienta, no de landing. El creador viene a trabajar: a consultar su base de conocimiento, a leer respuestas largas, a mover entradas de calendario. Eso significa texto en cuerpo liviano (300) para lectura sostenida, etiquetas en versalitas espaciadas para orientarse sin ruido, y controles que responden rápido y sin teatro. La expresividad del producto vive en el material y en la luz de fondo, no en los botones.

El color se comporta como electricidad, no como pintura. El violeta primario es escaso y deliberado: marca lo que se puede accionar y lo que está activo, y nada más. Un panel entero teñido de violeta destruye la lectura del vidrio y aplana la jerarquía. La superficie de trabajo es neutra; el color llega desde el fondo, difuso, y desde el acento, puntual.

**Key Characteristics:**
- Vidrio como material estructural, con tres niveles de difuminado que codifican distancia
- Violeta eléctrico escaso: interacción y estado activo, nunca relleno decorativo
- Cuerpo de texto liviano (300) para lectura larga; etiquetas en versalitas espaciadas
- Controles precisos: transiciones cortas, sin escalado, foco nítido y visible
- Cuatro radios y nada más; la deriva de esquinas es un defecto, no una variación
- Modo claro y oscuro son pares de primera clase, ambos con paleta completa

## Colors

Una superficie neutra fría atravesada por una aurora de fondo, con un solo acento eléctrico que se reserva para la acción.

### Primary
- **Violeta Eléctrico** (`{colors.primary}`): el único acento del sistema. Vive en botones de acción primaria, estado activo de navegación, anillo de foco, enlaces y el borde de un input enfocado. En oscuro se aclara a `{colors.primary-dark}` porque el valor claro no alcanza contraste legible sobre las superficies oscuras.
- **Violeta Difuso** (`{colors.primary-container}`): la cola clara del acento. Se usa como extremo de gradiente en el logotipo y en marcas de progreso — nunca como fondo de un contenedor de contenido.

### Secondary
- **Magenta Señal** (`{colors.secondary}`): acento de contrapunto, casi ausente en app UI. Reservado para diferenciar una segunda categoría de dato cuando el violeta ya está ocupado (por ejemplo, dos series en el panel de rendimiento del calendario).

### Neutral
- **Bruma Fría** (`{colors.surface}`): el lienzo detrás del vidrio en modo claro; es lo que la aurora tiñe.
- **Bruma Densa** (`{colors.surface-container}`): superficies neutras que no son de vidrio — separadores de sección, celdas inactivas de la grilla del calendario.
- **Cristal Base** (`{colors.surface-container-lowest}`): la base de toda superficie de vidrio. Nunca se usa a opacidad plena en un panel flotante; siempre entre 20% y 45%.
- **Grafito** (`{colors.on-surface}`): texto principal y iconografía activa.
- **Grafito Suave** (`{colors.on-surface-variant}`): texto secundario, etiquetas, placeholders, iconos inactivos.
- **Filo de Vidrio** (`{colors.glass-edge}` / `{colors.glass-edge-soft}`): los bordes que definen dónde termina una lámina de vidrio. El filo fuerte va en superficies flotantes; el suave, en superficies de fondo. **El filo cambia de signo con el tema**: en claro es un tinte oscuro violáceo, en oscuro es blanco translúcido. Un filo blanco sobre fondo claro se midió en 1.03:1 contra la tarjeta — es decir, no existe.
- **Sobre Primario** (`{colors.on-primary}`): el texto y los iconos que van encima del Violeta Eléctrico. No es "blanco": en oscuro el primario se aclara a `{colors.primary-dark}` y el blanco cae a 2.97:1, así que el par oscuro invierte a `{colors.on-primary-dark}` y sube a 6.18:1.
- **Alerta** (`{colors.danger}` sobre `{colors.danger-container}`): errores de formulario y confirmaciones destructivas. Es el único rojo del sistema.
- **Confirmación** (`{colors.success}` sobre `{colors.success-container}`): acciones completadas que el usuario no puede ver por sí mismo — "te enviamos un correo", "se guardó". Es el único verde del sistema, y su par es simétrico al de Alerta (5.70:1 en claro, 8.89:1 en oscuro). No se usa para estado positivo permanente ni para métricas; eso es dato, no confirmación.

### Named Rules

**La Regla del Diez Por Ciento.** El Violeta Eléctrico no cubre más del 10% del área de ninguna pantalla. Su rareza es lo que lo hace legible como señal. Un fondo de sección teñido de violeta, una tarjeta con gradiente violeta o una sombra violeta bajo un elemento no interactivo violan esta regla.

**La Regla del Filo, No del Relleno.** El vidrio se define por su borde y su difuminado, no por su opacidad. Si una superficie necesita subir de opacidad para leerse, el problema es el contraste del texto, no el vidrio.

**La Regla del Par Completo.** Todo token de color existe en claro y en oscuro. Un color que solo funciona en un modo no es un token del sistema: es un hardcodeo, y se trata como defecto.

**La Regla del Par Invertible.** Un par claro/oscuro no siempre es el mismo color más claro o más oscuro: a veces se invierte. El texto sobre el primario es blanco en claro y casi negro en oscuro; el filo del vidrio es oscuro en claro y blanco en oscuro. Antes de dar un par por bueno, medí el contraste en los dos modos.

## Typography

**Familia única:** Inter (con fallback `ui-sans-serif, system-ui, sans-serif`)

**Carácter:** Una sola voz, diferenciada por peso y espaciado en vez de por familia. El contraste entre el cuerpo liviano (300) y las etiquetas en versalitas espaciadas es la firma tipográfica del sistema: hace que los bloques de lectura respiren y que la estructura de la interfaz se lea de un vistazo.

### Hierarchy
- **Display** (600, `clamp(2.25rem, 6vw, 3.75rem)`, 1.05, `-0.02em`): solo el titular principal de landing. No aparece dentro de la aplicación.
- **Headline** (600, `clamp(1.5rem, 3vw, 2.25rem)`, 1.15, `-0.015em`): encabezado de sección en landing y título de paso en el onboarding.
- **Title** (600, `1.25rem`, 1.3, `-0.01em`): título de vista, encabezado de tarjeta, título de modal.
- **Body** (300, `0.875rem`, 1.6): el texto por defecto de todo el producto — mensajes de chat, descripciones, texto de ayuda. Máximo 70ch por línea en bloques de lectura.
- **Body Strong** (500, `0.875rem`, 1.6): etiqueta de botón, valor de dato, énfasis dentro de un párrafo.
- **Label** (500, `0.75rem`, `0.1em`, versalitas): etiquetas de campo, encabezados de columna, metadatos. Siempre en `on-surface-variant`.

### Named Rules

**La Regla de la Voz Liviana.** El texto de lectura es peso 300. Un párrafo en 400 se lee más pesado sin ganar legibilidad, y rompe el contraste con Body Strong que hace legible la jerarquía.

**La Regla de las Versalitas Cortas.** Las versalitas con `0.1em` de espaciado sirven para etiquetas de una a tres palabras. Una frase completa en versalitas es ilegible y está prohibida.

## Layout

El producto usa dos modelos espaciales. En la aplicación, un armazón persistente: barra lateral de navegación a la izquierda (colapsable, con cajón deslizante en móvil por debajo de `md`) y una única columna de trabajo a la derecha que ocupa el resto del ancho. En landing y en auth, contenido centrado con ancho máximo — la tarjeta de auth se limita a 458px, las secciones de landing a un contenedor de página.

El ritmo de espaciado es una escala de siete pasos (`4 / 8 / 12 / 16 / 24 / 32 / 48px`). El relleno interno de una tarjeta de vidrio es `lg` (24px) en escritorio y `md` (16px) por debajo de `sm`. La separación entre campos de formulario es `md`; entre grupos de sección, `xl`.

Puntos de quiebre estándar de Tailwind: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. El cambio estructural real ocurre en `md`, donde la barra lateral pasa de cajón a persistente. Por debajo de `sm` bajan un escalón el relleno de tarjetas y los tamaños de titular, nunca el cuerpo de texto.

**La Regla del Pulgar.** En móvil, todo control accionable tiene al menos 44px de altura táctil, aunque su caja visual sea menor.

## Elevation & Depth

Este sistema comunica profundidad con **difuminado, no con sombra**. Tres niveles de vidrio codifican la distancia al usuario, y son los únicos permitidos:

- **Vidrio de fondo** (`backdrop-blur-md`, 12px): superficies que pertenecen al plano del fondo — barras laterales, cabeceras, paneles anclados a un borde.
- **Vidrio de trabajo** (`backdrop-blur-xl`, 24px): la superficie principal donde ocurre la tarea — tarjetas de contenido, tarjeta de auth, paneles del calendario.
- **Vidrio flotante** (`backdrop-blur-2xl`, 40px): lo que se despega del plano — modales, menús desplegables, popovers.

Las sombras son la excepción, no la escala. Existen exactamente dos, y solo aparecen en vidrio flotante, donde el difuminado por sí solo no separa el elemento de lo que tiene debajo.

### Shadow Vocabulary
- **Levante ambiente** (`box-shadow: 0 32px 64px -16px rgba(110, 44, 224, 0.10)`): tarjeta de auth y modales. Es una sombra teñida de violeta muy diluida — la única aparición del acento que no marca interacción, tolerada porque simula la luz de la aurora atravesando el vidrio.
- **Levante de menú** (`box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.18)`): menús desplegables y popovers, donde hace falta un corte neutro y definido.

En modo oscuro las sombras pierden casi todo su efecto sobre fondos oscuros: ahí la separación la da el filo de vidrio (`glass-edge-dark`), que sube de opacidad en el vidrio flotante.

### Named Rules

**La Regla de los Tres Vidrios.** Solo existen tres niveles de difuminado. Un cuarto valor de `backdrop-blur` es deriva y se corrige, no se documenta.

**La Regla de la Sombra Muda.** Una superficie en reposo no proyecta sombra. Si un elemento necesita sombra para verse, primero revisá si le corresponde otro nivel de vidrio.

## Shapes

Cuatro radios y nada más: `sm` 12px para controles internos y píldoras pequeñas, `md` 16px para inputs, campos y tarjetas de contenido chicas, `lg` 24px para paneles, modales y tarjetas grandes, y `full` para botones de acción, avatares, chips y conmutadores.

Los bordes son de un solo píxel y siempre translúcidos: en claro, blanco a 40% en vidrio flotante y a 20% en vidrio de fondo; en oscuro, blanco a 12% y 6% respectivamente. Un borde opaco rompe la lectura del material.

El fondo aporta la única geometría orgánica del sistema: manchas circulares difuminadas (`blur-3xl`) que derivan lentamente. Esa forma pertenece exclusivamente al fondo — ningún componente de la interfaz usa formas orgánicas ni gradientes de mancha.

**La Regla del Cuarto Radio.** Cualquier radio arbitrario (`rounded-[2rem]`, `rounded-[3rem]`) es deriva. Se resuelve mapeándolo al escalón más cercano, no agregando un escalón.

## Components

### Buttons
- **Carácter:** instrumento de precisión. Responden rápido y sin desplazarse.
- **Forma:** `full` en acciones primarias y secundarias; `sm` en botones de icono dentro de una tarjeta.
- **Primary:** fondo Violeta Eléctrico plano (no gradiente), texto en `{colors.on-primary}` — nunca blanco literal —, relleno `12px 24px`, tipografía Body Strong. El gradiente está prohibido por dos razones que coinciden: rompe la Regla del Diez Por Ciento y hace que el contraste varíe a lo largo del botón (medido: de 6.77:1 en un extremo a 2.61:1 en el otro).
- **Ghost:** fondo de vidrio suave, borde de filo, texto `on-surface`. Es el secundario por defecto, incluido el botón de Google en auth.
- **Estados:** `hover` oscurece el fondo un paso y nada más. `active` no escala. `focus-visible` dibuja un anillo de 2px en `primary` con 2px de separación. `disabled` baja a 45% de opacidad y desactiva el cursor.
- **Transición:** `150ms` en `color` y `background-color`. Nunca en `transform`.

### Inputs / Fields
- **Estilo:** vidrio suave con filo de 1px, radio `md`, relleno `12px 16px`, texto Body, placeholder en `on-surface-variant` al 60%.
- **Icono guía:** opcional a la izquierda, 18px, en `on-surface-variant`, con el relleno izquierdo ampliado a 44px.
- **Foco:** el borde pasa a `primary` y aparece un anillo de `primary` al 20%. Sin desplazamiento ni cambio de tamaño.
- **Error:** borde y texto de ayuda en `danger`; el mensaje se muestra debajo del campo, no como banner suelto, salvo que el error sea del formulario completo.
- **Etiqueta:** siempre visible arriba del campo, en estilo Label. Sin etiquetas flotantes.

### Cards / Containers
- **Forma:** radio `lg`, relleno `lg` (24px), `md` por debajo de `sm`.
- **Material:** vidrio de trabajo (`backdrop-blur-xl`) sobre Cristal Base entre 30% y 45%, con filo de vidrio.
- **Sombra:** ninguna en reposo. Solo la tarjeta de auth y los modales llevan Levante ambiente.

### Chips
- **Estilo:** radio `full`, vidrio suave con filo, tipografía Label, relleno `6px 14px`.
- **Seleccionado:** fondo Violeta Eléctrico plano con texto blanco. La selección se comunica solo por color de fondo, sin marca de verificación ni cambio de tamaño.

### Navigation
- **Barra lateral:** vidrio de fondo (`backdrop-blur-md`), filo solo en el borde derecho. Ítems con tipografía Body Strong e icono de 20px.
- **Estado activo:** fondo de vidrio suave más un filete de 3px en `primary` sobre el borde interno. El texto pasa a `on-surface`; el inactivo vive en `on-surface-variant`.
- **Móvil:** cajón deslizante desde la izquierda por debajo de `md`, con velo de fondo al 40% y difuminado suave.

### Fondo de aurora (componente firma)
Una capa fija y no interactiva (`aria-hidden`) compuesta por un gradiente diagonal de base y cinco manchas circulares difuminadas que derivan en ciclos de 16 a 25 segundos. Es la fuente de luz del estudio y aparece detrás de toda superficie de vidrio. Tiene un par oscuro completo, y toda la animación se anula bajo `prefers-reduced-motion: reduce`.

**Excepción declarada a la Regla del Par Completo.** Los colores de las manchas viven como hexadecimales literales con su contraparte `dark:` escrita a mano, no como tokens. Es deliberado: son una composición decorativa única, no decisiones reutilizables, y convertir doce valores de mancha en doce tokens globales ensuciaría la paleta sin que nadie los reutilice jamás. La regla que sí los alcanza es la del par: cada mancha tiene su valor oscuro. Si alguna vez una mancha pierde su par, eso sí es defecto.

## Do's and Don'ts

### Do:
- **Do** definir todo color mediante un token de `@theme` con su par oscuro. Si el color no existe en ambos modos, todavía no es un token.
- **Do** usar exactamente tres niveles de difuminado (`md` / `xl` / `2xl`) según la distancia del elemento al usuario.
- **Do** limitar los radios a `sm` 12px, `md` 16px, `lg` 24px y `full`.
- **Do** escribir el cuerpo de texto en peso 300 y las etiquetas en versalitas con `0.1em`.
- **Do** dar a todo control un `focus-visible` con anillo de 2px en `primary`.
- **Do** derivar el color desde el fondo de aurora: la interfaz se mantiene neutra y deja que la luz venga de atrás.

### Don't:
- **Don't** usar el Violeta Eléctrico como relleno decorativo: nada de fondos de sección, tarjetas ni sombras teñidas bajo elementos no interactivos. Techo del 10% del área de pantalla.
- **Don't** usar texto con gradiente. Es la marca de agua de la interfaz genérica y ya aparece en `HeroSection.tsx` y `AppSidebar.tsx`; ambos casos son deuda a corregir.
- **Don't** escalar en hover (`hover:scale-[1.02]`) ni comprimir en `active` (`active:scale-95`). El carácter es preciso y contenido; el escalado lo vuelve blando.
- **Don't** usar `animate-bounce` ni curvas elásticas. Las transiciones son cortas y desaceleran suavemente.
- **Don't** hardcodear colores de Tailwind (`bg-white/20`, `text-slate-500`, `bg-red-50`) ni hexadecimales sueltos (`text-[#75777b]`) en un componente. Cada uno de esos es un punto donde el modo oscuro se rompe.
- **Don't** agregar un cuarto nivel de `backdrop-blur` ni un radio arbitrario. La deriva se mapea al escalón existente.
- **Don't** poner sombra en una superficie en reposo.

<!--
DEUDA CONOCIDA (backlog contra el que se mide cada vista).

RESUELTO — base de tema, 2026-08-08:
1. [x] app/layout.tsx ahora aplica inter.variable sobre <html> con suppressHydrationWarning.
2. [x] globals.css declara @custom-variant dark por clase. Los tokens de color salieron del bloque
       `@theme inline` (que horneaba el valor literal y volvía inerte todo override en runtime) y
       pasaron a un `@theme` normal que emite var(). El @media prefers-color-scheme muerto se eliminó.
3. [x] Paleta oscura completa, incluidos primary, primary-container, secondary, glass-edge y danger.
       Conmutador de tres estados (claro / sistema / oscuro) con persistencia y script anti-parpadeo.

RESUELTO — pasada de login, 2026-08-09 (critique 22/40 -> ver siguiente corrida):
7. [x] LoginView.tsx: 0 utilidades de paleta, 0 hex sueltos, 0 transformaciones scale,
       0 gradientes, todas las duraciones en 150ms, una sola sombra (la sancionada).
       a11y: id/htmlFor, autoComplete, autoFocus, role="alert", aria-label en el toggle,
       area de toque de 44px, error de credenciales atribuido al campo y traducido.
       Contraste medido sobre el render: todo AA en ambos temas.
8. [x] Tokens nuevos: on-primary, primary-hover (con sus pares oscuros). glass-edge
       invertido en claro a tinte oscuro.
9. [x] SignupView.tsx: mismo estado que login (0 hardcodeos, 0 scale, 0 gradientes,
       150ms, una sombra). Suma: autoComplete name/email/new-password, minLength 6
       declarado ANTES de enviar, errores de "ya existe la cuenta" atribuidos al campo
       de correo, estado de exito con role="status", <Link> en vez de <a>.
10. [x] Tokens de exito (success / success-container + pares oscuros). Antes habia
       5 archivos usando emerald/green a mano y ningun token: SignupView,
       ForgotPasswordView, PerformancePanel, HeroSection, ChatListItem.

11. [x] AUTH CERRADO: las cuatro vistas (login, signup, forgot-password, reset-password)
       en 0 utilidades de paleta, 0 hex sueltos, 0 scale, 0 gradientes, 150ms, una sombra.
       Las cuatro con htmlFor, autoComplete, role alert/status y toggle de 44px con
       aria-label. AuthBackground queda como excepcion declarada (ver Componentes).

RESUELTO — pasada de onboarding, 2026-08-17 (critique 23/40, dos P0 y un P1 cerrados):
12. [x] ONBOARDING migrado a los primitivos: OnboardingWizard.tsx, Step1Niche.tsx,
   Step2Goals.tsx, Step3Frequency.tsx y Step4Formats.tsx consumen Button, Field y
   Alert en vez de clases a mano. CTA de cierre paso de gradiente + hover:scale
   (doble violacion) a Button plano con icono CheckCircle + copy "Finalizar
   registro" — la diferenciacion del cierre viene de forma/copy, no de color o
   movimiento. border-white/20, red-50/red-600/red-700 y text-[#75777b]/50
   reemplazados por glass-edge/danger/on-surface-variant.
13. [x] Step4Formats bajaba dos decisiones de +4 opciones (formatos + redes
   sociales) a la vez, violando el checklist de carga cognitiva. El selector de
   plataforma/usuario ahora vive detras de un toggle "+ Agregar red social"
   (revelado progresivo), en vez de estar siempre abierto.

RESUELTO — pasada de chat (P0), 2026-08-17 (critique 25/40, dos P0 cerrados, P1/P2 pendientes):
14. [x] CHAT P0: liquid-gradient + hover:scale/active:scale en burbuja de usuario,
   boton enviar, boton nuevo chat y prompts sugeridos (ChatView.tsx,
   ChatSidebarContent.tsx) reemplazados por bg-primary plano via Button/buttonClass.
   animate-bounce del indicador de "escribiendo" (unico hallazgo real que SI marco
   detect.mjs, regla bounce-easing) paso a animate-pulse.
   SourcesModal.tsx no era un dialogo real (sin role/aria-modal/focus trap/Escape)
   y estaba destonificado (gray/slate/rose sin par oscuro) — reconstruido sobre el
   mismo patron de ChatMobileDrawer.tsx, con Alert para el estado de error.
   Indicador "en vivo" de streaming (ChatListItem.tsx): bg-green-400 (token de
   success reutilizado incorrectamente para estado permanente, no confirmacion)
   reemplazado por bg-primary + animate-pulse, con aria-label agregado a la
   variante colapsada que no lo tenia.
   PENDIENTE en chat (P1/P2, no tocado en esta pasada): anillo de foco del
   composer (focus:ring-0 sin reemplazo), sin detener/reintentar stream fallido,
   red-*/green-* sueltos en ChatListItem (controles de borrado), adopcion de
   Field/Button en el resto del feature.
15. [x] CHAT P1, 2026-08-17: composer con focus-visible:ring-2 en primary (antes
   focus:ring-0 focus:outline-none sin reemplazo). cancelStream ya existia
   completo en chatSessionsStore.ts (abort limpio, sin error visible en abort
   intencional) pero nunca estaba cableado a un boton — el boton de enviar
   ahora se convierte en boton de detener (icono Square) mientras isStreaming.
   El banner de error del hilo principal paso de red-300/red-500 sueltos al
   componente Alert, con boton "Reintentar" que reenvia el ultimo mensaje del
   usuario (antes solo la lista de chats tenia este patron).
   PENDIENTE en chat: red-*/green-* en ChatListItem (controles de borrado, P2),
   adopcion de Field/Button en el resto del feature.
16. [x] CHAT P2, 2026-08-17: ChatListItem.tsx, ultimos dos literales rojos
   (boton "Si" de confirmar borrado y hover del icono Trash2) migrados a
   danger/danger-container. CHAT QUEDA CERRADO (P0+P1+P2): cero red-*/green-*/
   gray-*/slate-*/hex sueltos en todo el feature (verificado con grep).
   PENDIENTE (fuera de esta serie, no bloqueante): adopcion de Field/Button en
   ChatHeader y otros botones-icono del feature; hit target de 20px en los
   botones Si/No de confirmar borrado (persona Casey, nunca se numero como
   issue formal, solo como red flag).

RESUELTO — pasada de calendar (P0+P1), 2026-08-17 (critique 19/40 "Pobre" — vista pegada
de un HTML de referencia, nunca paso por el sistema de diseño):
17. [x] CALENDAR P0 bug funcional: el toggle Mes/Semana de TopBar.tsx tenia un
   useState local desconectado del viewMode real que ya vivia (correcto) en
   calendarStore.ts y que CalendarGrid.tsx ya consumia bien — el click no
   cambiaba nada en el grid. Ahora TopBar lee/escribe el store, viewMode es una
   sola fuente de verdad. CALENDAR P0 a11y: EntryEditModal.tsx tenia
   role="dialog"/aria-modal pero sin focus trap, sin Escape, sin devolver foco
   al trigger — mismo defecto que tenia SourcesModal.tsx. Se porto el mismo
   patron (captura document.activeElement al abrir, focus trap Tab/Shift+Tab,
   Escape cierra, foco vuelve al trigger al cerrar), mas aria-label porque no
   tenia aria-labelledby.
   CALENDAR P1: PerformancePanel.tsx, ActivityPanel.tsx y CreatorTip.tsx
   mostraban datos 100% inventados como si fueran reales (grafico de barras
   hardcodeado, actividad ficticia, "tu audiencia esta mas activa a las 7PM...
   20% mas alcance") — confirmado por el usuario que hoy no existe backend
   para ninguno de los tres. PRODUCT.md prohibe explicitamente inventar
   metricas o prueba social. Reemplazados por estado vacio honesto ("Aun no
   hay datos de rendimiento" / "Aun no hay actividad reciente"); CreatorTip
   paso a un consejo editorial generico sin afirmar personalizacion ni medicion
   ("la consistencia gana mas que la perfeccion..."), no un "no hay datos"
   generico, porque ahi si hay contenido honesto que mostrar.
   CALENDAR P1: borrado de calendario disparaba remove(id) directo en el
   click, sin confirmacion — ahora usa el mismo patron Si/No de dos pasos que
   ChatListItem.tsx, con tokens danger/danger-container en vez de red-* suelto.
18. [x] CALENDAR P2+P3, 2026-08-17: las 12 vistas migradas a tokens/primitivos
   en dos agentes paralelos por archivo (sin solapamiento). Todos los radios
   rounded-[2rem]/rounded-[3rem] arbitrarios pasaron a rounded-3xl; todo
   border-white/*, bg-white/* paso a glass-edge/glass-edge-soft; hover:scale/
   active:scale/group-hover:scale eliminados de todos los controles (incluido
   GoogleSyncButton, CalendarGrid, TimelineCards, EntryEditModal, GenerateControl,
   ConfirmBar, CalendarEmptyState). "Visual Timeline" traducido a "Linea de
   tiempo". Chips de CalendarGrid pasaron de text-[8px] a text-xs (12px, piso
   legible del sistema tipografico).
   DECISION DE DISENO: PLATFORM_CHIP_STYLES/PLATFORM_STYLES (paleta de 5
   colores por red social, red-500/pink-500/blue-400/sky-500 hardcodeados,
   duplicada con valores levemente distintos en CalendarGrid.tsx y
   TimelineCards.tsx) NO se retokenizo 1:1 — el sistema de diseno solo define
   primary + secondary (maximo dos series de datos, ver "Magenta Senal") y
   cinco plataformas no entran ahi sin inventar tokens nuevos por red social,
   que es exactamente lo que la Regla del Diez Por Ciento prohibe. Se extrajo
   `platformStyles.ts` (nuevo, compartido entre ambos archivos): la identidad
   de plataforma ahora se comunica solo por texto (la etiqueta), con el acento
   primary reservado para marcar lo accionable (el chip abre el editor), no la
   identidad de la red social. Resuelve la deriva de duplicacion citada en el
   critique por construccion, no por parche.
   EntryEditModal.tsx y GenerateControl.tsx migrados a Field/Button/Alert
   (Titulo/Hook/Frecuencia via Field con iconos lucide-react; selects via
   inputClass/FIELD_LABEL_CLASS igual que Step4Formats.tsx; errores via Alert).
   TopBar.tsx: avatar dejo de ser un gradiente decorativo con "M" hardcodeada
   — ahora usa el hook useCurrentUser ya existente en el codebase (mismo que
   AppSidebar/MobileNav), con imagen real o inicial derivada del nombre real.
   GoogleSyncButton.tsx: los 4 hex de marca de Google (#4285F4 etc.) se
   dejaron como estan — exencion de marca, se usan solo en el trazo del
   isotipo, nunca como relleno decorativo de contenedor.
   CREATORTIP: rounded-[2rem]/border-white/20 sueltos (fuera de ambos
   reportes de los agentes) corregidos aparte, mismo patron.
   Verificacion: tsc limpio, 213/213 tests, lint sin warnings, detect.mjs []
   (grep de sanidad manual confirmo cero red-*/pink-*/blue-*/sky-*/emerald-*/
   scale/rounded-[]/border-white/bg-white en las 12 vistas no-test).
   CALENDAR QUEDA CERRADO (P0+P1+P2+P3) salvo lo explicitamente diferido:
   generacion fallida sin boton de reintento (mencionado como persona red flag
   de Riley, nunca numerado P0-P3), y el fieldset "Cantidad por formato" de
   GenerateControl.tsx que sigue mostrando 5 inputs simultaneos sin revelado
   progresivo (mismo patron ya resuelto en Step4Formats.tsx de onboarding,
   pero explicitamente fuera de alcance de esta pasada por decision del
   usuario de ir solo P2+P3 tokens/primitivos, no reestructurar IA).
19. [x] PROFILE CERRADO (P0+P1), 2026-08-18, metodo dual-agent (critique
   19/40, "Poor" — banda mas baja del feature, confirmado por evidencia:
   0 de 11 controles usaban Field/Button/Alert antes de esta pasada).
   HALLAZGO: el detector mecanico detect.mjs devolvio [] en profile pese a
   15+ matches reales de border-white/bg-white/red-*/hex suelto/hover:scale
   confirmados por grep manual — discrepancia sin explicar (posible gap de
   reglas o path-matching del detector), no se investigo por estar fuera de
   alcance del critique. El grep manual, no el detector, fue la fuente
   confiable para esta superficie.
   P0: ProfileForm.tsx no tenia forma de editar/desconectar cuentas
   sociales tras el onboarding pese a que el backend ya lo soportaba
   (profile_service.py:_replace_social_accounts) — agregada seccion
   "Redes sociales" con el mismo patron de revelado progresivo de
   Step4Formats.tsx (reutilizado 1:1: Field+icono AtSign, select nativo
   con inputClass, Button ghost). ProfileUpdateInput ganó
   `social_accounts?: SocialAccount[] | null`.
   P1 (los tres juntos, decision del usuario): (a) los 9 inputs/textarea/
   selects/boton/error de ProfileForm.tsx migrados a Field/Alert/Button —
   bio y los dos <select> (niche, timezone) usan inputClass/FIELD_LABEL_CLASS
   igual que el select de plataforma en Step4Formats.tsx porque Field es
   input-only; placeholder hex `text-[#75777b]` desaparecio con el primitivo;
   TimezoneNudge.tsx y ProfileView.tsx: border-white/* -> border-glass-edge,
   hover bg-white/20 -> hover:bg-surface-container-lowest/20 (mismo token
   que UserMenu.tsx usa para su fila ghost); shadow arbitraria de
   ProfileView.tsx NO se toco — es el mismo valor ya usado en
   OnboardingWizard.tsx y AuthShell.tsx, patron establecido de superficie
   primaria cerrada, no un arbitrario suelto. (b) saveSuccess:boolean +
   clearSaveSuccess() en profileStore.ts, Alert tone="success" tras guardar
   (mutuamente excluyente con el error), se limpia en cualquier edicion
   nueva. (c) niche/primary_goal/tone/target_audience (los 4 campos que
   ProfileOnboardingInput trata como obligatorios) ya no se mapean a null
   silenciosamente al vaciarlos — bloquean el submit con error de campo
   antes de que diffEditable corra.
   Verificacion: tsc limpio, 213/213 tests, lint sin warnings, detect.mjs []
   (grep de sanidad manual post-fix confirmo cero matches reales).
   PROFILE QUEDA CERRADO (P0+P1). P2 diferido (agrupacion visual de los 5
   campos sueltos nicho/sub-nicho/objetivo/tono/audiencia en secciones) por
   decision del usuario de priorizar P0+P1 en esta pasada.

RESUELTO — landing, rediseno "Estudio Editorial", 2026-08-17 (decision explicita
del usuario, no deuda: landing pasa a ser un mundo de marketing propio, separado
del sistema de la app):
20. [x] LANDING: rediseno completo bajo la direccion "Estudio Editorial". Antes
   del sistema de tokens de la app (glassmorphism "Estudio de Cristal"), LandingView
   era un template generico: hero centrado con texto en gradiente, cards
   bg-white/5 / bg-white/10 sueltas, y un mockup de chat fake dibujado a mano
   con divs (violaba directamente "sparklines/progress rings/rectangulos con
   sombra suave en lugar de contenido" del piso de calidad, y el gradiente de
   texto del titulo violaba el Don't del propio DESIGN.md).
   DECISION DE DISENO (explicita, no deuda): landing es una pieza editorial de
   conversion de una sola pantalla, sin conmutador de tema — no responde al
   par claro/oscuro de la app ni a sus tokens (--color-primary, --color-surface,
   etc.). Vive bajo su PROPIA paleta ("Estudio Editorial"): fondo carbon calido
   (nunca negro puro), tinta calida (nunca blanco puro), y el mismo Violeta
   Electrico del resto del sistema (#6e2ce0 / #a97dff de referencia) recalibrado
   como firma escasa, con el mismo espiritu que la Regla del Diez Por Ciento
   aunque la paleta sea separada.
   TOKENS NUEVOS: frontend/features/landing/landing-tokens.css, bajo el
   selector `.landing-root` (aplicado una sola vez, en LandingView.tsx) para
   que no se filtren al resto de la app. --landing-canvas/-raised/-raised-strong
   (carbon calido), --landing-canvas-overlay/-veil (variantes translucidas para
   nav y vignette), --landing-ink/-muted/-faint (tinta calida), --landing-border/
   -strong (filo), --landing-accent/-hover/-on/-text/-soft/-soft-strong (acento,
   con variante clara --landing-accent-text para texto sobre el canvas oscuro
   porque el acento base pierde contraste ahi: 5.9:1 medido vs 2.6:1), y
   --landing-shadow-accent (la unica sombra, reservada para el panel de CTA
   final). Todo componente de landing consume estos tokens via clases
   arbitrarias (`bg-[var(--landing-canvas)]`), cero hex/rgba sueltos fuera del
   bloque de definicion (verificado por grep).
   TIPOGRAFIA: se agrego Fraunces como segunda fuente, exclusiva de landing.
   frontend/app/layout.tsx la carga con next/font/google igual que Inter
   (variable --font-fraunces, axes opsz/SOFT/WONK, display swap);
   frontend/app/globals.css declara `--font-display` en el bloque `@theme inline`
   junto a `--font-sans`, lo que genera la utilidad `font-display` — usada
   solo en h1/h2 de hero, features y la cita editorial. El resto de la app
   sigue en Inter unicamente.
   COMPONENTES ADAPTADOS (codigo propio, sin instalar CLI, sin dependencias
   nuevas — framer-motion y lucide-react ya eran dependencias):
   - Magic UI "Bento Grid" (magicui.design/docs/components/bento-grid) ->
     BentoGrid.tsx/BentoCard.tsx nuevos, usados por FeaturesGrid.tsx para
     reestructurar las 3 features reales (RAG para Creadores, Onboarding
     Inteligente, Calendario Accionable) en un layout asimetrico (RAG 2 cols +
     Onboarding 1 col arriba, Calendario 3 cols abajo). Se eliminaron la barra
     de progreso fake ("Analizando tono... 67%") y la grilla de calendario fake
     (divs de colores) del template original — exactamente el patron de
     "contenido de relleno" prohibido por el piso de calidad.
   - Magic UI "Text Reveal" (magicui.design/docs/components/text-reveal) ->
     TextReveal.tsx nuevo, absorbe BrandSection.tsx (que mostraba "Tu
     creatividad, potenciada por datos", copy generico de template) con una
     cita editorial real entre el hero y las features: "Un chat que responde
     con tu propio conocimiento, un perfil que recuerda tu nicho y tu tono, y
     un calendario que convierte esa conversacion en contenido listo para
     publicar" — la propuesta de valor real (RAG + perfil + calendario, ver
     PRODUCT.md), sin metricas inventadas.
   - Magic UI "Marquee" (magicui.design/docs/components/marquee) ->
     Marquee.tsx nuevo, usado por NicheMarquee.tsx para mostrar los 6 nichos
     reales de NICHES (shared/constants) en scroll infinito. Explicitamente NO
     logos de clientes ni testimonios — no existen (PRODUCT.md prohibe prueba
     social fabricada, mismo hallazgo ya corregido en calendar/PerformancePanel).
   - Hero editorial split (referencia de composicion de 21st.dev, patron
     copy+visual asimetrico no centrado) -> HeroSection.tsx reescrito: copy a
     la izquierda (7/12), pieza visual a la derecha (5/12). El mockup de chat
     fake se reemplazo por PipelineDiagram.tsx (nuevo): una composicion SVG
     geometrica y animada (framer-motion, trazo de linea + nodos) que dibuja el
     pipeline real del producto — base de conocimiento -> perfil del creador ->
     calendario — no una imitacion de interfaz.
   Explicitamente descartado: Number Ticker / contador de stats (no hay backend
   de analytics real para landing).
   MOTION: un momento orquestado al cargar en HeroSection (stagger de
   framer-motion sobre badge/titulo/subtitulo/CTAs) + revelados en scroll
   (`whileInView`) en BrandSection, FeaturesGrid y CTASection. GradientBackground.tsx
   se re-implemento sobre los tokens nuevos: dos manchas de acento diluidas
   (no cinco, como el fondo de auth) que derivan lento, mas vignette de
   profundidad; toda la animacion se anula bajo prefers-reduced-motion. Cero
   hover:scale/active:scale (verificado por grep, mismo estandar que el resto
   del sistema).
   Navbar.tsx, CTASection.tsx y Footer.tsx migrados a los tokens de landing sin
   componente externo nuevo (misma funcion: nav con links a login/signup, CTA
   final, footer).
   REGLA 5c REVISADA PARA LANDING: la regla previa ("landing debe consumir
   Button/Alert/Field/PasswordField de shared/ui") queda sin efecto para esta
   superficie por la decision de este punto — landing no comparte tokens con
   la app, por lo tanto tampoco comparte primitivos que dependen de esos
   tokens. Boton/CTA de landing son marcado propio sobre --landing-accent.
   Verificacion: tsc limpio, 213/213 tests, eslint sin warnings, detect.mjs []
   sobre frontend/features/landing, grep de sanidad manual confirmo cero
   hover:scale/active:scale/rounded-arbitrario y cero hex sueltos fuera del
   bloque de definicion de landing-tokens.css.
   LANDING QUEDA CERRADO bajo su propio sistema (no aplica el ledger de
   "utilidades hardcodeadas pendientes" de la app: ver punto 4 actualizado).

PENDIENTE:
4. ~16 utilidades de color hardcodeadas en las vistas que faltan.
   Reparto: shared 16 (unico rubro pendiente; landing salio del conteo:
   cerro bajo su propio sistema de tokens, ver punto 20, no bajo el de la app).
   (onboarding: 0, chat: 0, calendar: 0, profile: 0, resueltos)
5b. [x] RESUELTO junto con el punto 5. Las cuatro vistas bajaron de 1005 a 681 lineas
   (-32%) y los primitivos suman 463. El total sube ~139 lineas: extraer NO ahorra
   codigo, elimina puntos de cambio. Un ajuste de sistema que antes habia que hacer
   cuatro veces ahora se hace una.
5c. REGLA PARA LAS SUPERFICIES DE LA APP (no landing, ver punto 20 — landing
   corre bajo su propio sistema de tokens y por lo tanto no comparte estos
   primitivos): consumir Button, Alert, Field y PasswordField. Si una vista
   nueva vuelve a escribir la clase de un input a mano, es un defecto, no una
   variante.
   (onboarding: [x] resuelto 2026-08-17 ver punto 12; calendar: [x] resuelto
   2026-08-17 ver punto 18; profile: [x] resuelto 2026-08-18 ver punto 19;
   landing: no aplica, ver punto 20; chat: parcial, Alert/Button adoptados en
   SourcesModal/ChatView/ChatSidebarContent, resto del feature sin Field)
5. [x] RESUELTO 2026-08-09. Primitivos extraidos a shared/components/ui: Button (con
       buttonClass exportado para los casos en que la accion primaria es un Link),
       Alert (el role lo decide el tono), Field (ata label/input y arma aria-describedby;
       hint y error comparten lugar) y PasswordField (visibilidad controlada, 44px,
       aria-label que refleja la accion). En features/auth: AuthShell, GoogleButton,
       AuthDivider, lib/auth-errors.ts y lib/constants.ts.
       Los iconos inline a mano pasaron a lucide-react, que ya era dependencia.
6. Ocho radios distintos y dos sombras arbitrarias casi idénticas (0.10 y 0.12).
   NOTA: dentro de auth esto ya no puede reaparecer, porque el radio y la sombra
   viven en AuthShell y en Field, no en cada vista.
-->
