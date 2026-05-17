import { ChatListProvider } from "@/features/chat/hooks/useChatList";
import ChatSidebar from "@/features/chat/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatListProvider>
      <div className="flex h-dvh w-full">
        <ChatSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatListProvider>
  );
}
