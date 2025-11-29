"use client";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { getTrips, removeTrip, addTrip, FlightNote } from "@/lib/trips-store";
import { Button } from "@/components/ui/button";
import { useSession, signIn, signOut } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import Image from "next/image";
import { useToast } from "@/components/ui/toast";
import { useTrip } from "@/lib/trip-context";
import { findAirportByIata } from "@/lib/airports";

export default function Header() {
  const { lang, setLang, t } = useI18n();
  const { show } = useToast();
  const [now, setNow] = useState("");
  const [openNav, setOpenNav] = useState(false);
  const { tripSearch, setTripSearch } = useTrip();

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
          <span className="material-symbols-outlined text-[24px] text-[var(--brand)]">menu</span>
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
          <div className="text-sm font-medium text-[var(--brand)]">{now}</div>
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [policyType, setPolicyType] = useState<null | "privacy" | "terms" | "cookies" | "eula" | "data" | "support" | "licenses">(null);
  const { tripSearch, setTripSearch } = useTrip();

  function openSaved() {
    try { setSavedTrips(getTrips()); } catch { setSavedTrips([]); }
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
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs" onClick={() => onOpenChange(true)}>PF</button>
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
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">lists</span>
            </span>
            <span className="text-sm font-medium">Pesquisas salvas</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/final"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">list_alt</span>
            </span>
            <span className="text-sm font-medium">Calendário em lista</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => { try { window.location.href = "/calendar/month"; } catch {} }}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">calendar_month</span>
            </span>
            <span className="text-sm font-medium">Calendário mensal</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={async () => {
              try {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("calentrip_trip_summary");
                  localStorage.removeItem("calentrip:entertainment:records");
                  localStorage.removeItem("calentrip:saved_calendar");
                  localStorage.removeItem("calentrip:tripSearch");
                  localStorage.removeItem("calentrip:trips");
                }
                setTripSearch(null);
              } catch {}
              try { window.location.href = "/flights/search"; } catch {}
            }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">travel_explore</span>
            </span>
            <span className="text-sm font-medium">Iniciar nova pesquisa</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-md px-3 h-10 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setProfileOpen(true)}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800">
              <span className="material-symbols-outlined text-[22px] text-[#007AFF]">account_circle</span>
            </span>
            <span className="text-sm font-medium">Perfil</span>
          </button>
          <div className="mt-2 rounded-md border border-zinc-200 dark:border-zinc-800">
            <div className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Termos e Políticas</div>
            <div className="px-2 pb-2 space-y-1">
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("privacy")}> 
                <span className="material-symbols-outlined text-[20px]">privacy_tip</span>
                <span className="text-sm">Política de Privacidade</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("terms")}> 
                <span className="material-symbols-outlined text-[20px]">gavel</span>
                <span className="text-sm">Termos de Serviço</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("cookies")}> 
                <span className="material-symbols-outlined text-[20px]">cookie</span>
                <span className="text-sm">Política de Cookies</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("eula")}> 
                <span className="material-symbols-outlined text-[20px]">description</span>
                <span className="text-sm">EULA / Licença de Uso</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("data")}> 
                <span className="material-symbols-outlined text-[20px]">delete_forever</span>
                <span className="text-sm">Exclusão de Conta e Dados</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("support")}> 
                <span className="material-symbols-outlined text-[20px]">support_agent</span>
                <span className="text-sm">Suporte</span>
              </button>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 h-9 hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => setPolicyType("licenses")}> 
                <span className="material-symbols-outlined text-[20px]">developer_board</span>
                <span className="text-sm">Licenças de Terceiros</span>
              </button>
            </div>
          </div>
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
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => { try { window.location.href = "/flights/results"; } catch {} }}>Abrir</Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        try { removeTrip(t.id); } catch {}
                        try { setSavedTrips(getTrips()); } catch { setSavedTrips([]); }
                      }}
                    >
                      Apagar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setSavedOpen(false)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen} placement="bottom">
        <DialogHeader>Perfil</DialogHeader>
        <div className="p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined">account_circle</span>
            <span>Acesse sua página de perfil</span>
          </div>
          <div>
            <button type="button" className="underline text-sm" onClick={() => { try { window.location.href = "/profile"; } catch {} }}>Abrir perfil</button>
          </div>
          <div className="mt-2 rounded-md border border-zinc-200 dark:border-zinc-800">
            <div className="px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">Termos e Políticas</div>
            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setPolicyType("privacy")}>Privacidade</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("terms")}>Termos</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("cookies")}>Cookies</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("eula")}>EULA</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("data")}>Exclusão de dados</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("support")}>Suporte</Button>
              <Button type="button" variant="outline" onClick={() => setPolicyType("licenses")}>Licenças</Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setProfileOpen(false)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>

      <Dialog open={policyType !== null} onOpenChange={(o) => { if (!o) setPolicyType(null); }} placement="center">
        <DialogHeader>
          {policyType === "privacy" && "Política de Privacidade"}
          {policyType === "terms" && "Termos de Serviço"}
          {policyType === "cookies" && "Política de Cookies"}
          {policyType === "eula" && "EULA / Licença de Uso"}
          {policyType === "data" && "Exclusão de Conta e Dados"}
          {policyType === "support" && "Suporte"}
          {policyType === "licenses" && "Licenças de Terceiros"}
        </DialogHeader>
        <div className="text-sm max-h-[70vh] overflow-y-auto">
          {policyType === "privacy" && (
            <div className="space-y-2">
              <p>Coletamos dados necessários para funcionamento do serviço, como informações de conta, preferências de pesquisa e dados técnicos do dispositivo.</p>
              <p>Usamos os dados para oferecer e melhorar recursos, cumprir obrigações legais e prevenir abuso.</p>
              <p>Compartilhamos dados apenas com provedores estritamente necessários (autenticação, hospedagem, analytics) sob contratos e medidas de segurança.</p>
              <p>Você pode solicitar acesso, correção ou exclusão de dados. Guardamos dados pelo tempo necessário para operar o serviço e conforme a lei.</p>
              <p>Contato do controlador: calentrip.support@proton.me. Caso necessário, você pode exercer direitos conforme LGPD, GDPR e demais legislações aplicáveis.</p>
              <p>Seus dados podem ser transferidos internacionalmente mediante salvaguardas adequadas.</p>
            </div>
          )}
          {policyType === "terms" && (
            <div className="space-y-2">
              <p>Ao usar o aplicativo, você concorda com estes termos. O serviço é fornecido &quot;como está&quot; e pode ser atualizado a qualquer momento.</p>
              <p>Você deve usar o app conforme a lei e não pode abusar, explorar vulnerabilidades, nem infringir direitos de terceiros.</p>
              <p>Contas podem ser encerradas em caso de violação. Não garantimos disponibilidade contínua nem ausência de erros.</p>
              <p>Limitação de responsabilidade: na extensão permitida pela lei, não somos responsáveis por perdas indiretas, consequenciais ou lucros cessantes.</p>
              <p>Alterações serão comunicadas. O uso contínuo após alterações implica aceitação.</p>
            </div>
          )}
          {policyType === "cookies" && (
            <div className="space-y-2">
              <p>Usamos cookies e tecnologias similares para lembrar preferências, manter sessões e medir uso.</p>
              <p>Tipos: essenciais (obrigatórios), funcionalidade e desempenho/analytics.</p>
              <p>Você pode gerenciar cookies nas configurações do navegador. Desativar cookies essenciais pode impactar o funcionamento.</p>
            </div>
          )}
          {policyType === "eula" && (
            <div className="space-y-2">
              <p>Concedemos licença limitada, não exclusiva e intransferível para uso pessoal do app.</p>
              <p>É proibida engenharia reversa, distribuição não autorizada e uso para fins ilegais.</p>
              <p>A licença termina se você violar estes termos ou por decisão nossa mediante aviso quando aplicável.</p>
            </div>
          )}
          {policyType === "data" && (
            <div className="space-y-2">
              <p>Para excluir dados e a conta, acesse Perfil → Configurações → Excluir conta, ou solicite por e-mail.</p>
              <p>Pedidos de exclusão serão processados e confirmados. Alguns dados podem ser retidos conforme obrigação legal.</p>
              <p>Contato para exclusão: calentrip.support@proton.me.</p>
            </div>
          )}
          {policyType === "support" && (
            <div className="space-y-2">
              <p>Suporte: calentrip.support@proton.me</p>
              <p>Tempo de resposta estimado: até 72 horas úteis.</p>
            </div>
          )}
          {policyType === "licenses" && (
            <div className="space-y-2">
              <p>Este aplicativo pode utilizar bibliotecas de terceiros sob diversas licenças. Créditos e termos de cada projeto estão disponíveis mediante solicitação.</p>
              <p>Quando aplicável, exibiremos notas de copyright e links para repositórios e licenças.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPolicyType(null)}>Fechar</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  );
}
