"use client";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { useState } from "react";
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

  function onLangChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value as "pt" | "en" | "es";
    setLang(v);
    try {
      localStorage.setItem("calentrip:lang", v);
    } catch {}
    show("Idioma alterado");
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b border-[var(--border)] shadow-sm">
      <div className="container-page flex h-14 items-center gap-3">
        <Link href="/flights/search" className="flex items-center gap-2">
          <Image src="/icon-192.png" alt="CalenTrip" width={24} height={24} className="h-6 w-6" />
          <span className="text-sm font-semibold text-[var(--brand)]">{t("appName")}</span>
        </Link>
        <div className="ml-2 w-36">
          <Select aria-label="Idioma" value={lang} onChange={onLangChange}>
            <option value="pt">Português</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </Select>
        </div>
        <nav className="ml-4 hidden items-center gap-4 sm:flex">
          <TripsMenu t={t} />
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <MainMenu t={t} />
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

function MainMenu({ t }: { t: (k: string) => string }) {
  const [open, setOpen] = useState(false);
  const pathname = "/";

  return (
    <>
      <button type="button" aria-label="Menu" className="inline-flex h-8 w-8 items-center justify-center" onClick={() => setOpen(true)}>
        <span className="material-symbols-outlined text-[24px]">menu</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogHeader>{t("menu")}</DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/flights/search" className="flex items-center gap-2 rounded-md border border-[var(--border)] p-2">
            <span className="material-symbols-outlined">travel_explore</span>
            <span>{t("navExplore")}</span>
          </Link>
          <Link href="/flights/results" className="flex items-center gap-2 rounded-md border border-[var(--border)] p-2">
            <span className="material-symbols-outlined">flight</span>
            <span>{t("navTrips")}</span>
          </Link>
          <Link href="/accommodation/search" className="flex items-center gap-2 rounded-md border border-[var(--border)] p-2">
            <span className="material-symbols-outlined">hotel</span>
            <span>{t("navStays")}</span>
          </Link>
          <Link href="/profile" className="flex items-center gap-2 rounded-md border border-[var(--border)] p-2">
            <span className="material-symbols-outlined">account_circle</span>
            <span>{t("navProfile")}</span>
          </Link>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("close")}</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
