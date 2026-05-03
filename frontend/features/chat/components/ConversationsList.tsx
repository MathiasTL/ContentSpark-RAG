interface Conversation {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
}

// TODO(phase-1): replace with GET /api/chats once backend persistence lands.
export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "reel-strategy",
    title: "Estrategia de Reels",
    preview: "Optimiza los primeros 3 segundos de tu video...",
    timestamp: "Hace 12m",
  },
  {
    id: "hook-ideas",
    title: "Ideas de hooks",
    preview: "Necesito ángulos frescos para mi próximo...",
    timestamp: "Hace 2h",
  },
  {
    id: "growth-plan",
    title: "Plan de crecimiento",
    preview: "Estrategia Q3 para YouTube Shorts y...",
    timestamp: "Ayer",
  },
];

export type { Conversation };
