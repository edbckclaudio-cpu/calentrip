"use client";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { getTrips, removeTrip } from "@/lib/trips-store";
import { Button } from "@/components/ui/button";
import { useSession, signIn, signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import Image from "next/image";
import { useToast } from "@/components/ui/toast";

export default function Header() {
  const { lang, setLang, t } = useI18n();
  const { show } = useToast();
  const [now, setNow] = useState("");

  function onLangChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as "pt" | "en" | "es";
    setLang(v);
    try {
      localStorage.setItem("calentrip:lang", v);
    } catch {}
    show("Idioma alterado");
  }

  useEffect(() => {
    function update() {
      const d = new Date();
      const loc = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
      const date = new Intl.DateTimeFormat(loc, { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
      const time = new Intl.DateTimeFormat(loc, { hour: "2-digit", minute: "2-digit" }).format(d);
      setNow(`${date} ${time}`);
    }
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [lang]);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-[var(--border)] shadow-sm">
      <div className="container-page flex h-14 items-center gap-3">
        <Link href="/flights/search" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="CalenTrip" width={24} height={24} className="h-6 w-6" />
          <span className="text-sm font-semibold text-[var(--brand)]">{t("appName")}</span>
        </Link>
        <div className="ml-2 w-24">
          <Select aria-label="Idioma" value={lang} onChange={onLangChange}>
            <option value="pt">Por</option>
            <option value="en">Ing</option>
            <option value="es">Esp</option>
          </Select>
        </div>
        <nav className="ml-4 hidden items-center gap-4 sm:flex">
          <TripsMenu t={t} />
        </nav>
        <div className="flex-1 flex justify-center">
          <div className="text-sm text-blue-600 sm:text-zinc-700 dark:text-zinc-300">{now}</div>
        </div>
        
      </div>
    </header>
  );
}

function TripsMenu({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<string>("init");
  const session = useSession();
  const { show } = useToast();

  const list = items === "init" ? [] : (JSON.parse(items) as ReturnType<typeof getTrips>);

  function refresh() {
    const data = getTrips();
    setItems(JSON.stringify(data));
  }

  return (
    <>
      <button type="button" className="text-sm text-white/90 hover:underline" onClick={() => { refresh(); setOpen(true); }}>
        {t("yourTrips")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>{session.status === "authenticated" ? t("savedTrips") : t("signInToViewTrips")}</DialogHeader>
        {session.status === "authenticated" ? (
          <ul className="space-y-2">
            {list.length === 0 && <li className="text-sm text-zinc-600 dark:text-zinc-300">{t("noTrips")}</li>}
            {list.map((trip) => (
              <li key={trip.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">{trip.title}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{trip.date} • {trip.passengers} pax</div>
                </div>
                <Button type="button" variant="outline" onClick={() => { removeTrip(trip.id); refresh(); }}>
                  {t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3">
            <Button type="button" onClick={() => { show("Abrindo login Google..."); signIn("google"); }}>{t("signInGoogle")}</Button>
            <Button type="button" onClick={() => { show("Iniciando login..."); signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/flights/search" }); }}>
              {t("signInCredentials")}
            </Button>
          </div>
        )}
        <DialogFooter>
          {session.status === "authenticated" ? (
            <Button type="button" variant="outline" onClick={() => signOut()}>{t("signOut")}</Button>
          ) : (
            <Button type="button" onClick={() => setOpen(false)}>{t("close")}</Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}

 
