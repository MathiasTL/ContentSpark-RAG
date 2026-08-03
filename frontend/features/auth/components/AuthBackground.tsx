"use client";

export default function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      {/* Gradiente base */}
      <div className="absolute inset-0 bg-[linear-gradient(120deg,var(--color-surface)_0%,#eef3ff_50%,#f8f0ff_100%)] dark:bg-[linear-gradient(120deg,var(--color-surface)_0%,#1a2035_50%,#241a33_100%)]" />

      {/* Blob primario — púrpura */}
      <div className="auth-blob auth-blob-1 absolute -top-20 -left-20 h-[500px] w-[500px] rounded-full bg-primary opacity-40 blur-[80px] dark:opacity-25" />

      {/* Blob terciario — azul claro */}
      <div className="auth-blob auth-blob-2 absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#79b3ff] opacity-40 blur-[80px] dark:bg-[#2f5c99] dark:opacity-30" />

      {/* Blob secundario — rosa */}
      <div className="auth-blob auth-blob-3 absolute top-1/2 left-1/3 h-[300px] w-[300px] rounded-full bg-[#ffc1d1] opacity-40 blur-[80px] dark:bg-[#99475a] dark:opacity-25" />

      {/* Blob extra — lavanda profundo */}
      <div className="auth-blob auth-blob-4 absolute -bottom-32 left-[15%] h-[350px] w-[350px] rounded-full bg-primary-container opacity-30 blur-[100px] dark:opacity-20" />

      {/* Blob extra — cian suave */}
      <div className="auth-blob auth-blob-5 absolute top-[10%] right-[20%] h-[250px] w-[250px] rounded-full bg-[#5aa6ff] opacity-25 blur-[90px] dark:bg-[#2f5c8f] dark:opacity-20" />
    </div>
  );
}
