import { forwardRef, ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className = "", variant = "primary", ...props },
  ref
) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-[#febb02] text-black hover:bg-[#ffcc3f]"
      : variant === "secondary"
      ? "bg-[#007AFF] text-white hover:bg-[#0066d6]"
      : "bg-white text-[#007AFF] border border-zinc-300 hover:bg-zinc-100";
  return <button ref={ref} className={`${base} ${styles} ${className}`} {...props} />;
});
