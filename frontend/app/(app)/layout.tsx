// Layout protegido — Fase 1: agregar auth guard
// Por ahora solo renderiza children
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
