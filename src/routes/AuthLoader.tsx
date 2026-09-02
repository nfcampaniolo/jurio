import React from "react";

// Simple, accessible auth loading placeholder used by route guards
export const AuthLoader: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="min-h-screen flex items-center justify-center text-neutral-500 dark:text-neutral-400"
    >
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin h-8 w-8 text-neutral-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span className="text-sm">Caricamento…</span>
      </div>
    </div>
  );
};

export default AuthLoader;
