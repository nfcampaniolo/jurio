import { useEffect, useState } from "react";
import { FaRegBookmark, FaBookmark } from "react-icons/fa";
import {
  isSentenzaSaved,
  saveSentenza,
  removeSentenza,
} from "@/services/saveSentences";
import toast from "react-hot-toast";

type SaveSentenzaButtonProps = {
  userId: string | null | undefined;
  sentenzaId: string;
};

export function SaveSentenzaButton({
  userId,
  sentenzaId,
}: SaveSentenzaButtonProps) {
  const [saved, setSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  console.log(sentenzaId);
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!userId || !sentenzaId) return;
      try {
        const exists = await isSentenzaSaved(userId, sentenzaId);
        if (alive) setSaved(exists);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, sentenzaId]);

  const onToggle = async () => {
    if (!userId || !sentenzaId || loading) return;

    const next = !saved;
    setSaved(next); // UI ottimistica
    setLoading(true);

    try {
      if (next) {
        await saveSentenza(userId, sentenzaId);
        toast("Salvato");
      } else {
        await removeSentenza(userId, sentenzaId);
        toast("Rimosso");
      }
    } catch (e) {
      setSaved(!next); // rollback
      toast.error("Errore");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onToggle}
      disabled={loading || !userId}
      className="group w-full inline-flex items-center justify-center gap-4
        px-7 py-3.5 rounded-md
        border border-neutral-400 dark:border-neutral-600
        bg-white dark:bg-neutral-900
        text-neutral-900 dark:text-neutral-100
        text-sm tracking-wide
        shadow-[0_1px_0_rgba(0,0,0,0.04)]
        transition-all duration-200
        hover:border-neutral-600 dark:hover:border-neutral-400
        hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)]
        focus:outline-none focus:ring-2 focus:ring-neutral-400
        disabled:opacity-60 disabled:cursor-not-allowed"
      aria-pressed={saved}
    >
      {saved ? (
        <FaBookmark className="transition" />
      ) : (
        <FaRegBookmark className="transition" />
      )}
      <span className="uppercase">
        {loading ? "..." : saved ? "Rimuovi" : "Salva"}
      </span>
    </button>
  );
}