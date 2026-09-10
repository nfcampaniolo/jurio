// src/features/analisi/components/ExecutionLogModal/LogStepItem.tsx
import React from "react";
import { Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { type LogStep } from "../hooks/types";

interface LogStepItemProps {
  step: LogStep;
  index: number;
}

export const LogStepItem: React.FC<LogStepItemProps> = ({ step, index }) => {
  return (
    <div
      className={[
        "flex items-start gap-2.5 rounded-md border p-2.5 transition-all",
        step.status === "success"
          ? "border-(--color-border) bg-(--color-bg) text-(--color-text)"
          : "",
        step.status === "error"
          ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
          : "",
        step.status === "pending"
          ? "border-(--color-border) bg-(--color-bg) text-(--color-text)"
          : "",
      ].join(" ")}
    >
      <div className="mt-0.5 shrink-0">
        {step.status === "success" ? (
          <CheckCircle2
            size={13}
            className="text-(--color-text) opacity-80"
          />
        ) : step.status === "error" ? (
          <ShieldAlert
            size={13}
            className="text-red-600 dark:text-red-400"
          />
        ) : (
          <Loader2
            size={13}
            className="animate-spin text-(--color-text)"
          />
        )}
      </div>

      <div className="flex-1 space-y-0.5">
        <div className="flex items-center justify-between font-mono text-[9px] text-(--color-muted)">
          <span>STEP #{index + 1}</span>
          <span>{step.timestamp}</span>
        </div>

        <p className="font-light leading-relaxed text-xs">
          {step.message}
        </p>
      </div>
    </div>
  );
}