---
name: ContentSpark
description: Un estudio de cristal para creadores — vidrio translúcido, violeta escaso, instrumentos precisos.
colors:
  primary: "#6e2ce0"
  primary-container: "#b08cff"
  secondary: "#b4005d"
  surface: "#f5f6fb"
  surface-container: "#e6e8ee"
  surface-container-lowest: "#ffffff"
  on-surface: "#2c2f33"
  on-surface-variant: "#595c60"
  glass-edge: "rgba(255, 255, 255, 0.40)"
  glass-edge-soft: "rgba(255, 255, 255, 0.20)"
  danger: "#b3261e"
  danger-container: "#fceceb"
  primary-dark: "#a97dff"
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
- **Filo de Vidrio** (`{colors.glass-edge}` / `{colors.glass-edge-soft}`): los bordes que definen dónde termina una lámina de vidrio. El filo fuerte va en superficies flotantes; el suave, en superficies de fondo.
- **Alerta** (`{colors.danger}` sobre `{colors.danger-container}`): errores de formulario y confirmaciones destructivas. Es el único rojo del sistema.

### Named Rules

**La Regla del Diez Por Ciento.** El Violeta Eléctrico no cubre más del 10% del área de ninguna pantalla. Su rareza es lo que lo hace legible como señal. Un fondo de sección teñido de violeta, una tarjeta con gradiente violeta o una sombra violeta bajo un elemento no interactivo violan esta regla.

**La Regla del Filo, No del Relleno.** El vidrio se define por su borde y su difuminado, no por su opacidad. Si una superficie necesita subir de opacidad para leerse, el problema es el contraste del texto, no el vidrio.

**La Regla del Par Completo.** Todo token de color existe en claro y en oscuro. Un color que solo funciona en un modo no es un token del sistema: es un hardcodeo, y se trata como defecto.

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
- **Primary:** fondo Violeta Eléctrico plano (no gradiente), texto blanco, relleno `12px 24px`, tipografía Body Strong.
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

PENDIENTE:
4. 320 utilidades de color hardcodeadas repartidas en las vistas, más 54 hexadecimales sueltos.
   Reparto: landing 107, calendar 80, chat 48, auth 76, onboarding 24, profile 20, shared 16.
   Mientras existan, esas zonas no responden al cambio de tema.
5. No existen primitivos compartidos (Button, Input, Card, Field) en shared/components/ui.
6. Ocho radios distintos y dos sombras arbitrarias casi idénticas (0.10 y 0.12).
-->
