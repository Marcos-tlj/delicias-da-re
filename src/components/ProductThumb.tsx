import type { Category } from "@/lib/types";

const EMOJI: Record<Category, string> = { bolos: "🎂", doces: "🍬", tortas: "🥧" };

export default function ProductThumb({
  src,
  alt,
  category,
  className = "h-24 w-24",
}: {
  src: string | null;
  alt: string;
  category: Category;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading="lazy" className={`${className} shrink-0 rounded-2xl object-cover`} />;
  }
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-2xl bg-cream-dark text-4xl`} aria-hidden>
      {EMOJI[category]}
    </div>
  );
}
