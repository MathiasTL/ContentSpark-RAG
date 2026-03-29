export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  sources?: Source[];
}

export interface Source {
  title?: string;
  url?: string;
  content?: string;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
