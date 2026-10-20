import { Helmet } from "@dr.pogodin/react-helmet";
import { Bell, Loader2 } from "lucide-react";

import { NotificationFeed } from "./components/NotificationFeed";
import { NotificationHeader } from "./components/NotificationHeader";
import { useNotifications } from "./hooks/useNotifications";

export default function NotificationsPage() {
  const {
    user,
    authLoading,
    dbLoading,
    feedCompleto,
    unreadCount,
    handleNotificationClick,
    markAllAsRead,
    formatTime,
  } = useNotifications();

  if (authLoading || dbLoading) {
    return (
      <>
        <Helmet>
          <title>Caricamento notifiche... | Jurio</title>
        </Helmet>

        <main className="flex min-h-[65vh] items-center justify-center bg-(--color-bg) px-4 text-(--color-text)">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft)">
              <Loader2
                size={23}
                className="animate-spin text-(--color-text)"
              />
            </div>

            <div className="space-y-1 text-center">
              <p className="text-sm font-medium">
                Preparazione delle notifiche
              </p>
              <p className="text-xs text-(--color-muted)">
                Stiamo sincronizzando i tuoi aggiornamenti.
              </p>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Helmet>
          <title>Accesso richiesto | Jurio</title>
        </Helmet>

        <main className="flex min-h-[65vh] items-center justify-center bg-(--color-bg) px-4">
          <div className="w-full max-w-md rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center shadow-(--shadow-soft)">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-(--color-border) bg-(--color-bg)">
              <Bell size={24} className="text-(--color-muted)" />
            </div>

            <h1
              className="text-xl font-medium tracking-tight text-(--color-text)"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Accesso richiesto
            </h1>

            <p className="mt-2 text-sm leading-6 text-(--color-muted)">
              Accedi al tuo account per visualizzare le notifiche e gli
              aggiornamenti.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {unreadCount > 0
            ? `(${unreadCount}) Notifiche | Jurio`
            : "Notifiche | Jurio"}
        </title>

        <meta
          name="description"
          content="Visualizza gli aggiornamenti, le comunicazioni di servizio e le notifiche del tuo account."
        />
      </Helmet>

      <style>{`
        @keyframes notifications-page-enter {
          from {
            opacity: 0;
            transform: translateY(12px);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes notifications-card-enter {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes notifications-float {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(0, 18px, 0) scale(1.06);
          }
        }

        @keyframes notifications-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 22%, transparent);
          }
          50% {
            box-shadow: 0 0 0 5px color-mix(in srgb, var(--color-primary) 0%, transparent);
          }
        }

        .notifications-page-enter {
          animation: notifications-page-enter 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .notifications-card-enter {
          opacity: 0;
          animation: notifications-card-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .notifications-decoration {
          animation: notifications-float 14s ease-in-out infinite;
        }

        .notifications-unread-indicator {
          animation: notifications-pulse 2.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .notifications-page-enter,
          .notifications-card-enter,
          .notifications-decoration,
          .notifications-unread-indicator {
            animation: none !important;
            opacity: 1;
            filter: none;
            transform: none;
          }

          .notifications-card-enter,
          .notifications-card-enter * {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      <main className="relative isolate min-h-screen overflow-hidden bg-(--color-bg) text-(--color-text)">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-105 overflow-hidden"
        >
          <div
            className="notifications-decoration absolute -top-40 left-[5%] size-87.5 rounded-full opacity-15 blur-[100px]"
            style={{ background: "var(--color-primary)" }}
          />

          <div
            className="notifications-decoration absolute -top-24 right-[5%] size-75 rounded-full opacity-10 blur-[90px]"
            style={{
              background: "var(--color-primary)",
              animationDelay: "-7s",
            }}
          />

          <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-(--color-bg)" />
        </div>

        <div className="notifications-page-enter relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <NotificationHeader
            notificationCount={feedCompleto.length}
            unreadCount={unreadCount}
            onMarkAllAsRead={markAllAsRead}
          />
          <NotificationFeed
            notifications={feedCompleto}
            onNotificationClick={handleNotificationClick}
            formatTime={formatTime}
          />
        </div>
      </main>
    </>
  );
}
