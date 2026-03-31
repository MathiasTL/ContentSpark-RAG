import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="flex items-center gap-3">
          <img src="/only_logo.png" alt="ContentSpark" className="h-6 w-6" />
          <span className="text-lg font-semibold text-white/80">ContentSpark</span>
        </Link>

        <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
          {[
            { label: "Privacidad", href: "#" },
            { label: "Términos", href: "#" },
            { label: "Twitter", href: "#" },
            { label: "Instagram", href: "#" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="text-xs font-light uppercase tracking-widest text-white/30 transition-colors hover:text-[#b08cff]"
            >
              {label}
            </a>
          ))}
        </div>

        <p className="text-xs font-light uppercase tracking-widest text-white/20">
          © 2025 ContentSpark
        </p>
      </div>
    </footer>
  );
}
