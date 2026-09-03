import { motion, AnimatePresence } from "framer-motion";
import { type Message } from "@/interfaces/interfaces";

interface MessageTimelineProps {
  messages: Message[];
}

export const MessageTimeline = ({ messages }: MessageTimelineProps) => {
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length < 2) return null;

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="hidden lg:flex flex-col justify-center items-end gap-3 absolute right-3 top-0 bottom-0 z-40 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2.5 py-4 px-2">
        <AnimatePresence>
          {userMessages.map((msg) => {
            const isLong = msg.content.length > 100;
            const preview = isLong ? msg.content.substring(0, 100) + "..." : msg.content;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative group flex items-center justify-end w-6 cursor-pointer"
                onClick={() => scrollToMessage(msg.id)}
              >
                {/* Il "Trattino" */}
                <div className="w-2.5 h-1 rounded-sm bg-(--color-border) group-hover:bg-(--color-text) group-hover:w-4 transition-all duration-300 shadow-sm" />

                {/* Il Pop-up (Tooltip) mostrato in Hover */}
                <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 origin-right scale-95 group-hover:scale-100 z-50">
                  <div className="bg-(--color-surface) text-(--color-text) border border-(--color-border) text-xs py-2 px-3 rounded-md shadow-(--shadow-soft) w-64 max-w-[16rem]">
                    <p className="line-clamp-3 leading-relaxed whitespace-pre-wrap font-light" style={{ fontFamily: 'var(--font-serif)' }}>
                      {preview}
                    </p>
                    {/* Freccina del tooltip */}
                    <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-(--color-border)" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};