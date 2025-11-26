import { forwardRef, SelectHTMLAttributes } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = "", children, ...props },
  ref
) {
  const base =
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#003580]/30 disabled:opacity-50 dark:bg-black dark:border-zinc-700 dark:text-zinc-100";
  return (
    <select ref={ref} className={`${base} ${className}`} {...props}>
      {children}
    </select>
  );
});
