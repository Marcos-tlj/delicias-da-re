/** Aparece na hora ao trocar de tela, enquanto os dados chegam. */
export default function Loading() {
  const bar = "animate-pulse rounded-xl bg-line/70";
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-5">
      <div className="space-y-2">
        <div className={`${bar} h-4 w-32`} />
        <div className={`${bar} h-8 w-56`} />
      </div>
      <div className="h-40 animate-pulse rounded-3xl bg-brand/15" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${bar} h-24 rounded-2xl`} />
        ))}
      </div>
      <div className="space-y-px overflow-hidden rounded-2xl border border-line bg-surface">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className={`${bar} h-10 w-10`} />
            <div className="flex-1 space-y-2">
              <div className={`${bar} h-3.5 w-2/5`} />
              <div className={`${bar} h-3 w-3/5`} />
            </div>
            <div className={`${bar} h-4 w-16`} />
          </div>
        ))}
      </div>
    </div>
  );
}
