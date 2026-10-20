import {
  ArrowUpRight,
  Bell,
  Check,
  CreditCard,
  FileText,
  Info,
  LifeBuoy,
  Megaphone,
  UserCircle,
  Users,
} from "lucide-react";
import type { NotificationType } from "@/interfaces/interfaces";
import type { FeedItem } from "../hooks/useNotifications";

interface NotificationFeedProps {
  notifications: FeedItem[];
  onNotificationClick: (notification: FeedItem) => void | Promise<void>;
  formatTime: (timestamp: FeedItem["createdAt"]) => string;
}

const getIconForType = (
  type: NotificationType,
  isGlobal?: boolean,
) => {
  const iconProps = {
    size: 19,
    strokeWidth: 1.8,
  };

  if (isGlobal) {
    return <Megaphone {...iconProps} />;
  }

  switch (type) {
    case "billing":
      return <CreditCard {...iconProps} />;
    case "team":
      return <Users {...iconProps} />;
    case "account":
      return <UserCircle {...iconProps} />;
    case "report":
      return <FileText {...iconProps} />;
    case "support":
      return <LifeBuoy {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
};

const getTypeLabel = (
  type: NotificationType,
  isGlobal?: boolean,
) => {
  if (isGlobal) return "Comunicazione";

  switch (type) {
    case "billing":
      return "Fatturazione";
    case "team":
      return "Team";
    case "account":
      return "Account";
    case "report":
      return "Report";
    case "support":
      return "Assistenza";
    default:
      return "Aggiornamento";
  }
};

export function NotificationFeed({
  notifications,
  onNotificationClick,
  formatTime,
}: NotificationFeedProps) {
  return (
    <section aria-label="Elenco delle notifiche">
      {notifications.length === 0 ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-(--color-border) bg-(--color-surface) px-6 py-14 text-center shadow-(--shadow-soft) sm:px-10 sm:py-20"
          style={{
            animation:
              "notifications-card-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-24 w-64 -translate-x-1/2 bg-(--color-primary) opacity-5 blur-3xl"
          />

          <div className="relative mx-auto mb-6 flex size-20 items-center justify-center rounded-[26px] border border-(--color-border) bg-(--color-bg)">
            <Bell
              size={32}
              strokeWidth={1.4}
              className="text-(--color-muted)"
            />

            <span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border border-(--color-border) bg-(--color-surface)">
              <Check size={14} className="text-(--color-muted)" />
            </span>
          </div>

          <h2
            className="text-xl font-medium tracking-tight sm:text-2xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Sei tutto in pari.
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-(--color-muted)">
            Non hai nuove notifiche da leggere. Quando ci saranno
            aggiornamenti, li troverai qui.
          </p>

          <div className="mx-auto mt-7 h-px w-12 bg-(--color-border)" />
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification, index) => (
            <div
              key={notification.id}
              role="button"
              tabIndex={0}
              aria-label={`Apri notifica: ${notification.title}`}
              onClick={() => {
                void onNotificationClick(notification);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void onNotificationClick(notification);
                }
              }}
              style={{
                animationDelay: `${Math.min(index * 75, 525)}ms`,
              }}
              className={`notifications-card-enter group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border p-4 outline-none transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-(--color-primary) sm:gap-4 sm:p-5 ${
                notification.isRead
                  ? "border-(--color-border) bg-(--color-surface) hover:border-(--color-primary)"
                  : "border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) hover:border-(--color-primary)"
              }`}
            >
              {!notification.isRead && (
                <>
                  <div
                    aria-hidden="true"
                    className="absolute bottom-4 left-0 top-4 w-0.75 rounded-r-full bg-(--color-primary)"
                  />

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-40 opacity-60"
                    style={{
                      background:
                        "linear-gradient(270deg, color-mix(in srgb, var(--color-primary) 7%, transparent), transparent)",
                    }}
                  />
                </>
              )}

              <div
                className={`relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105 sm:size-12 ${
                  notification.isRead
                    ? "border-(--color-border) bg-(--color-bg) text-(--color-muted)"
                    : "border-(--color-border) bg-(--color-bg) text-(--color-text)"
                }`}
              >
                {getIconForType(notification.type, notification.isGlobal)}
              </div>

              <div className="relative z-10 min-w-0 flex-1 pt-0.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <h2
                    className={`min-w-0 text-sm tracking-tight sm:text-[15px] ${
                      notification.isRead
                        ? "font-medium text-(--color-text)"
                        : "font-semibold text-(--color-text)"
                    }`}
                  >
                    {notification.title}
                  </h2>

                  <time className="shrink-0 text-[10px] font-medium tracking-wide text-(--color-muted) sm:pt-1 sm:text-right">
                    {formatTime(notification.createdAt)}
                  </time>
                </div>

                <p
                  className={`mt-2 line-clamp-2 text-xs leading-6 sm:text-[13px] ${
                    notification.isRead
                      ? "text-(--color-muted)"
                      : "text-(--color-text)"
                  }`}
                >
                  {notification.message}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-(--color-muted)">
                    {getTypeLabel(notification.type, notification.isGlobal)}
                  </span>

                  {!notification.isRead && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-(--color-text)">
                      <span className="size-1.5 rounded-full bg-(--color-primary)" />
                      Da leggere
                    </span>
                  )}
                </div>
              </div>

              <div className="relative z-10 flex shrink-0 self-center">
                {notification.isRead ? (
                  <div
                    aria-label="Notifica letta"
                    title="Notifica letta"
                    className="flex size-8 items-center justify-center rounded-full text-(--color-muted) opacity-60 transition-all duration-200 group-hover:opacity-100"
                  >
                    <Check size={17} strokeWidth={1.8} />
                  </div>
                ) : (
                  <div
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full border border-(--color-border) bg-(--color-bg) transition-all duration-200 group-hover:border-(--color-primary) group-hover:bg-(--color-primary) group-hover:text-(--color-surface)"
                  >
                    <ArrowUpRight
                      size={16}
                      className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {notifications.length > 0 && (
        <footer className="mt-6 flex items-center justify-center gap-2 py-3 text-[10px] font-medium uppercase tracking-[0.15em] text-(--color-muted)">
          <span className="h-px w-6 bg-(--color-border)" />
          Fine delle notifiche
          <span className="h-px w-6 bg-(--color-border)" />
        </footer>
      )}
    </section>
  );
}
