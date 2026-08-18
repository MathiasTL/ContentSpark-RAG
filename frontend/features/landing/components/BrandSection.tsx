import TextReveal from "./TextReveal";

const QUOTE =
  "Un chat que responde con tu propio conocimiento, un perfil que recuerda tu nicho y tu tono, y un calendario que convierte esa conversación en contenido listo para publicar.";

// Momento editorial entre el hero y las features, adaptado de Magic UI
// "Text Reveal". Reemplaza el bloque "Tu creatividad, potenciada por datos"
// con texto genérico del template — esta es la propuesta de valor real del
// producto (RAG + perfil de creador + calendario, ver PRODUCT.md), sin
// métricas inventadas.
export default function BrandSection() {
  return (
    <section id="about" aria-label="Propuesta de valor">
      <TextReveal text={QUOTE} />
    </section>
  );
}
