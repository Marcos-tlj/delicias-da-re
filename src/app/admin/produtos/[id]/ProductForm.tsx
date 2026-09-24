"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, OptionGroup, Product, Unit } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import ProductThumb from "@/components/ProductThumb";
import { deleteProduct, saveProduct } from "../../actions";

const input = "w-full rounded-2xl border border-cream-dark bg-white px-4 py-3 outline-none focus:border-cocoa";

/** Reduz a foto no celular antes de enviar (máx. 1200px, WebP) — site mais leve. */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao comprimir"))), "image/webp", 0.82),
  );
}

type GroupDraft = { name: string; type: "single" | "multi"; required: boolean; choicesText: string };

export default function ProductForm({ product }: { product: Product | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "bolos");
  const [price, setPrice] = useState(product ? String(product.price).replace(".", ",") : "");
  const [unit, setUnit] = useState<Unit>(product?.unit ?? "un");
  const [minQty, setMinQty] = useState(String(product?.min_quantity ?? 1));
  const [step, setStep] = useState(String(product?.quantity_step ?? 1));
  const [priceIsFrom, setPriceIsFrom] = useState(product?.price_is_from ?? false);
  const [available, setAvailable] = useState(product?.is_available ?? true);
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? 0));
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [groups, setGroups] = useState<GroupDraft[]>(
    (product?.options ?? []).map((g) => ({ ...g, choicesText: g.choices.join(", ") })),
  );

  const num = (v: string) => Number(String(v).replace(",", "."));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const blob = await compressImage(file);
      const supabase = createClient();
      const path = `${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
      if (error) throw error;
      setImageUrl(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
    } catch {
      setError("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  const updateGroup = (idx: number, patch: Partial<GroupDraft>) =>
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, ...patch } : g)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const options: OptionGroup[] = groups.map((g) => ({
      name: g.name,
      type: g.type,
      required: g.required,
      choices: g.choicesText.split(",").map((c) => c.trim()).filter(Boolean),
    }));
    startTransition(async () => {
      const res = await saveProduct({
        id: product?.id,
        name,
        description,
        category,
        price: num(price),
        unit,
        min_quantity: num(minQty),
        quantity_step: num(step),
        price_is_from: priceIsFrom,
        is_available: available,
        sort_order: Number(sortOrder) || 0,
        image_url: imageUrl,
        options,
      });
      if (res.error) setError(res.error);
      else {
        router.push("/admin/produtos");
        router.refresh();
      }
    });
  };

  const remove = () => {
    if (!product || !window.confirm(`Excluir "${product.name}"? Para só esconder do cardápio, use "pausar".`)) return;
    startTransition(async () => {
      const res = await deleteProduct(product.id);
      if (res.error) setError(res.error);
      else {
        router.push("/admin/produtos");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-4 pb-32">
      <div className="flex items-center justify-between">
        <Link href="/admin/produtos" className="text-sm font-semibold text-cocoa-light">
          ‹ Voltar
        </Link>
        <h1 className="font-display text-lg font-semibold">{product ? "Editar produto" : "Novo produto"}</h1>
        <span className="w-12" />
      </div>

      <label className="block">
        <ProductThumb src={imageUrl} alt="Foto do produto" category={category} className="h-44 w-full" />
        <span className="mt-2 block rounded-2xl border border-dashed border-cocoa-light py-3 text-center text-sm font-bold">
          {uploading ? "Enviando foto…" : imageUrl ? "Trocar foto" : "📷 Adicionar foto"}
        </span>
        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
      </label>

      <label className="block">
        <span className="text-sm font-bold">Nome</span>
        <input className={`${input} mt-1`} required value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="block">
        <span className="text-sm font-bold">Descrição</span>
        <textarea className={`${input} mt-1`} rows={2} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-bold">Categoria</span>
          <select className={`${input} mt-1`} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-bold">Vendido por</span>
          <select
            className={`${input} mt-1`}
            value={unit}
            onChange={(e) => {
              const u = e.target.value as Unit;
              setUnit(u);
              if (u === "kg") {
                setMinQty("1");
                setStep("0,5");
              } else {
                setMinQty("1");
                setStep("1");
              }
            }}
          >
            <option value="un">Unidade</option>
            <option value="kg">Quilo (kg)</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-1 block">
          <span className="text-sm font-bold">Preço {unit === "kg" ? "/kg" : ""}</span>
          <input className={`${input} mt-1`} required inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Mínimo</span>
          <input className={`${input} mt-1`} inputMode="decimal" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-bold">De quanto em quanto</span>
          <input className={`${input} mt-1`} inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2 rounded-3xl bg-white p-4">
        <label className="flex items-center justify-between">
          <span className="font-bold">Disponível no cardápio</span>
          <input type="checkbox" className="h-6 w-6 accent-emerald-600" checked={available} onChange={(e) => setAvailable(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between">
          <span className="font-bold">Mostrar “a partir de”</span>
          <input type="checkbox" className="h-6 w-6 accent-berry" checked={priceIsFrom} onChange={(e) => setPriceIsFrom(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between">
          <span className="font-bold">Ordem no cardápio</span>
          <input className="w-20 rounded-xl border border-cream-dark px-2 py-1 text-right" inputMode="numeric" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>

      {/* Opções (massa, recheio, cobertura…) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Opções de escolha</h2>
          <button
            type="button"
            onClick={() => setGroups((g) => [...g, { name: "", type: "single", required: true, choicesText: "" }])}
            className="rounded-full bg-cocoa px-3 py-1.5 text-sm font-bold text-cream"
          >
            + Grupo
          </button>
        </div>
        {groups.length === 0 && <p className="text-sm text-cocoa-light">Ex.: Massa, Recheio, Cobertura. Deixe vazio se não houver escolhas.</p>}
        {groups.map((g, idx) => (
          <div key={idx} className="space-y-2 rounded-3xl bg-white p-4">
            <div className="flex gap-2">
              <input className={input} placeholder="Nome do grupo (ex.: Recheio)" value={g.name} onChange={(e) => updateGroup(idx, { name: e.target.value })} />
              <button
                type="button"
                onClick={() => setGroups((gs) => gs.filter((_, i) => i !== idx))}
                className="shrink-0 rounded-2xl px-3 text-berry"
                aria-label="Remover grupo"
              >
                ✕
              </button>
            </div>
            <textarea
              className={input}
              rows={2}
              placeholder="Opções separadas por vírgula: Brigadeiro, Beijinho, Ninho"
              value={g.choicesText}
              onChange={(e) => updateGroup(idx, { choicesText: e.target.value })}
            />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-5 w-5 accent-cocoa" checked={g.required} onChange={(e) => updateGroup(idx, { required: e.target.checked })} />
                Obrigatório
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-cocoa"
                  checked={g.type === "multi"}
                  onChange={(e) => updateGroup(idx, { type: e.target.checked ? "multi" : "single" })}
                />
                Pode escolher vários
              </label>
            </div>
          </div>
        ))}
      </section>

      {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {product && (
        <button type="button" onClick={remove} className="w-full py-2 text-sm font-bold text-berry">
          Excluir produto
        </button>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-cream-dark bg-white px-4 pt-3">
        <button disabled={pending || uploading} className="mx-auto block w-full max-w-md rounded-2xl bg-berry py-4 font-bold text-white disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
