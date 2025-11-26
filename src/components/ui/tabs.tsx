import { createContext, useContext, useState, ReactNode } from "react";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
  onValueChange?: (v: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs({ defaultValue, children, onValueChange }: { defaultValue: string; children: ReactNode; onValueChange?: (v: string) => void }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue, onValueChange }}>{children}</TabsContext.Provider>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex gap-2">{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => { ctx.setValue(value); ctx.onValueChange?.(value); }}
      className={`rounded-md px-3 py-2 text-sm ${
        active ? "bg-black text-white dark:bg-zinc-100 dark:text-black" : "bg-zinc-100 text-black dark:bg-zinc-900 dark:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div>{children}</div>;
}
