import {
  Bell,
  CheckCheck,
  Sparkles,
} from "lucide-react";

interface NotificationHeaderProps {
  notificationCount: number;
  unreadCount: number;
  onMarkAllAsRead: () => void;
}

export function NotificationHeader({
  notificationCount,
  unreadCount,
  onMarkAllAsRead,
}: NotificationHeaderProps) {
  return (
    <header className="mb-8 sm:mb-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) sm:size-16">
            <Bell
              size={25}
              strokeWidth={1.6}
              className="text-(--color-text)"
            />

            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} notifiche non lette`}
                className="notifications-unread-indicator absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-(--color-primary) text-[10px] font-bold text-(--color-surface)"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--color-muted)">
                Il tuo spazio
              </span>

              <span className="size-1 rounded-full bg-(--color-primary)" />

              <span className="text-[10px] uppercase tracking-[0.15em] text-(--color-muted)">
                Centro notifiche
              </span>
            </div>

            <h1
              className="text-3xl font-medium tracking-tight sm:text-4xl lg:text-[42px]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Notifiche
            </h1>

            <p className="mt-2 max-w-md text-sm leading-6 text-(--color-muted)">
              Tutto quello che succede nel tuo account, raccolto in un unico
              posto.
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllAsRead}
            className="group inline-flex min-h-11 items-center justify-center gap-2.5 self-start rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3 text-xs font-medium text-(--color-text) shadow-(--shadow-soft) transition-all duration-200 hover:-translate-y-0.5 hover:border-(--color-primary) hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) sm:self-center"
          >
            <CheckCheck
              size={16}
              className="text-(--color-muted) transition-transform duration-200 group-hover:scale-110"
            />

            <span>Segna tutte come lette</span>
          </button>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3 border-t border-(--color-border) pt-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-(--color-border) bg-(--color-surface)">
          <Sparkles size={16} className="text-(--color-muted)" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-(--color-text)">
            La tua attività
          </p>

          <p className="mt-0.5 text-xs text-(--color-muted)">
            {notificationCount === 0
              ? "Non ci sono aggiornamenti al momento."
              : `${notificationCount} ${
                  notificationCount === 1
                    ? "notifica disponibile"
                    : "notifiche disponibili"
                }`}
          </p>
        </div>

        {unreadCount > 0 && (
          <span className="shrink-0 rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-(--color-text)">
            {unreadCount} da leggere
          </span>
        )}
      </div>
    </header>
  );
}
