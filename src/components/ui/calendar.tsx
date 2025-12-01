"use client";
import { forwardRef, InputHTMLAttributes, useRef, useState } from "react";

type CalendarInputProps = InputHTMLAttributes<HTMLInputElement> & { clearOnFocus?: boolean };

export const CalendarInput = forwardRef<HTMLInputElement, CalendarInputProps>(function CalendarInput(
  { className = "", clearOnFocus = false, ...props },
  ref
) {
  const [clearActive, setClearActive] = useState(false);
  const focusValueRef = useRef<string | number | readonly string[] | undefined>(undefined);
  const { onFocus, onBlur, onChange, value } = props;
  return (
    <input
      ref={ref}
      type="date"
      className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:bg-black dark:border-zinc-700 dark:text-zinc-100 ${className}`}
      {...props}
      value={clearActive ? "" : value}
      onFocus={(e) => {
        focusValueRef.current = value;
        setClearActive(clearOnFocus && typeof value !== "undefined" && String(value) !== "");
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setClearActive(false);
        onBlur?.(e);
      }}
      onChange={(e) => {
        setClearActive(false);
        onChange?.(e);
      }}
    />
  );
});
