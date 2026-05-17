import { Suspense } from "react";
import { ChatView } from "@/features/chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatByIdPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <ChatView chatId={id} />
    </Suspense>
  );
}
