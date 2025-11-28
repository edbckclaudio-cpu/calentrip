import React, { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

export default function App() {
  const [userId, setUserId] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestId, setGuestId] = useState("");

  const appId = useMemo(() => (typeof window !== "undefined" && window.__app_id ? window.__app_id : "calentrip"), []);
  const firebaseConfig = useMemo(() => (typeof window !== "undefined" ? window.__firebase_config : null), []);
  const initialToken = useMemo(() => (typeof window !== "undefined" ? window.__initial_auth_token : null), []);

  function getGuestId() {
    try {
      const k = "calentrip:guestId";
      const cur = localStorage.getItem(k);
      if (cur) return cur;
      const g = "guest_" + ((crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)));
      localStorage.setItem(k, g);
      return g;
    } catch {
      return "guest_" + Math.random().toString(36).slice(2);
    }
  }

  useEffect(() => {
    try { setGuestId(getGuestId()); } catch {}
  }, []);

  async function migrateGuestTripData(db, guest, uid) {
    try {
      const from = doc(db, "artifacts", appId, "users", guest, "tripData", "currentTrip");
      const to = doc(db, "artifacts", appId, "users", uid, "tripData", "currentTrip");
      const snap = await getDoc(from);
      if (snap.exists()) {
        const data = snap.data();
        await setDoc(to, data);
        await deleteDoc(from);
      }
    } catch {}
  }

  async function refreshPremium(db, uid) {
    try {
      const pr = doc(db, "artifacts", appId, "users", uid, "profile");
      const s = await getDoc(pr);
      const v = s.exists() ? Boolean(s.data()?.isPremium) : false;
      setIsPremium(v);
    } catch {
      setIsPremium(false);
    }
  }

  useEffect(() => {
    if (!firebaseConfig) return;
    if (!getApps().length) initializeApp(firebaseConfig);
    const auth = getAuth();
    const db = getFirestore();
    setAuthLoading(true);
    if (initialToken) {
      signInWithCustomToken(auth, initialToken).catch(() => signInAnonymously(auth)).finally(() => setAuthLoading(false));
    } else {
      signInAnonymously(auth).finally(() => setAuthLoading(false));
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setIsLoggedIn(false);
        setUserId("");
        setIsPremium(false);
        return;
      }
      const guest = getGuestId();
      if (u.isAnonymous) {
        setIsLoggedIn(false);
        setUserId(guest);
        setIsPremium(false);
      } else {
        setIsLoggedIn(true);
        setUserId(u.uid);
        await migrateGuestTripData(db, guest, u.uid);
        await refreshPremium(db, u.uid);
      }
    });
    return () => unsub();
  }, [firebaseConfig, initialToken, appId]);

  async function saveDemoTrip() {
    if (!firebaseConfig) return;
    const db = getFirestore();
    const guest = getGuestId();
    const p = doc(db, "artifacts", appId, "users", guest, "tripData", "currentTrip");
    const sample = { title: "Viagem Demo", date: new Date().toISOString().slice(0, 10), passengers: 2, origin: "GRU", destination: "GIG" };
    await setDoc(p, sample);
  }

  async function signInGoogle() {
    if (!firebaseConfig) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setShowAuth(false);
    } catch (e) {
      setAuthError("Falha ao autenticar com Google");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signInEmail() {
    if (!firebaseConfig) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      setShowAuth(false);
    } catch (e) {
      setAuthError("Conta não encontrada. Crie sua conta.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUpEmail() {
    if (!firebaseConfig) return;
    setAuthError("");
    setAuthLoading(true);
    try {
      const auth = getAuth();
      await createUserWithEmailAndPassword(auth, email, password);
      setShowAuth(false);
    } catch (e) {
      setAuthError("Falha ao criar conta");
    } finally {
      setAuthLoading(false);
    }
  }

  function FinalCalendarFeature() {
    if (isPremium) {
      return (
        <button className="px-4 py-2 rounded-lg bg-[#007AFF] text-white hover:bg-[#0066d6]" onClick={() => alert("Abrindo Calendário Final")}>
          Calendário Final
        </button>
      );
    }
    if (isLoggedIn) {
      return (
        <button className="px-4 py-2 rounded-lg bg-[#febb02] text-black hover:bg-[#ffcc3f]" onClick={() => alert("Abrindo Upgrade")}>
          Fazer Upgrade
        </button>
      );
    }
    return (
      <button className="px-4 py-2 rounded-lg bg-white text-[#007AFF] border border-zinc-300 hover:bg-zinc-100" onClick={() => setShowAuth(true)}>
        Fazer Login para Desbloquear
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#007AFF] text-white text-sm">CT</span>
            <span className="font-semibold">CalenTrip Freemium</span>
          </div>
          <div className="text-sm">
            {isLoggedIn ? (
              <span className="text-green-700">Logado • {userId.slice(0, 6)}...</span>
            ) : (
              <span className="text-zinc-700">{guestId ? `Anônimo • ${guestId}` : "Anônimo"}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold mb-2">Identidade</h2>
          <div className="text-sm text-zinc-700 space-y-2">
            <div>App ID: <span className="font-mono">{appId}</span></div>
            <div>Status: <span className="font-mono">{isLoggedIn ? "logado" : "anônimo"}</span></div>
            <div>Premium: <span className="font-mono">{isPremium ? "sim" : "não"}</span></div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Dados de Viagem</h2>
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 rounded-lg bg-[#febb02] text-black hover:bg-[#ffcc3f]" onClick={saveDemoTrip}>
              Salvar viagem demo (guest)
            </button>
            <button className="px-3 py-2 rounded-lg bg-white text-[#007AFF] border border-zinc-300 hover:bg-zinc-100" onClick={() => setShowAuth(true)}>
              Abrir Autenticação
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Ao autenticar, os dados do guest serão migrados para o usuário.</p>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold mb-3">Gating</h2>
          <FinalCalendarFeature />
        </section>
      </main>

      {showAuth && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-lg border bg-white p-4">
            <h3 className="text-sm font-semibold mb-3">Login/Cadastro</h3>
            <div className="space-y-3">
              <button className="w-full px-3 py-2 rounded-lg bg-[#007AFF] text-white hover:bg-[#0066d6]" disabled={authLoading} onClick={signInGoogle}>
                Entrar com Google
              </button>
              <div className="grid grid-cols-1 gap-2">
                <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <button className="px-3 py-2 rounded-lg bg-[#febb02] text-black hover:bg-[#ffcc3f]" disabled={authLoading} onClick={signInEmail}>
                    Entrar
                  </button>
                  <button className="px-3 py-2 rounded-lg bg-white text-[#007AFF] border border-zinc-300 hover:bg-zinc-100" disabled={authLoading} onClick={signUpEmail}>
                    Criar conta
                  </button>
                </div>
              </div>
              {authError ? <div className="text-xs text-red-600">{authError}</div> : null}
              <div className="flex justify-end">
                <button className="px-3 py-2 rounded-lg bg-white text-[#007AFF] border border-zinc-300 hover:bg-zinc-100" onClick={() => setShowAuth(false)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
