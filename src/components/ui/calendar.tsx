"use client";
import { forwardRef, InputHTMLAttributes, useRef, useState } from "react";

export const CalendarInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function CalendarInput(
  { className = "", ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const focusValueRef = useRef<string | number | readonly string[] | undefined>(undefined);
  const { onFocus, onBlur, value } = props;
  const clearOnFocus = (props as any).clearOnFocus ?? true;
  const shouldClear = focused && clearOnFocus && typeof value !== "undefined" && String(value) !== "" && value === focusValueRef.current;
  return (
    <input
      ref={ref}
      type="date"
      className={`w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 dark:bg-black dark:border-zinc-700 dark:text-zinc-100 ${className}`}
      {...props}
      value={shouldClear ? "" : value}
      onFocus={(e) => {
        focusValueRef.current = value;
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
    />
  );
});
