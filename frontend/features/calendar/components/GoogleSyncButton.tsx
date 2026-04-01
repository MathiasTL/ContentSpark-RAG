"use client";

export default function GoogleSyncButton() {
  return (
    <button className="group flex w-full items-center justify-center gap-4 rounded-3xl border border-white/20 bg-white/10 py-5 shadow-xl backdrop-blur-xl transition-all hover:scale-[1.03] hover:bg-white/15 active:scale-95">
      {/* Icono Google Calendar */}
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 p-1.5 shadow-sm transition-transform group-hover:rotate-12">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z" opacity="0.1" />
          <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="#4285F4" strokeWidth="1.5" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="#4285F4" strokeWidth="1.5" />
          <line x1="8" y1="3" x2="8" y2="6" stroke="#4285F4" strokeWidth="1.5" />
          <line x1="16" y1="3" x2="16" y2="6" stroke="#4285F4" strokeWidth="1.5" />
          <rect x="6" y="12" width="3" height="3" rx="0.5" fill="#EA4335" />
          <rect x="10.5" y="12" width="3" height="3" rx="0.5" fill="#FBBC05" />
          <rect x="15" y="12" width="3" height="3" rx="0.5" fill="#34A853" />
        </svg>
      </div>
      <span className="font-bold tracking-tight text-white">Importar a Google</span>
    </button>
  );
}
