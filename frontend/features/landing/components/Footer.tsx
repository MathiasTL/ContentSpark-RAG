import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--landing-border)] px-6 py-10 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/only_logo.png"
            alt="ContentSpark"
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
          <span className="text-base font-semibold text-[var(--landing-ink-muted)]">
            ContentSpark
          </span>
        </Link>

        <p className="text-xs font-light tracking-widest text-[var(--landing-ink-faint)] uppercase">
          © 2025 ContentSpark
        </p>
      </div>
    </footer>
  );
}
