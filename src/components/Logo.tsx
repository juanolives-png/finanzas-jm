// Logo de Numo (la misma geometría del kit de marca: trazos redondos, la "o" es un ojo / gráfico de torta).
// El color de las letras sale de `currentColor`; el cuarto lleno, de la variable --brand.
export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  const vb = [-6.5, -6.5, 295.5, 73];
  return (
    <svg className={className} height={height} viewBox={vb.join(" ")} style={{ width: (height * vb[2]) / vb[3] }} role="img" aria-label="Numo">
      <path d="M0,60 V22 A22,22 0 0 1 44,22 V60 M64,0 V38 A22,22 0 0 0 108,38 V0 M128,60 V20 A20,20 0 0 1 168,20 V60 M168,20 A20,20 0 0 1 208,20 V60" fill="none" stroke="currentColor" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="252" cy="30" r="24" fill="none" stroke="currentColor" strokeWidth={13} />
      <path d="M252,30 L252,12.5 A17.5,17.5 0 0 1 269.5,30 Z" fill="var(--brand-mark, var(--green))" />
    </svg>
  );
}

/** Solo el símbolo (el aro con el cuarto lleno). */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Numo">
      <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="16" />
      <path d="M50,50 L50,22 A28,28 0 0 1 78,50 Z" fill="var(--brand-mark, var(--green))" />
    </svg>
  );
}
