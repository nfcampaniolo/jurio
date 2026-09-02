import React from "react";
import type { IconType } from "react-icons"; // Import corretto per le icone

interface SectionTitleProps {
  icon: IconType;
  title: string;
  subtitle?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-2 font-medium text-xs uppercase tracking-widest text-(--color-text) mb-2.5">
    <Icon className="opacity-70" />
    <span>{title} {subtitle}</span>
  </div>
);

export const SectionText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm md:text-base text-(--color-muted) font-light leading-relaxed">
    {children}
  </p>
);

export const SectionContainer: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <div className={`border-t border-(--color-border) pt-6 ${className}`}>
    {children}
  </div>
);