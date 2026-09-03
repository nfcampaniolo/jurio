import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/shared/components/Input";
import { roleOptions } from "@/interfaces/interfaces";

interface EditProfileFormProps {
  name: string;
  setName: (val: string) => void;
  surname: string;
  setSurname: (val: string) => void;
  role: string;
  setRole: (val: string) => void;
  roleOther: string;
  setRoleOther: (val: string) => void;
  shouldReduceMotion: boolean | null;
}

const roleId = "role-select";
const roleDescriptionId = "role-description";

export const EditProfileForm: React.FC<EditProfileFormProps> = ({
  name,
  setName,
  surname,
  setSurname,
  role,
  setRole,
  roleOther,
  setRoleOther,
  shouldReduceMotion,
}) => {
  return (
    <div className="flex-1 flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
          />
        </div>

        <div>
          <Input
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Cognome"
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={roleId} className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
          Categoria professionale
        </label>

        <p id={roleDescriptionId} className="text-xs text-(--color-muted) font-light ml-1 leading-relaxed">
          La selezione della categoria professionale è facoltativa; tuttavia, la sua indicazione consente di agevolare l’individuazione e la personalizzazione dei contenuti e dei servizi maggiormente pertinenti agli interessi e alle esigenze professionali dell’utente.
        </p>

        <select
          id={roleId}
          aria-describedby={roleDescriptionId}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="appearance-none w-full rounded-md mt-2 border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 pr-10 text-sm font-light text-(--color-text) focus:border-(--color-text) outline-none shadow-xs transition-colors"
        >
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <AnimatePresence initial={false}>
          {role === "altro" && (
            <motion.div
              key="roleOther"
              initial={shouldReduceMotion ? false : { opacity: 0, height: 0, y: -6 }}
              animate={shouldReduceMotion ? {} : { opacity: 1, height: "auto", y: 0 }}
              exit={shouldReduceMotion ? {} : { opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Input
                type="text"
                value={roleOther}
                onChange={(e) => setRoleOther(e.target.value)}
                placeholder="Specifica la tua categoria"
                className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors mt-2"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};