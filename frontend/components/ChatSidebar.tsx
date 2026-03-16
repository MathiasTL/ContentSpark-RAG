interface ChatSidebarProps {
  onNewChat: () => void;
}

export default function ChatSidebar({ onNewChat }: ChatSidebarProps) {
  return (
    <aside className="w-full md:w-72 md:shrink-0 bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-3xl overflow-hidden">
      <div className="flex h-full flex-col bg-white/10">
        <div className="px-5 py-5 border-b border-white/20">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-indigo-500/80">Workspace</p>
          <h2 className="mt-2 text-xl font-semibold text-gray-800">Chats</h2>
          <p className="mt-1 text-sm font-light text-gray-500">Inicia una conversacion nueva y limpia el estado actual.</p>
        </div>

        <div className="flex-1 p-4">
          <button
            onClick={onNewChat}
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-white/40 bg-white/35 px-4 py-3 text-left text-gray-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/50 hover:shadow-md cursor-pointer"
          >
            <span>
              <span className="block text-sm font-semibold text-gray-800">Nuevo Chat</span>
              <span className="block text-xs font-light text-gray-500">Reinicia la conversacion actual</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md transition-all hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
