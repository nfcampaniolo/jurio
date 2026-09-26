import React, { useState } from "react";
import { FiSend, FiMail, FiBell, FiCode, FiEye } from "react-icons/fi";
import { useAdminNotifications, type NotificationPayload } from "../hooks/useAdminNotifications";
import { toast } from "react-hot-toast";

export const AdminNotificationsSection: React.FC = () => {
  const { sendNotification, isSending } = useAdminNotifications();
  
  // Stato per gestire la vista dell'editor HTML (codice vs anteprima)
  const [emailView, setEmailView] = useState<"code" | "preview">("code");

  const [payload, setPayload] = useState<NotificationPayload & { emailHtml: string }>({
    targetMode: "broadcast",
    consentFilter: "all",
    uid: "",
    sendInApp: true,
    sendEmail: false,
    title: "",
    message: "",
    emailHtml: "", 
    link: "/profilo",
    type: "info"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setPayload(prev => ({ ...prev, [name]: checked }));
    } else {
      setPayload(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.sendInApp && !payload.sendEmail) {
      toast.error("Seleziona almeno un canale di invio (In-App o Email).");
      return;
    }
    if (payload.targetMode === "single" && !payload.uid?.trim()) {
      toast.error("Inserisci l'UID dell'utente destinatario.");
      return;
    }
    if (payload.sendEmail && !payload.emailHtml.trim()) {
      toast.error("Inserisci il codice HTML per l'email.");
      return;
    }
    if (payload.sendInApp && !payload.message.trim()) {
      toast.error("Inserisci il testo per la notifica In-App.");
      return;
    }

    await sendNotification(payload);
    setPayload(prev => ({ ...prev, title: "", message: "", emailHtml: "" }));
    setEmailView("code"); // Resetta la vista sul codice dopo l'invio
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg text-text border border-(--color-border) rounded-xl p-6 shadow-sm flex flex-col gap-6">
      
      {/* SEZIONE DESTINATARI */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold border-b border-(--color-border) pb-2">Destinatario</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="targetMode" value="broadcast" checked={payload.targetMode === "broadcast"} onChange={handleChange} className="accent-(--color-primary)" />
            Broadcast (A tappeto)
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="targetMode" value="single" checked={payload.targetMode === "single"} onChange={handleChange} className="accent-(--color-primary)" />
            Singolo Utente
          </label>
        </div>

        {payload.targetMode === "broadcast" ? (
          <div className="flex flex-col gap-2 w-full max-w-md">
            <label className="text-sm font-semibold">Filtra per Consensi (Users DB)</label>
            <select name="consentFilter" value={payload.consentFilter} onChange={handleChange} className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary)">
              <option value="all">Tutti gli utenti (Usa con cautela)</option>
              <option value="comms">Solo chi ha accettato Comunicazioni (comms: true)</option>
              <option value="marketing">Solo chi ha accettato Marketing (marketing: true)</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full max-w-md">
            <label className="text-sm font-semibold">UID Utente</label>
            <input type="text" name="uid" value={payload.uid || ""} onChange={handleChange} placeholder="es. TTHcCNy5WeOTarQep4jVItbByKg1" className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary)" />
          </div>
        )}
      </div>

      {/* SEZIONE CANALI */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold border-b border-(--color-border) pb-2">Canali di invio</h3>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input type="checkbox" name="sendInApp" checked={payload.sendInApp} onChange={handleChange} className="w-5 h-5 accent-(--color-primary)" />
            <FiBell className="text-lg" /> Notifica In-App
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-medium">
            <input type="checkbox" name="sendEmail" checked={payload.sendEmail} onChange={handleChange} className="w-5 h-5 accent-(--color-primary)" />
            <FiMail className="text-lg" /> Invia Email
          </label>
        </div>
      </div>

      {/* SEZIONE CONTENUTO */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-bold border-b border-(--color-border) pb-2">Contenuto</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Titolo (In-App) / Oggetto (Email)</label>
            <input type="text" name="title" required value={payload.title} onChange={handleChange} placeholder="es. Benvenuto su Jurio!" className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary)" />
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Tipo (Icona UI In-App)</label>
            <select name="type" value={payload.type} onChange={handleChange} className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary)">
              <option value="info">Info (Generica)</option>
              <option value="account">Account (Profilo)</option>
              <option value="billing">Billing (Fatturazione/Pagamenti)</option>
              <option value="team">Team (Utenti/Permessi)</option>
              <option value="report">Report (Documenti/Analisi)</option>
              <option value="support">Support (Assistenza)</option>
            </select>
          </div>
        </div>

        {/* --- STRUMENTO IN-APP --- */}
        {payload.sendInApp && (
          <div className="flex flex-col gap-4 mt-2 p-4 border border-(--color-border) rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            <h4 className="font-bold flex items-center gap-2 text-sm text-(--color-text)">
              <FiBell /> Contenuto Notifica In-App
            </h4>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">Testo Breve</label>
              <textarea name="message" required={payload.sendInApp} rows={3} value={payload.message} onChange={handleChange} placeholder="Scrivi il messaggio della notifica in-app..." className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary) resize-none" />
            </div>

            <div className="flex flex-col gap-2 w-full max-w-md">
              <label className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">Link Azione (Opzionale)</label>
              <input type="text" name="link" value={payload.link} onChange={handleChange} placeholder="es. /profilo" className="p-2 border border-(--color-border) rounded-lg bg-bg focus:ring-2 focus:ring-(--color-primary)" />
            </div>
          </div>
        )}

        {/* --- STRUMENTO HTML PER EMAIL CON ANTEPRIMA --- */}
        {payload.sendEmail && (
          <div className="flex flex-col gap-4 mt-2 p-4 border border-(--color-border) rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            
            <div className="flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-2 text-sm text-(--color-text)">
                <FiCode /> Editor HTML Email
              </h4>
              
              {/* Toggle Codice / Anteprima */}
              <div className="flex bg-bg rounded-lg p-1 border border-(--color-border)">
                <button
                  type="button"
                  onClick={() => setEmailView("code")}
                  className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    emailView === "code"
                      ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <FiCode /> Codice
                </button>
                <button
                  type="button"
                  onClick={() => setEmailView("preview")}
                  className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    emailView === "preview"
                      ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <FiEye /> Anteprima
                </button>
              </div>
            </div>
            
            {emailView === "code" ? (
              <div className="flex flex-col gap-2">
                <textarea 
                  name="emailHtml" 
                  required={payload.sendEmail} 
                  rows={12} 
                  value={payload.emailHtml} 
                  onChange={handleChange} 
                  placeholder="<!DOCTYPE html>&#10;<html>&#10; <body>&#10;  <h1>Incolla qui il tuo HTML personalizzato</h1>&#10; </body>&#10;</html>" 
                  className="p-4 border border-(--color-border) rounded-lg bg-bg font-mono text-sm focus:ring-2 focus:ring-(--color-primary) resize-y w-full" 
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full h-100">
                {payload.emailHtml.trim() ? (
                  <iframe 
                    title="Anteprima Email HTML"
                    srcDoc={payload.emailHtml}
                    className="w-full h-full border border-(--color-border) rounded-lg bg-white"
                    sandbox="" 
                  />
                ) : (
                  <div className="w-full h-full border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex items-center justify-center text-neutral-400 dark:text-neutral-500 text-sm font-semibold">
                    Inserisci del codice HTML per vedere l'anteprima
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUBMIT */}
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isSending}
          className="flex items-center gap-2 bg-(--color-primary) text-white px-6 py-2 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSending ? (
            <>Invio in corso...</>
          ) : (
            <><FiSend /> Esegui Invio</>
          )}
        </button>
      </div>
    </form>
  );
};