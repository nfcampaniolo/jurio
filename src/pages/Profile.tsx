import React, { useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Upload } from "@/components/Profile/UploadSentences";
import { YourDocument } from "@/components/Document/YourDocument.tsx";
import { HeaderProfile } from "@/components/Profile/HeaderProfile";
import type { Action } from "@/interfaces/interfaces";
import {
  FiSearch,
  FiBriefcase,
  FiUser,
  FiLogOut,
  FiTrash2,
  FiDollarSign,
  FiActivity,
  FiLayout
} from "react-icons/fi";
import { navigateItem } from "@/hooks/navigation";
import { Loader2 } from "lucide-react";

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    loading,
    userData,
    name,
    surname,
    avatar,
    deleteAccount,
    exportAccount
  } = useProfile();

  const [confirmOpen, setConfirmOpen] = useState(false);

  if (loading || !user || !userData) {
    return (
      <div className="h-screen flex items-center justify-center text-(--color-muted) gap-2 bg-(--color-bg)">
        <Loader2 size={16} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento...</span>
      </div>
    );
  }

  const actions: Action[] = [
    {
      id: "search",
      label: "Ricerca Giurisprudenza",
      icon: <FiSearch />,
      onClick: () =>
        navigateItem(
          { type: "route", target: "/ricerca" },
          navigate
        ),
    },
    {
      id: "chat",
      label: "Consulente Legale",
      icon: <FiBriefcase />,
      onClick: () =>
        navigateItem(
          { type: "route", target: "/chat" },
          navigate
        ),
    },
    {
      id: "pricing",
      label: "Piani",
      icon: <FiDollarSign />,
      onClick: () => {
        navigate("/profilo/piani");
      },
    },
    {
      id: "edit",
      label: "Modifica Profilo",
      icon: <FiUser />,
      onClick: () => {
        navigate("/profilo/modifica");
      },
    },
    {
      id: "utilizzi",
      label: "Utilizzi",
      icon: <FiActivity />,
      onClick: () => {
        navigate("/profilo/utilizzi");
      },
    },
    {
      id: "team",
      label: "Workspace",
      icon: <FiLayout />,
      onClick: () => {
        navigate("/profilo/team");
      },
    },
    {
      id: "logout",
      label: "Logout",
      icon: <FiLogOut />,
      onClick: () => {
        void (async () => {
          const { logout } = await import("@/services/auth");
          await logout();
          navigate("/login", { replace: true });
        })();
      },
    },
    {
      id: "delete",
      label: "Elimina Profilo",
      icon: <FiTrash2 />,
      destructive: true,
      onClick: () => setConfirmOpen(true),
    },
  ];

  return (
    <div className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <HeaderProfile
        name={name}
        surname={surname}
        avatar={avatar}
        actions={actions}
      />
      <main className="py-10 max-w-5xl mx-auto px-4 sm:px-6 flex flex-col gap-8">

        {/* Profilo compatto */}
        <motion.section
            id="section1"
            className="flex flex-col items-center text-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <Upload/>
          </motion.section>

          <motion.section
            id="section2"
            className="flex flex-col items-center text-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 }}
          >
            <YourDocument/>
          </motion.section>

        <ConfirmModal
          isOpen={confirmOpen}
          title="Elimina Profilo Definitivamente"
          message="Sei sicuro di voler eliminare l'account? Questa azione è PERMANENTE e IRREVERSIBILE. Tutti i tuoi dati verranno distrutti immediatamente e non potranno essere recuperati in alcun modo."
          confirmText="Elimina Account"
          cancelText="Annulla"
          confirmationPhrase="ELIMINA-ACCOUNT"
          onExport={() => {
            exportAccount();
            console.log("Esportazione dati in corso...");
            toast("Preparazione esportazione dati...");
          }}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            deleteAccount();
            toast.success("Profilo eliminato con successo");
            navigate("/login", { replace: true });
            setConfirmOpen(false);
          }}
        />
        {/* Footer con link legali */}
        <div className="mt-8 flex justify-center gap-6 text-xs text-(--color-muted) font-light uppercase tracking-widest">
          <a href="/privacy" className="hover:text-(--color-text) transition-colors underline underline-offset-2">Privacy</a>
          <a href="/termini" className="hover:text-(--color-text) transition-colors underline underline-offset-2">Termini</a>
          <a href="/gdpr" className="hover:text-(--color-text) transition-colors underline underline-offset-2">Trattamento dati</a>
        </div>

      </main>
    </div>
  );
};