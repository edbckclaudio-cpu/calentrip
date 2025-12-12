"use client";
import { useState } from "react";
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

export default function InspirationPage() {
  const [open, setOpen] = useState(false);
  function saveAndOpen(target: "final" | "month") {
    try {
      const events = italyEvents();
      const payload = { name: "ITALIA-2026", events };
      if (typeof window !== "undefined") {
        localStorage.setItem("calentrip:saved_calendar", JSON.stringify(payload));
        localStorage.setItem("calentrip:auto_load_saved", "1");
        localStorage.setItem("calentrip:inspiration_mode", "1");
        try {
          const raw = localStorage.getItem("calentrip:saved_calendars_list");
          const list = raw ? JSON.parse(raw) as Array<{ name: string; events: EventItem[]; savedAt?: string }> : [];
          const at = new Date().toISOString();
          const exists = list.find((x) => x.name === "ITALIA-2026");
          const next = exists ? list.map((x) => (x.name === "ITALIA-2026" ? { name: x.name, events, savedAt: at } : x)) : [...list, { name: "ITALIA-2026", events, savedAt: at }];
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
        <div className="overflow-x-auto snap-x snap-mandatory flex gap-4 pb-2">
          {[
            { name: "Itália", img: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800&q=80" },
            { name: "Brasil", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80" },
            { name: "Croácia", img: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80" },
          ].map((c, i) => (
            <button key={i} type="button" className="snap-center min-w-[72%] md:min-w-[360px] h-44 rounded-xl overflow-hidden relative border border-[var(--border)]" onClick={() => { if (c.name === "Itália") setOpen(true); }}>
              <div className="absolute inset-0" style={{ backgroundImage: `url(${c.img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute bottom-2 left-3 right-3 text-white font-semibold text-lg">{c.name}</div>
            </button>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen} placement="bottom">
        <DialogHeader>Itália — roteiro exemplo para inspirar</DialogHeader>
        <div className="space-y-2 text-sm">
          <div>
            Este roteiro é um exemplo real para você se inspirar, adaptar ao seu estilo e construir a sua viagem. As durações e deslocamentos consideram tempos reais.
          </div>
          <div>
            Resumo: avião para Roma, trem Roma → Firenze, carro para Pisa • San Gimignano • Cinque Terre, trem Firenze → Veneza, trem Veneza → Milão e avião de volta de Milão.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveAndOpen("final")}>Visualizar em lista</Button>
            <Button type="button" variant="outline" onClick={() => saveAndOpen("month")}>Visualizar em calendário</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
