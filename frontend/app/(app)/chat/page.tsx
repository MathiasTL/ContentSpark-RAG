import { Suspense } from "react";
import { ChatView } from "@/features/chat";

export default function ChatIndexPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  );
}
