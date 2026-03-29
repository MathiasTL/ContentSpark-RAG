export default function Background() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(140deg,#9fb6e8_0%,#b8bde9_34%,#d8c7e8_63%,#eab8d5_100%)]" />
      <div className="absolute -left-24 top-16 h-96 w-96 rounded-full bg-[#8ca8df]/40 blur-3xl" />
      <div className="absolute right-[-140px] top-[-60px] h-[26rem] w-[26rem] rounded-full bg-[#d8bde8]/45 blur-3xl" />
      <div className="absolute left-[28%] top-[20%] h-72 w-72 rounded-full bg-[#fbd36c]/22 blur-3xl" />
      <div className="absolute right-[14%] bottom-[-80px] h-[30rem] w-[30rem] rounded-full bg-[#e8b0d4]/50 blur-3xl" />
      <div className="absolute left-[18%] bottom-[8%] h-56 w-56 rounded-full bg-[#9ac7ee]/30 blur-3xl" />
    </div>
  );
}
