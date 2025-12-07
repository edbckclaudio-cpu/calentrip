"use client";
import { forwardRef, InputHTMLAttributes, useRef, useState } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { clearOnFocus?: boolean };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", clearOnFocus = false, ...props },
  ref
) {
  const base =
    "w-full h-12 rounded-lg border border-zinc-300 bg-white px-3 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-50 dark:bg-black dark:border-zinc-700 dark:text-zinc-100";
  const [clearActive, setClearActive] = useState(false);
  const focusValueRef = useRef<string | number | readonly string[] | undefined>(undefined);
  const { onFocus, onBlur, onChange, value } = props;
  return (
    <input
      ref={ref}
      className={`${base} ${className}`}
      {...props}
      {...(typeof value !== "undefined" ? { value: clearActive ? "" : value } : {})}
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
