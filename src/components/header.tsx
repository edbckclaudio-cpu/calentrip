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
  const [openNav, setOpenNav] = useState(false);

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
        <button type="button" aria-label="Menu" className="inline-flex h-8 w-8 items-center justify-center" onClick={() => setOpenNav(true)}>
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
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
      <NavDrawer t={t} open={openNav} onOpenChange={setOpenNav} />
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

function NavDrawer({ t, open, onOpenChange }: { t: (k: string) => string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: session, status } = useSession();
  const { lang } = useI18n();
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTrips, setSavedTrips] = useState<ReturnType<typeof getTrips>>([]);

  function openSaved() {
    try { setSavedTrips(getTrips()); } catch { setSavedTrips([] as any); }
    setSavedOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} placement="left">
        <DialogHeader>{t("menu")}</DialogHeader>
        <div className="space-y-2">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {status === "authenticated" ? (
              <div className="flex items-center gap-2">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="avatar" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">{(session?.user?.name || session?.user?.email || "PF").slice(0, 2).toUpperCase()}</span>
                )}
                <div className="flex-1">
                  <div className="text-sm font-semibold">{session?.user?.name || "Usuário"}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">{session?.user?.email || ""}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="underline text-xs" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>Ver perfil</button>
                    <button type="button" className="text-xs" onClick={() => signOut()}>Sair</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs">PF</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Entrar</div>
                  <div className="mt-1 text-[10px] text-zinc-500">Idioma: {lang.toUpperCase()}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" className="text-xs" onClick={() => signIn("google")}>Google</button>
                    <button type="button" className="text-xs" onClick={() => signIn("credentials", { email: "demo@calentrip.com", password: "demo", callbackUrl: "/flights/search" })}>Demo</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={openSaved}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">lists</span>
            </span>
            <span className="text-sm font-medium">Pesquisas salvas</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">list_alt</span>
            </span>
            <span className="text-sm font-medium">Calendário em lista</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/month"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">calendar_month</span>
            </span>
            <span className="text-sm font-medium">Calendário mensal</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/flights/search"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">travel_explore</span>
            </span>
            <span className="text-sm font-medium">Iniciar nova pesquisa</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px]">account_circle</span>
            </span>
            <span className="text-sm font-medium">Perfil</span>
          </button>
        </div>
      </Dialog>

      <Dialog open={savedOpen} onOpenChange={setSavedOpen} placement="bottom">
        <DialogHeader>Pesquisas salvas</DialogHeader>
        <div className="p-4 md:p-6 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
          {savedTrips.length === 0 ? (
            <div className="text-zinc-600">Nenhuma viagem salva.</div>
          ) : (
            <ul className="space-y-2">
              {savedTrips.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded border p-2">
                  <div>
                    <div className="text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">{t.date} • {t.passengers} pax</div>
                  </div>
                  <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/flights/results"; } catch {} }}>Abrir</Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setSavedOpen(false)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  );
}
