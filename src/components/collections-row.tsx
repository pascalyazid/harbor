import { Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tmdbCollection } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { Row } from "./row";

type Col = { id: number; name: string };

const COLLECTIONS: Col[] = [
  { id: 10, name: "Star Wars" },
  { id: 1241, name: "Harry Potter" },
  { id: 119, name: "The Lord of the Rings" },
  { id: 121938, name: "The Hobbit" },
  { id: 263, name: "The Dark Knight Trilogy" },
  { id: 328, name: "Jurassic Park" },
  { id: 87096, name: "Avatar" },
  { id: 9485, name: "The Fast and the Furious" },
  { id: 87359, name: "Mission: Impossible" },
  { id: 645, name: "James Bond 007" },
  { id: 295, name: "Pirates of the Caribbean" },
  { id: 2344, name: "The Matrix" },
  { id: 404609, name: "John Wick" },
  { id: 84, name: "Indiana Jones" },
  { id: 8091, name: "Alien" },
  { id: 399, name: "Predator" },
  { id: 528, name: "The Terminator" },
  { id: 264, name: "Back to the Future" },
  { id: 131635, name: "The Hunger Games" },
  { id: 1575, name: "Rocky" },
  { id: 8945, name: "Mad Max" },
  { id: 1570, name: "Die Hard" },
  { id: 86311, name: "The Avengers" },
  { id: 284433, name: "Guardians of the Galaxy" },
  { id: 448150, name: "Deadpool" },
  { id: 556, name: "Spider-Man" },
  { id: 748, name: "X-Men" },
  { id: 8650, name: "Transformers" },
  { id: 726871, name: "Dune" },
  { id: 173710, name: "Planet of the Apes" },
  { id: 31562, name: "The Bourne Series" },
  { id: 134004, name: "Taken" },
  { id: 126125, name: "The Expendables" },
  { id: 2883, name: "Kill Bill" },
  { id: 2980, name: "Ghostbusters" },
  { id: 86055, name: "Men in Black" },
  { id: 304, name: "Ocean's" },
  { id: 138101, name: "Sherlock Holmes" },
  { id: 230, name: "The Godfather" },
  { id: 8675, name: "The Mummy" },
  { id: 313086, name: "The Conjuring Universe" },
  { id: 91361, name: "Halloween" },
  { id: 656, name: "Saw" },
  { id: 2602, name: "Scream" },
  { id: 8581, name: "A Nightmare on Elm Street" },
  { id: 17255, name: "Resident Evil" },
  { id: 720879, name: "Sonic the Hedgehog" },
  { id: 10194, name: "Toy Story" },
  { id: 468222, name: "The Incredibles" },
  { id: 137697, name: "Finding Nemo" },
  { id: 137696, name: "Monsters, Inc." },
  { id: 87800, name: "Cars" },
  { id: 386382, name: "Frozen" },
  { id: 2150, name: "Shrek" },
  { id: 14890, name: "Madagascar" },
  { id: 89137, name: "How to Train Your Dragon" },
  { id: 77816, name: "Kung Fu Panda" },
  { id: 86066, name: "Despicable Me" },
  { id: 8354, name: "Ice Age" },
  { id: 420, name: "The Chronicles of Narnia" },
];

export function CollectionsRow() {
  const { settings } = useSettings();
  if (!settings.tmdbKey) return null;
  return (
    <Row title="Collections" min={320} shape="landscape" arrowsAlways scrollKey="home:collections">
      {COLLECTIONS.map((c) => (
        <CollectionCard key={c.id} col={c} />
      ))}
    </Row>
  );
}

function CollectionCard({ col }: { col: Col }) {
  const { settings } = useSettings();
  const { openCollection } = useView();
  const ref = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);
  const [backdrop, setBackdrop] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    tmdbCollection(settings.tmdbKey, col.id)
      .then((c) => {
        if (cancelled || !c) return;
        setBackdrop(c.backdrop ?? null);
        setCount(c.parts.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [inView, col.id, settings.tmdbKey]);

  const hue = (col.id * 47) % 360;
  const from = `oklch(0.42 0.13 ${hue})`;
  const to = `oklch(0.15 0.06 ${hue})`;

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => openCollection(col.id)}
      className="group/card relative aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft text-left shadow-[0_4px_18px_-10px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/0 transition-[border-color] duration-300 hover:border-edge hover:ring-white/15"
      style={{ background: `linear-gradient(140deg, ${from}, ${to})` }}
    >
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 data-[on=true]:opacity-100"
          onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-black/15 transition-colors duration-300 group-hover/card:bg-black/0" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />
      <span className="absolute left-3.5 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
        <Layers size={11} strokeWidth={2.4} />
        {count != null ? `${count} films` : "Collection"}
      </span>
      <h3 className="absolute inset-x-4 bottom-3.5 font-display text-[21px] font-medium leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
        {col.name}
      </h3>
    </button>
  );
}
