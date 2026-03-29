// Página principal — redirige al chat o landing según auth
// Fase 5: Se reemplaza con LandingPage de features/landing
// Fase 1: Redirige a /login si no autenticado, o al último chat si autenticado
import ChatView from '@/features/chat/ChatView';

export default function HomePage() {
  return <ChatView />;
}
