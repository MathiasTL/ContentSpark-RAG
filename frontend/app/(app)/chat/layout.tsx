import { ChatListProvider } from "@/features/chat/hooks/useChatList";
import ChatSidebar from "@/features/chat/components/ChatSidebar";
import ChatMobileDrawer from "@/features/chat/components/ChatMobileDrawer";
import ChatStoreBridge from "@/features/chat/components/ChatStoreBridge";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatListProvider>
      <ChatStoreBridge />
      <div className="flex h-dvh w-full">
        <ChatSidebar />
        <ChatMobileDrawer />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatListProvider>
  );
}
