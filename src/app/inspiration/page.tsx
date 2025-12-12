"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";

type EventItem = { type: "flight" | "activity" | "restaurant" | "transport" | "stay"; label: string; date: string; time?: string; meta?: unknown };

function italyEvents(): EventItem[] {
  const stay = (kind: "checkin" | "checkout", city: string, date: string, time: string, address: string): EventItem => ({ type: "stay", label: `${kind === "checkin" ? "Check-in hospedagem" : "Checkout hospedagem"}: ${city} • Endereço: ${address}`, date, time, meta: { city, address, kind } });
  const transport = (mode: "TRAIN" | "CAR" | "BUS" | "AIR", dep: string, arr: string, date: string, time: string): EventItem => ({ type: "transport", label: `Transporte: ${dep} → ${arr} • ${mode}`, date, time, meta: { mode: mode.toLowerCase(), dep, arr, depTime: time } });
  const activity = (date: string, time: string, title: string): EventItem => ({ type: "activity", label: `Atividade: ${title}`, date, time });
  const restaurant = (date: string, time: string, title: string): EventItem => ({ type: "restaurant", label: `Restaurante: ${title}`, date, time });
  const list: EventItem[] = [];
  list.push({ type: "flight", label: "Voo de ida: GRU → FCO", date: "2026-04-06" });
  list.push({ type: "flight", label: "Voo de volta: MXP → GRU", date: "2026-04-26" });
  list.push(stay("checkin", "Roma", "2026-04-06", "14:00", "Piazza Trinità Dei Monti 16, Spagna, 00187 Roma, Itália"));
  list.push(stay("checkout", "Roma", "2026-04-11", "08:00", "Piazza Trinità Dei Monti 16, Spagna, 00187 Roma, Itália"));
  list.push(stay("checkin", "Firenze", "2026-04-11", "17:00", "Via Dei Tavolini 8, Uffizi, 50122 Florença, Itália"));
  list.push(stay("checkout", "Firenze", "2026-04-18", "08:00", "Via Dei Tavolini 8, Uffizi, 50122 Florença, Itália"));
  list.push(stay("checkin", "Venezia", "2026-04-18", "17:00", "Lista di Spagna 116/A, Cannaregio, 30121 Veneza, Itália"));
  list.push(stay("checkout", "Venezia", "2026-04-20", "08:00", "Lista di Spagna 116/A, Cannaregio, 30121 Veneza, Itália"));
  list.push(stay("checkin", "Milan", "2026-04-20", "17:00", "Corso Europa 9, Centro de Milão, 20122 Milão, Itália"));
  list.push(stay("checkout", "Milan", "2026-04-26", "08:00", "Corso Europa 9, Centro de Milão, 20122 Milão, Itália"));
  list.push(transport("TRAIN", "Roma", "Firenze", "2026-04-11", "10:55"));
  list.push(transport("TRAIN", "Firenze", "Venezia", "2026-04-18", "10:39"));
  list.push(transport("TRAIN", "Venezia", "Milan", "2026-04-20", "10:48"));
  list.push(activity("2026-04-08", "08:30", "Biglietto/Ticket: Col-For-Pal Pren.Intero+audioguida Colosseo"));
  list.push(activity("2026-04-08", "11:00", "Fontana di Trevi"));
  list.push(restaurant("2026-04-08", "12:00", "Baccano"));
  list.push(activity("2026-04-08", "15:00", "Panteão"));
  list.push(activity("2026-04-08", "16:30", "Campo das Flores"));
  list.push(activity("2026-04-09", "09:00", "Piazza Navona, 00186 Roma RM, Itália"));
  list.push(activity("2026-04-09", "10:00", "Igreja de São Luís dos Franceses"));
  list.push(activity("2026-04-09", "10:40", "Piazza di Spagna, 00187 Roma RM, Itália"));
  list.push(activity("2026-04-09", "11:10", "Piazza del Popolo, Roma RM, Itália"));
  list.push(restaurant("2026-04-09", "12:00", "Pastasciutta"));
  list.push(activity("2026-04-09", "14:00", "Galleria Borghese"));
  list.push(activity("2026-04-10", "09:00", "Vatican Museums and Sistine Chapel"));
  list.push(activity("2026-04-11", "16:00", "Piazza del Duomo, 50122 Firenze FI, Itália"));
  list.push(restaurant("2026-04-11", "20:00", "Il Grande Nuti Trattoria"));
  list.push(activity("2026-04-12", "07:30", "Piazza del Duomo, 50122 Firenze FI, Itália"));
  list.push(activity("2026-04-12", "08:00", "Brunelleschi's dome, Piazza del Duomo, 50122 Firenze FI, Itália"));
  list.push(activity("2026-04-12", "10:30", "Galeria da Academia de Belas Artes de Florença"));
  list.push(restaurant("2026-04-12", "12:00", "All'Antico Vinaio"));
  list.push(activity("2026-04-12", "14:00", "Ponte Vecchio, 50125 Firenze FI, Itália"));
  list.push(activity("2026-04-12", "16:00", "Piazzale Michelangelo, 50125 Firenze FI, Itália"));
  list.push(activity("2026-04-13", "09:00", "Jardins de Boboli, 50125 Firenze FI, Itália"));
  list.push(activity("2026-04-13", "11:00", "Galleria degli Uffizi"));
  list.push(restaurant("2026-04-13", "12:00", "Osteria Filetto d'Oro"));
  list.push(activity("2026-04-13", "14:00", "Palazzo Vecchio, P.za della Signoria, 50122 Firenze FI, Itália"));
  list.push(activity("2026-04-13", "16:00", "Basílica de Santa Cruz, Piazza di Santa Croce, 16, 50122 Firenze FI, Itália"));
  list.push(activity("2026-04-14", "07:00", "Pisa - Luca by rent car"));
  list.push(activity("2026-04-15", "07:00", "San Gimignano"));
  list.push(activity("2026-04-16", "07:00", "Cinque Terre, Spezia, Itália"));
  list.push(activity("2026-04-17", "10:00", "Mercato Centrale Florence"));
  list.push(activity("2026-04-18", "16:00", "Piazza San Marco"));
  list.push(activity("2026-04-19", "08:00", "Praça de São Marcos, P.za San Marco, 30100 Venezia VE, Itália"));
  list.push(activity("2026-04-19", "08:10", "Palácio Ducal, P.za San Marco, 1, 30124 Venezia VE, Itália"));
  list.push(activity("2026-04-19", "08:30", "Campanário de São Marcos, P.za San Marco, 30124 Venezia VE, Itália"));
  list.push(activity("2026-04-19", "09:30", "Ponte de Rialto, 30125 Venezia VE, Itália"));
  list.push(activity("2026-04-19", "10:30", "Gallerie dell'Accademia"));
  list.push(activity("2026-04-19", "11:10", "Basílica de Santa Maria della Salute"));
  list.push(activity("2026-04-19", "13:00", "Murano Burano"));
  list.push(activity("2026-04-21", "08:00", "P.za del Duomo, Milano MI, Itália"));
  list.push(activity("2026-04-21", "11:00", "Galeria Vittorio Emanuele II, 20123 Milano MI, Itália"));
  list.push(activity("2026-04-21", "11:30", "Teatro alla Scala"));
  list.push(activity("2026-04-22", "09:00", "Castello Sforzesco"));
  list.push(activity("2026-04-22", "13:00", "Santa Maria delle Grazie, Via Giuseppe Antonio Sassi, 3, 20123 Milano MI, Itália"));
  return list;
}

function brazilEvents(): EventItem[] {
  const stay = (kind: "checkin" | "checkout", city: string, date: string, time: string, address: string): EventItem => ({ type: "stay", label: `${kind === "checkin" ? "Check-in hospedagem" : "Checkout hospedagem"}: ${city} • Endereço: ${address}`, date, time, meta: { city, address, kind } });
  const transport = (mode: "AIR" | "BUS" | "CAR", dep: string, arr: string, date: string, time: string): EventItem => ({ type: "transport", label: `Transporte: ${dep} → ${arr} • ${mode}`, date, time, meta: { mode: mode.toLowerCase(), dep, arr, depTime: time } });
  const activity = (date: string, time: string, title: string): EventItem => ({ type: "activity", label: `Atividade: ${title}`, date, time });
  const restaurant = (date: string, time: string, title: string): EventItem => ({ type: "restaurant", label: `Restaurante: ${title}`, date, time });
  const list: EventItem[] = [];
  list.push({ type: "flight", label: "Voo de ida: GRU → GIG", date: "2026-05-06" });
  list.push(stay("checkin", "Rio de Janeiro", "2026-05-06", "14:00", "Av. Atlântica, Copacabana, Rio de Janeiro, Brasil"));
  list.push(activity("2026-05-07", "09:00", "Cristo Redentor"));
  list.push(activity("2026-05-07", "15:00", "Pão de Açúcar"));
  list.push(restaurant("2026-05-07", "19:30", "Marius Degustare"));
  list.push(activity("2026-05-08", "10:00", "Passeio por Santa Teresa"));
  list.push(activity("2026-05-09", "09:00", "Praia de Copacabana"));
  list.push(activity("2026-05-10", "10:00", "Museu do Amanhã"));
  list.push(stay("checkout", "Rio de Janeiro", "2026-05-12", "08:00", "Av. Atlântica, Copacabana, Rio de Janeiro, Brasil"));
  list.push(transport("AIR", "Rio de Janeiro", "São Paulo", "2026-05-12", "11:30"));
  list.push(stay("checkin", "São Paulo", "2026-05-12", "14:00", "Av. Paulista, Bela Vista, São Paulo, Brasil"));
  list.push(activity("2026-05-13", "10:00", "MASP — Museu de Arte de São Paulo"));
  list.push(activity("2026-05-13", "15:00", "Parque do Ibirapuera"));
  list.push(restaurant("2026-05-13", "20:00", "Mercado Municipal — sanduíche de mortadela"));
  list.push(activity("2026-05-14", "09:30", "Centro histórico e Catedral da Sé"));
  list.push(stay("checkout", "São Paulo", "2026-05-20", "08:00", "Av. Paulista, Bela Vista, São Paulo, Brasil"));
  list.push({ type: "flight", label: "Voo de volta: CGH → GRU", date: "2026-05-20" });
  return list;
}

function croatiaEvents(): EventItem[] {
  const stay = (kind: "checkin" | "checkout", city: string, date: string, time: string, address: string): EventItem => ({ type: "stay", label: `${kind === "checkin" ? "Check-in hospedagem" : "Checkout hospedagem"}: ${city} • Endereço: ${address}`, date, time, meta: { city, address, kind } });
  const transport = (mode: "BUS" | "CAR" | "AIR", dep: string, arr: string, date: string, time: string): EventItem => ({ type: "transport", label: `Transporte: ${dep} → ${arr} • ${mode}`, date, time, meta: { mode: mode.toLowerCase(), dep, arr, depTime: time } });
  const activity = (date: string, time: string, title: string): EventItem => ({ type: "activity", label: `Atividade: ${title}`, date, time });
  const restaurant = (date: string, time: string, title: string): EventItem => ({ type: "restaurant", label: `Restaurante: ${title}`, date, time });
  const list: EventItem[] = [];
  list.push({ type: "flight", label: "Voo de ida: GRU → ZAG (Zagreb)", date: "2026-06-06" });
  list.push(stay("checkin", "Zagreb", "2026-06-06", "14:00", "Trg bana Jelačića, Zagreb, Croácia"));
  list.push(activity("2026-06-07", "10:00", "Praça Ban Jelačić e Mercado Dolac"));
  list.push(activity("2026-06-07", "14:30", "Cidade Alta (Gradec) e Torre Lotrščak"));
  list.push(restaurant("2026-06-07", "19:30", "Restaurante tradicional croata em Tkalčićeva"));
  list.push(activity("2026-06-08", "10:00", "Catedral de Zagreb e Parque Maksimir"));
  list.push(stay("checkout", "Zagreb", "2026-06-10", "08:00", "Trg bana Jelačića, Zagreb, Croácia"));
  list.push(transport("BUS", "Zagreb", "Split", "2026-06-10", "11:00"));
  list.push(stay("checkin", "Split", "2026-06-10", "17:00", "Kralja Zvonimira, Split, Croácia"));
  list.push(activity("2026-06-11", "10:00", "Palácio de Diocleciano"));
  list.push(activity("2026-06-12", "09:30", "Marjan Hill"));
  list.push(activity("2026-06-13", "08:00", "Passeio à Blue Cave"));
  list.push(restaurant("2026-06-13", "19:30", "Konoba Fetivi"));
  list.push(activity("2026-06-14", "10:00", "Praias de Bačvice e Kasjuni"));
  list.push(stay("checkout", "Split", "2026-06-14", "08:00", "Kralja Zvonimira, Split, Croácia"));
  list.push(transport("BUS", "Split", "Dubrovnik", "2026-06-14", "11:00"));
  list.push(stay("checkin", "Dubrovnik", "2026-06-14", "17:00", "Ulica od Puča, Dubrovnik, Croácia"));
  list.push(activity("2026-06-15", "09:00", "Cidade Antiga de Dubrovnik"));
  list.push(activity("2026-06-16", "15:00", "Passeio pelas muralhas de Dubrovnik"));
  list.push(activity("2026-06-17", "10:00", "Ilha de Lokrum"));
  list.push(restaurant("2026-06-17", "20:00", "Restaurant Dubrovnik"));
  list.push(activity("2026-06-18", "09:30", "Teleférico de Dubrovnik"));
  list.push(stay("checkout", "Dubrovnik", "2026-06-20", "08:00", "Ulica od Puča, Dubrovnik, Croácia"));
  list.push({ type: "flight", label: "Voo de volta: DBV (Dubrovnik) → GRU", date: "2026-06-20" });
  return list;
}

export default function InspirationPage() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"Itália" | "Brasil" | "Croácia" | null>(null);
  function saveAndOpen(target: "final" | "month") {
    try {
      const events = selected === "Brasil" ? brazilEvents() : selected === "Croácia" ? croatiaEvents() : italyEvents();
      const name = selected === "Brasil" ? "BRASIL-2026" : selected === "Croácia" ? "CROACIA-2026" : "ITALIA-2026";
      const payload = { name, events };
      if (typeof window !== "undefined") {
        localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
        localStorage.setItem("calentrip:auto_load_saved", "1");
        localStorage.setItem("calentrip:inspiration_mode", "1");
        try {
          const raw = localStorage.getItem("calentrip:saved_calendars_list");
          const list = raw ? JSON.parse(raw) as Array<{ name: string; events: EventItem[]; savedAt?: string }> : [];
          const at = new Date().toISOString();
          const exists = list.find((x) => x.name === name);
          const next = exists ? list.map((x) => (x.name === name ? { name: x.name, events, savedAt: at } : x)) : [...list, { name, events, savedAt: at }];
          localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(next));
        } catch {}
      }
      try { window.location.href = target === "final" ? "/calendar/final" : "/calendar/month"; } catch {}
    } catch {}
  }
  return (
    <div className="min-h-screen pl-14 pr-4 py-6 space-y-6">
      <div className="container-page">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--brand)]">Viagens inspiradoras</h1>
        <div className="text-sm text-zinc-700">Escolha uma inspiração e veja o roteiro completo para adaptar ao seu gosto.</div>
      </div>
      <div className="container-page">
        <Carousel />
      </div>
    </div>
  );
}

function Carousel() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"Itália" | "Brasil" | "Croácia" | null>(null);
  const items = [
    { name: "Itália" },
    { name: "Brasil" },
    { name: "Croácia" },
  ] as const;
  const heroPrimary = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200&q=80&auto=format&fit=crop&fm=jpg&cs=tinysrgb"; // paisagem montanhosa com céu
  const heroFallback = "https://upload.wikimedia.org/wikipedia/commons/1/18/Sunrise_in_the_mountains.jpg";
  const [index, setIndex] = useState(0);
  function next() { setIndex((i) => (i + 1) % items.length); }
  function prev() { setIndex((i) => (i - 1 + items.length) % items.length); }
  function saveToLocal(target: "final" | "month") {
    try {
      const events = selected === "Brasil" ? brazilEvents() : selected === "Croácia" ? croatiaEvents() : italyEvents();
      const name = selected === "Brasil" ? "BRASIL-2026" : selected === "Croácia" ? "CROACIA-2026" : "ITALIA-2026";
      const payload = { name, events };
      if (typeof window !== "undefined") {
        localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
        localStorage.setItem("calentrip:auto_load_saved", "1");
        localStorage.setItem("calentrip:inspiration_mode", "1");
        try {
          const raw = localStorage.getItem("calentrip:saved_calendars_list");
          const list = raw ? JSON.parse(raw) as Array<{ name: string; events: EventItem[]; savedAt?: string }> : [];
          const at = new Date().toISOString();
          const exists = list.find((x) => x.name === name);
          const next = exists ? list.map((x) => (x.name === name ? { name: x.name, events, savedAt: at } : x)) : [...list, { name, events, savedAt: at }];
          localStorage.setItem("calentrip:saved_calendars_list", JSON.stringify(next));
        } catch {}
      }
      try { window.location.href = target === "final" ? "/calendar/final" : "/calendar/month"; } catch {}
    } catch {}
  }
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <Card
          name={items[index].name}
          src={heroPrimary}
          fallback={heroFallback}
          onClick={() => { setSelected(items[index].name as typeof selected); setOpen(true); }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 h-9" onClick={prev}>
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span>Anterior</span>
        </button>
        <div className="flex items-center gap-1">
          {items.map((_, i) => (
            <button key={i} type="button" className={i === index ? "h-2 w-2 rounded-full bg-[var(--brand)]" : "h-2 w-2 rounded-full bg-zinc-300"} onClick={() => setIndex(i)} aria-label={`Ir para ${i + 1}`} />
          ))}
        </div>
        <button type="button" className="inline-flex items-center gap-1 rounded-md border px-3 h-9" onClick={next}>
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          <span>Próximo</span>
        </button>
      </div>
      <Dialog open={open} onOpenChange={setOpen} placement="bottom">
        <DialogHeader>{selected ? `${selected} — roteiro exemplo para inspirar` : "Roteiro exemplo"}</DialogHeader>
        <div className="space-y-2 text-sm">
          <div>
            Este roteiro é um exemplo real para você se inspirar, adaptar ao seu estilo e construir a sua viagem. As durações e deslocamentos consideram tempos reais.
          </div>
          <div>
            {selected === "Itália" ? (
              <>Resumo: avião para Roma, trem Roma → Firenze, carro para Pisa • San Gimignano • Cinque Terre, trem Firenze → Veneza, trem Veneza → Milão e avião de volta de Milão.</>
            ) : selected === "Brasil" ? (
              <>Resumo: avião para Rio de Janeiro, voo Rio → São Paulo, atividades em SP e voo de volta.</>
            ) : selected === "Croácia" ? (
              <>Resumo: avião para Zagreb, ônibus Zagreb → Split → Dubrovnik, atividades e voo de volta a partir de Dubrovnik.</>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => { setOpen(false); saveToLocal("final"); }}>Visualizar em lista</Button>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); saveToLocal("month"); }}>Visualizar em calendário</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function Card({ name, src, fallback, onClick }: { name: string; src: string; fallback?: string; onClick?: () => void }) {
  const [imgSrc, setImgSrc] = useState(src);
  return (
    <button type="button" className="relative w-full h-44 md:h-56" onClick={onClick}>
      <Image
        src={imgSrc}
        alt={name}
        fill
        sizes="(max-width: 768px) 100vw, 720px"
        priority={false}
        quality={70}
        className="object-cover"
        onError={() => setImgSrc(fallback || `https://via.placeholder.com/720x320?text=${name}`)}
      />
      <span className="material-symbols-outlined absolute top-2 right-2 text-white/80 text-[22px]">flight</span>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute bottom-2 left-3 right-3 text-white font-semibold text-lg">{name}</div>
    </button>
  );
}
