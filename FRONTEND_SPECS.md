# Arquitectura Frontend: ContentSpark UI

Guía de referencia para construir el frontend de ContentSpark (app + landing). Cubre stack, librerías de componentes, animaciones, paletas, recetas por sección y caveats de performance/accesibilidad.

> **Alcance**: cubre tanto la **app autenticada** (chat multichat, auth, onboarding, calendar, profile — fases 1–4) como la **landing page de marketing** (fase 5). Cada sección indica a qué parte aplica.

---

## 1. Stack Tecnológico

| Pieza | Elección | Notas |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | RSC por defecto, `"use client"` solo donde haya estado |
| **Lenguaje** | TypeScript | strict mode |
| **Estilos** | Tailwind CSS v4 | `@theme inline` para tokens |
| **UI base** | shadcn/ui (`new-york` style, base `neutral`, CSS vars: yes) | Foundation; todo lo demás se apila encima |
| **Animación** | Motion for React (`motion.dev`, antes Framer Motion) | Default. GSAP solo si se usa MotionPath para el zigzag |
| **Iconos** | `lucide-react` | Incluye el ícono `Star` para el logo |
| **Smooth scroll** | `lenis` (antes `@studio-freight/lenis`) | Activar solo en landing, no en chat |
| **Theming** | `next-themes` (`class` strategy) | Toggle sol/luna en navbar |
| **Markdown (chat)** | `react-markdown` + `remark-gfm` | Para respuestas del bot |
| **Componentes Radix** | `@radix-ui/react-scroll-area` | Ya en uso |
| **Auth** | `@supabase/supabase-js` + `@supabase/ssr` | JWT en `Authorization` header al backend |
| **API client** | Fetch nativo → `http://localhost:8000/api/*` | El frontend NO toca DB directamente |

### Setup base (landing nueva o feature aislada)
```bash
pnpm create next-app contentspark --typescript --tailwind --app
pnpm dlx shadcn@latest init                # style: new-york, base: neutral, CSS vars
pnpm dlx shadcn@latest add button card dialog tabs sheet input toggle dropdown-menu scroll-area
pnpm add motion lucide-react next-themes lenis
```

---

## 2. Tipografía

* **Principal**: `Inter` vía `next/font/google` en `app/layout.tsx`. Alternativa estándar a SF (Apple).
* **Pesos**: Light 300 (textos largos), Regular 400 (UI), Semibold 600 (títulos), Bold 700 (CTAs / hero).
* **Display alternativo (opcional para landing)**: `Cal Sans` o `Geist` (`next/font/local`) para titulares grandes con más carácter.

---

## 3. Paleta de Color

### App autenticada (chat, onboarding, calendar)
Glassmorphism suave estilo iOS/macOS Monterey. Fondo principal: gradiente púrpura/azul/rosa pastel.

### Landing (vibrante creator tier — paleta Instagram)
```css
/* CSS vars en globals.css */
--brand-purple:  #833AB4;
--brand-magenta: #C13584;
--brand-pink:    #E1306C;
--brand-red:     #FD1D1D;
--brand-orange:  #F77737;
--brand-gold:    #FCAF45;
--brand-peach:   #FFDC80;

/* Glass tokens */
--glass-light:   bg-white/10;
--glass-dark:    bg-white/5;     /* sobre fondos oscuros */
--glass-border:  border-white/20;
--glass-ring:    ring-1 ring-white/10;
```
Generadores de paleta: [coolors.co](https://coolors.co), [uigradients.com](https://uigradients.com), [realtimecolors.com](https://realtimecolors.com) (test de contraste WCAG).

### Dark mode (estética "Linear Look")
Negros casi puros (`zinc-950`/`zinc-900`) con gradientes multistop sutiles. Referencias en frontend.horse/articles/the-linear-look/ (linear.app, vercel.com, resend.com, clerk.com, supabase.com, railway.app, raycast.com).

---

## 4. Librerías de Componentes (todas MIT salvo donde se indique)

| Librería | URL | Qué usar | Cuándo |
|---|---|---|---|
| **shadcn/ui** | [ui.shadcn.com](https://ui.shadcn.com) | Button, Card, Dialog, Tabs, Sheet, Form, Input, ScrollArea | Base de todo |
| **Magic UI** | [magicui.design](https://magicui.design) | `AnimatedGradientText`, `BorderBeam`, `Marquee`, `ShimmerButton`, `BentoGrid`, `NumberTicker`, `Globe`, `DotPattern`, `Dock` | Hero text, CTAs, social proof |
| **Aceternity UI** | [ui.aceternity.com](https://ui.aceternity.com) | `AuroraBackground`, `BackgroundGradientAnimation`, `TracingBeam`, `StickyScrollReveal`, `FloatingNav`, `BentoGrid`, `Spotlight`, `WavyBackground`, `BackgroundBeams` | Backgrounds, scroll reveals, nav. **Free tier MIT**; hay Pro de pago |
| **Cult UI** | [cult-ui.com](https://cult-ui.com) | `FeatureCarousel`, `TextureCard`, `FamilyButton`, `DynamicIsland`, `ShiftCard`, `BgAnimatedButton` | "Wow" components para features |
| **Origin UI** | [originui.com](https://originui.com) | Forms, inputs, selects, pricing tables, dialogs | Forms complejos, upgrade flow. Tailwind v4 nativo |
| **Lukacho UI** | [ui.lukacho.com](https://ui.lukacho.com) | `AnimatedPricingComponent`, `BackgroundGridBeam`, `BackgroundLights`, `Marquee`, `ImageSwiper`, animated `TabList` | Pricing animado, marquee de testimonios |
| **Animate UI** | [animate-ui.com](https://animate-ui.com) | `GradientBackground` y backgrounds con motion | Alternativa ligera a Aceternity |
| **shadcn.io blocks** | [shadcn.io/blocks](https://shadcn.io/blocks) | 6,167 bloques pre-armados en 56 categorías (`navbar-sticky-blur`, pricing blocks, footers) | Acelera secciones completas |
| **shadcn.io shaders** | [shadcn.io/shaders](https://shadcn.io/shaders) | 57 WebGL shaders gratis (aurora, plasma, nebula, waves, ripple) | Alternativa free a Paper Shaders |
| **21st.dev** | [21st.dev](https://21st.dev) | Índice/marketplace de todas las anteriores + registro AI | Descubrimiento (`npx shadcn add` desde cualquier registry) |
| **Radix UI** | [radix-ui.com](https://radix-ui.com) | Headless primitives | Ya bajo shadcn; tocar solo para a11y avanzada |
| **Glass packs (opcional)** | glasscn-ui, shadcn-glass-ui, Glass UI (Crenspire) | Cards glass pre-estilizadas | Si no querés mantener clases `backdrop-blur` a mano |

### Stack recomendado para ContentSpark
```
shadcn/ui (base)
  + Magic UI            → gradient text, marquee, bento, shimmer button
  + Aceternity UI       → Aurora, Tracing Beam, Floating Navbar, Spotlight
  + Cult UI             → FeatureCarousel para sección "qué hace"
  + Origin UI           → Pricing primitives + forms (onboarding, profile)
  + Motion for React    → Engine de animación
  + next-themes         → Dark/light toggle
  + lucide-react        → Iconos (incluyendo el Star)
  + lenis (solo landing)→ Smooth scroll
```

---

## 5. Referencias Visuales (inspiración)

### Tier "vibrante / creator tool" (paleta ContentSpark)
- **Luma AI** — [lumalabs.ai](https://lumalabs.ai) — hero con gradient bold + tipografía dinámica
- **Tella** — [tella.tv](https://tella.tv) — purple vibrante + demos interactivos
- **Ghost** — [ghost.org](https://ghost.org) — vibrante, bold, escaneable, misión-driven
- **Lavender** — [lavender.ai](https://lavender.ai) — lavender-green energético, B2B-credible

### Tier "Linear Look" (referencia para dark mode)
linear.app · particl.com · reflect.app · authkit.com · nuxtlabs.com · resend.com · railway.app · clerk.com · vercel.com · supabase.com · whop.com · raycast.com · million.dev

### Galerías para seguir explorando
- **Saaspo** — [saaspo.com/style/gradients](https://saaspo.com/style/gradients) — landings con gradientes
- **Lapa Ninja**, **Mobbin**, **Landingpicks**, **SaaSFrame.io** — galerías con filtros

---

## 6. Glassmorphism — Tokens y Reglas

```tsx
// Contenedor principal (cards de chat, pricing, features)
className="bg-white/10 dark:bg-zinc-950/40 backdrop-blur-xl
           border border-white/20 dark:border-white/10
           ring-1 ring-white/10
           shadow-2xl rounded-3xl"

// Navbar sticky con blur dinámico
className="sticky top-0 z-50 backdrop-blur-xl
           bg-white/60 dark:bg-zinc-950/60
           border-b border-white/10"
```

**Regla de contraste (a11y)**: el texto NUNCA va directo sobre gradiente animado. Siempre envolverlo en una card glass con `bg-white/40 dark:bg-zinc-950/40 backdrop-blur-2xl` mínimo.

---

## 7. Background "Ethereal Plasma" — Tres Tiers

Decisión gate: si la meta es bounce-rate <40% en mobile mid-range → Tier 2 (CSS). Si querés "wow" desktop-first → Tier 1.

### Tier 1 — WebGL (producción "wow")
- **`@paper-design/shaders-react` `<MeshGradient>`** ⭐ recomendado
  - [shaders.paper.design](https://shaders.paper.design)
  - API declarativa, zero-deps, React-first
  - Uso con paleta Instagram:
  ```tsx
  <MeshGradient
    colors={["#833AB4","#FD1D1D","#FCB045","#E1306C","#5B51D8"]}
    distortion={1} swirl={0.8} speed={0.2}
  />
  ```
- **ShaderGradient** — [shadergradient.co](https://shadergradient.co) / [github.com/ruucm/shadergradient](https://github.com/ruucm/shadergradient) — Three.js + R3F, más control (cámara 3D, grain, lighting), más pesado
- **`whatamesh`** — [github.com/jordienr/whatamesh](https://github.com/jordienr/whatamesh) — ⚠️ dormido desde 2023; el clásico "Stripe gradient" pero NO recomendado para builds nuevos. Companion: [kevinhufnagl.com](https://kevinhufnagl.com/how-to-recreate-the-stripe-webgl-gradient-effect)

### Tier 2 — CSS + Motion (default seguro)
- **Aceternity `AuroraBackground`** — [ui.aceternity.com/components/aurora-background](https://ui.aceternity.com/components/aurora-background) — keyframes CSS puros, zero JS runtime cost
- **Aceternity `BackgroundGradientAnimation`** — [ui.aceternity.com/components/background-gradient-animation](https://ui.aceternity.com/components/background-gradient-animation) — 5 blobs `radial-gradient` con `moveVertical`/`moveHorizontal`/`moveInCircle` (lo más "plasma-like" CSS-only)
- **shadcn.io `GradientBackground`** — blobs blurred animados con Motion (15–25s, `easeInOut`)

### Tier 3 — Floor (perf / `prefers-reduced-motion`)
- SVG mesh-gradient estático exportado con [Mesher](https://csshero.org/mesher/) o [magicpattern.design](https://magicpattern.design)
- `@media (prefers-reduced-motion: reduce) { animation: none }` sobre la capa animada

### Generadores de blobs / meshes
- [magicpattern.design/tools/blob-generator](https://magicpattern.design/tools/blob-generator)
- [blobs.xom9ik.com](https://blobs.xom9ik.com)
- [kinetools.com/blob-shape-generator](https://kinetools.com/blob-shape-generator)
- [haikei.app](https://haikei.app)
- [csshero.org/mesher](https://csshero.org/mesher/)

---

## 8. Animación Estrella: Zigzag Scroll-Following Star

La interacción más distintiva del brief. Tres caminos de implementación.

### Path A (recomendado) — GSAP MotionPath + ScrollTrigger
- **Receta canónica**: artículo Codrops "Building Responsive, Scroll-Triggered Curved Path Animations with GSAP" por Ross Anderson (17 dic 2025) — [tympanus.net/codrops/2025/12/17/building-responsive-scroll-triggered-curved-path-animations-with-gsap](https://tympanus.net/codrops/2025/12/17/building-responsive-scroll-triggered-curved-path-animations-with-gsap/)
- **API**:
  ```js
  gsap.to(starEl, {
    motionPath: { path: "#zigzag", align: "#zigzag", alignOrigin: [0.5, 0.5], autoRotate: false },
    scrollTrigger: { trigger: "main", start: "top top", end: "bottom bottom", scrub: 1 }
  })
  ```
- **CodePens de estudio**:
  - "Bee follows S-path while pinned" — [codepen.io/neeraj121/pen/qBNYxWv](https://codepen.io/neeraj121/pen/qBNYxWv)
  - "SVG MotionPath + DrawSVG + ScrollTrigger" — [codepen.io/snorkltv/pen/KKmZYGy](https://codepen.io/snorkltv/pen/KKmZYGy)
  - Oficial GreenSock — [codepen.io/GreenSock/pen/xxYwOBE](https://codepen.io/GreenSock/pen/xxYwOBE)
- **Licencias**: MotionPathPlugin + ScrollTrigger son **gratis**. Solo DrawSVG/SplitText/MorphSVG son Club GreenSock.

### Path B — Pure Motion for React (zero GSAP)
- `useScroll({ target: containerRef })` → `useTransform(scrollYProgress, [0,1], [0,1])` mapeado a `pathLength` de `motion.path` para dibujar el zigzag
- Posicionar la estrella en un `motion.g` y animar su `offsetDistance` (CSS Motion Path) **o** samplear el path con `path.getPointAtLength(progress * pathLength)` dentro de `useMotionValueEvent` y escribir a `motion.div` `x`/`y`
- Tutoriales:
  - [dev.to/heres/scroll-svg-path-with-framer-motion-54el](https://dev.to/heres/scroll-svg-path-with-framer-motion-54el)
  - blog.olivierlarose.com — "How to Move a Text along an SVG Path on Scroll using React and Framer Motion"

### Path C — Drop-in: Aceternity Tracing Beam
- [ui.aceternity.com/components/tracing-beam](https://ui.aceternity.com/components/tracing-beam) — "Beam que sigue un SVG mientras scrolleas; ajusta longitud con velocidad"
- Para hacer que la **estrella** monte el beam: renderizar `<motion.svg>` con `position: absolute` y bindear su `top` al mismo `useScroll`/`useSpring`, con `getPointAtLength` resolviendo x/y

### Smooth scroll
**Lenis** (`pnpm add lenis`) — solo en landing, no en chat. Configurar con `scrub: 0.8` para que la estrella siga al scroll con leve easing. GSAP también tiene ScrollSmoother (Club only).

### Accesibilidad
Branch `prefers-reduced-motion`: pinear la estrella y deshabilitar motion del path.

---

## 9. Otras Librerías de Animación (cuándo)

- **Motion for React** (default) — [motion.dev](https://motion.dev) — fastest-growing animation lib, 30M+ downloads/mes
- **GSAP 3** — [gsap.com](https://gsap.com) — solo si necesitás scrubbed timelines pixel-accurate
- **Theatre.js** — [theatrejs.com](https://theatrejs.com) — editor visual; overkill para un zigzag, útil si escalás a scrollytelling completo
- **Lottie / lottie-react** — Para piezas pre-renderizadas (íconos animados de features)
- **React Spring** — Físicas, micro-interacciones. Mayormente superseded por Motion en 2026

---

## 10. Recetas por Sección (Landing)

### Header — Sticky Glass Navbar
- **Drop-in**: shadcn.io block `navbar-sticky-blur` — transición a frosted glass on scroll vía Motion
- **DIY**:
  ```tsx
  <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/60 dark:bg-zinc-950/60 border-b border-white/10">
  ```
  Togglear `data-scrolled` con `useMotionValueEvent(scrollY, "change", ...)` para blur más fuerte después de 20px
- **Alternativas**: Magic UI `Dock`, Aceternity `FloatingNav` (pill centrada)
- **Theme toggle**: Radix Switch + sun/moon de lucide-react

### Hero
- Underlay: `<AuroraBackground>` (CSS) o `<MeshGradient>` (WebGL)
- Headline: Magic UI `<AnimatedGradientText>` (la paleta default es Instagram: `ffaa40 → 9c40ff → ffaa40`)
- Primary CTA: Magic UI `<ShimmerButton>`
- Social proof: Magic UI `<Marquee>` con avatares de creators TikTok/Instagram/YouTube

### Features
- **Opción A**: Cult UI `<FeatureCarousel>` (reveal horizontal animado)
- **Opción B**: Magic UI `<BentoGrid>` + `<BorderBeam>` en cada card
- **Opción C**: Aceternity `<StickyScrollReveal>` (left text / right visual scrollytelling)

### Pricing
- Estructura: shadcn pricing block #04 (3 tiers + toggle anual)
- Cards: `backdrop-blur-xl bg-white/10 border border-white/20 ring-1 ring-white/10`
- Tier "Pro": Magic UI `<BorderBeam>` + gradient ring
- Drop-in opinionado: Lukacho UI `AnimatedPricingComponent`

### CTA section
- Background: Aceternity `<BackgroundBeams>` o `<Spotlight>`
- Headline centrado + email input
- Reusar `<ShimmerButton>`

### Footer
- shadcn footer block + Magic UI `<DotPattern>` de background

---

## 11. App Autenticada — Chat Multichat (foco actual)

### Estética
* **Fondo**: gradiente suave púrpura/azul/rosa pastel (estilo macOS Monterey/Sonoma). Más sutil que la landing
* **Contenedor principal (glass)**:
  ```tsx
  bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl
  ```
* **Burbujas de chat (iMessage/iOS)**:
  - **Usuario (derecha)**: `bg-blue-500 text-white rounded-2xl rounded-br-none` (color sólido o gradiente azul sutil)
  - **Bot/ContentSpark (izquierda)**: `bg-white/30 backdrop-blur-md text-gray-800 border border-white/40 rounded-2xl rounded-bl-none`
* **Sidebar multichat**: glass card con lista scrollable (`@radix-ui/react-scroll-area`), botón "+ Nuevo chat", agrupado por fecha
* **Header**: barra glass separada arriba del chat (no pegada)
* **Input**: integrado sin bordes bruscos, placeholder *"Pregunta sobre tu contenido..."*, botón send que resalte, soporte Enter

### Comportamiento (lógica React)
* Client Component (`"use client"`)
* Estado `messages: Array<{ role: 'user' | 'ai', content: string, sources?: string[] }>`
* Estado `isLoading` para typing indicator (3 dots animados)
* Auto-scroll al último mensaje (`useEffect` + `scrollIntoView`)
* Markdown rendering con `react-markdown` + `remark-gfm`
* Suggested prompts cuando `messages.length === 0`
* JWT (Supabase) en `Authorization: Bearer ...` en cada request a `/api/chat`
* Streaming: leer `ReadableStream` del response y appendar chunks al último mensaje del bot

### Responsive
* Mobile: sidebar como `Sheet` (Radix), abre con menú hamburguesa
* Desktop: sidebar fijo izquierda, ~280px de ancho

---

## 12. Theming (light/dark)

- **`next-themes`** con `class` strategy
- **tweakcn** — [tweakcn.com](https://tweakcn.com) — editor visual de temas shadcn, exporta CSS vars
- **Tailwind v4** con bloques `@theme inline` (approach recomendado por Aceternity en 2026)
- **Realtime Colors** — [realtimecolors.com](https://realtimecolors.com) — test de accesibilidad con texto real

---

## 13. Performance & Accesibilidad

### Budget (gate antes de shippear)
- Desktop LCP > 2.5s con WebGL plasma → fallback a Aurora CSS
- Mobile mid-range (Moto G Power): TBT < 200ms
- Si Lighthouse cae <80 perf con plasma → lazy-mount con `requestIdleCallback`

### View transitions
Same-document view transitions son Baseline Newly Available (oct 2025): Chrome 111+, Edge 111+, Safari 18+, Firefox 144+.

### Accesibilidad obligatoria
- `prefers-reduced-motion` branch para zigzag star, marquee, aurora
- Texto sobre plasma SIEMPRE en card glass `bg-white/40 dark:bg-zinc-950/40 backdrop-blur-2xl`
- Contrast check con realtimecolors.com antes de mergear

### Caveats
- **Aceternity Pro** requiere licencia paga; los componentes nombrados acá (Aurora, BackgroundGradientAnimation, TracingBeam, BackgroundBeams, StickyScrollReveal, FloatingNav) están en el **free tier MIT**
- **`whatamesh` dormido desde 2023**; no apostar builds nuevos. Usar Paper Shaders
- **GSAP**: MotionPath + ScrollTrigger free. DrawSVG/SplitText/MorphSVG son Club only
- **Codrops Lando Norris article**: tutorial/case study, NO está en producción

---

## 14. Plan de Implementación (resumen)

**Fase landing (5 días aproximados)**:
1. **Day 1-2 — Scaffold**: Next 16 + shadcn init + dependencias + paleta CSS vars
2. **Day 3-4 — Plasma + nav**: decisión WebGL vs CSS, navbar sticky-blur con theme toggle
3. **Day 5-6 — Zigzag star** (diferenciador): SVG en Figma → export → Path A (GSAP) o B (Motion) + Lenis + branch reduced-motion
4. **Day 7-9 — Secciones**: hero, features, pricing, CTA, footer
5. **Day 10 — Polish**: Lighthouse mobile, view transitions, contrast pass

**Decisiones de threshold**:
- LCP desktop >2.5s con WebGL → CSS Aurora
- Zigzag percibido como distractor en user testing → opacity 60%, `scrub: 1.5`
- Conversión pricing baja vs control → revisar contraste de highlight, no la estructura

---

## 15. Recursos rápidos

- [shadcn.io/blocks](https://shadcn.io/blocks) — 6k+ bloques pre-armados
- [shadcn.io/shaders](https://shadcn.io/shaders) — 57 shaders WebGL free
- [21st.dev](https://21st.dev) — índice cross-library
- [shaders.paper.design](https://shaders.paper.design) — playground Paper Shaders
- [shadergradient.co](https://shadergradient.co) — playground ShaderGradient
- [frontend.horse/articles/the-linear-look](https://frontend.horse/articles/the-linear-look/) — análisis Linear Look
- [tympanus.net/codrops](https://tympanus.net/codrops/) — Codrops (zigzag scroll tutorial)
- [motion.dev](https://motion.dev) — docs Motion for React
