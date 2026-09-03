import * as React from "react";

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
  className = "",
  children,
}: FilterSelectProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 ml-1"
      >
        {label}
      </label>

      <div className="relative group">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="
            w-full appearance-none rounded-md border
            border-(--color-border)
            bg-(--color-surface)
            px-3.5 py-2.5 pr-10 text-xs sm:text-sm
            text-(--color-text) font-light
            transition-colors
            outline-none focus:border-(--color-text)
            disabled:opacity-35 disabled:cursor-not-allowed
            shadow-xs
            dark:scheme-dark
          "
        >
          {children}
        </select>

        <span
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-y-0 right-3 flex items-center
            text-(--color-muted)
            transition-transform duration-200
            group-focus-within:rotate-180
          "
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </div>
  );
}