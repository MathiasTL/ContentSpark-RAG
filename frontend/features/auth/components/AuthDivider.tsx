type Props = {
  label: string;
};

/** Separador entre el formulario y los proveedores externos. */
export default function AuthDivider({ label }: Props) {
  return (
    <div className="my-5 flex w-full items-center gap-3 sm:my-6 sm:gap-4">
      <div className="h-px flex-1 bg-glass-edge" />
      <span className="text-xs font-medium uppercase tracking-[0.1em] text-on-surface-variant">
        {label}
      </span>
      <div className="h-px flex-1 bg-glass-edge" />
    </div>
  );
}
