import { forwardRef, InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = "", ...props },
  ref
) {
  const base =
    "w-full h-12 rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-50 dark:bg-black dark:border-zinc-700 dark:text-zinc-100";
  return <input ref={ref} className={`${base} ${className}`} {...props} />;
});
