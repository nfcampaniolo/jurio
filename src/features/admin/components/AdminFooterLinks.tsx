import React from "react";

export const AdminFooterLinks: React.FC = () => {
  return (
    <div className="mt-8 mb-8 flex justify-center gap-6 text-sm text-neutral-500 dark:text-neutral-400">
      <a href="/privacy" className="hover:underline">Privacy</a>
      <a href="/termini" className="hover:underline">Termini</a>
      <a href="/gdpr" className="hover:underline">Trattamento dati</a>
    </div>
  );
};