import Image from "next/image";

interface ChatHeaderProps {
  onOpenSources: () => void;
}

export default function ChatHeader({ onOpenSources }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-white/15 backdrop-blur-xl border border-white/20 rounded-2xl shadow-xl shrink-0">
      <Image
        src="/logo_content .png"
        alt="ContentSpark"
        width={132}
        height={36}
        priority
        className="rounded-xl p-1.5"
      />

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-gray-800 leading-tight">ContentSpark</h1>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-300" />
            <span className="text-xs text-gray-600">En línea</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 font-light">IA para Creadores de Contenido</p>
      </div>

      <div className="ml-auto">
        <button
          type="button"
          onClick={onOpenSources}
          className="rounded-xl border border-white/50 bg-white/35 px-3 py-1.5 text-xs font-semibold tracking-wide text-indigo-700 transition-colors hover:bg-white/55 cursor-pointer"
        >
          FUENTES
        </button>
      </div>
    </div>
  );
}
