import { forwardRef, InputHTMLAttributes } from "react";

export const CalendarInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function CalendarInput(
  { className = "", ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type="date"
      className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:bg-black dark:border-zinc-700 dark:text-zinc-100 ${className}`}
      {...props}
    />
  );
});

