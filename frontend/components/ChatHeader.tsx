import Image from "next/image";

export default function ChatHeader() {
  return (
    <div className="flex items-center gap-3 px-6 py-3 border-b border-white/20 bg-white/10 backdrop-blur-md shrink-0">
      <Image
        src="/logo_content .png"
        alt="ContentSpark"
        width={132}
        height={36}
        priority
        className="rounded-xl p-1.5"
      />

      <div>
        <h1 className="text-base font-semibold text-gray-800 leading-tight">ContentSpark</h1>
        <p className="text-xs text-gray-500 font-light">IA para Creadores de Contenido</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-300" />
        <span className="text-xs text-gray-500">En linea</span>
      </div>
    </div>
  );
}
