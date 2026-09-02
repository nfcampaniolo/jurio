import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "@dr.pogodin/react-helmet";
import { useAuth } from "@/context/useAuth";
import { 
  Bell, 
  CreditCard, 
  Users, 
  UserCircle, 
  FileText, 
  LifeBuoy, 
  Info,
  Check,
  CheckCheck,
  Loader2,
  Megaphone
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { NotificationType, JurioNotification } from "@/interfaces/interfaces";

// Creiamo un tipo esteso per gestire nel feed sia quelle personali che i broadcast
type FeedItem = JurioNotification & { isGlobal?: boolean };

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Dividiamo gli stati per le 3 fonti dati
  const [personalNotifs, setPersonalNotifs] = useState<JurioNotification[]>([]);
  const [broadcastNotifs, setBroadcastNotifs] = useState<JurioNotification[]>([]);
  const [readBroadcastIds, setReadBroadcastIds] = useState<string[]>([]);
  
  const [dbLoading, setDbLoading] = useState(true);

  // 1. Ascolto parallelo in tempo reale (Import Dinamico)
  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading && !user) setDbLoading(false);
      return;
    }

    let unsubPersonal: (() => void) | undefined;
    let unsubBroadcast: (() => void) | undefined;
    let unsubUser: (() => void) | undefined;
    let isCancelled = false;

    (async () => {
      try {
        const { collection, doc, query, where, orderBy, limit, onSnapshot } = await import("firebase/firestore");
        const { getDb } = await import("@/services/db");
        const db = await getDb();

        if (isCancelled) return;

        // A. Notifiche Personali
        const qPersonal = query(
          collection(db, "notification"),
          where("uid", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
          const notifs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as JurioNotification[];
          setPersonalNotifs(notifs);
          setDbLoading(false);
        });

        // B. Avvisi Globali (Prendiamo gli ultimi 30 per non appesantire)
        const qBroadcast = query(
          collection(db, "broadcast"),
          orderBy("createdAt", "desc"),
          limit(30)
        );

        unsubBroadcast = onSnapshot(qBroadcast, (snapshot) => {
          const broadcasts = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as JurioNotification[];
          setBroadcastNotifs(broadcasts);
        });

        // C. Profilo Utente (per gli ID dei broadcast letti)
        unsubUser = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setReadBroadcastIds(data.readBroadcasts || []);
          }
        });

      } catch (error) {
        console.error("Errore durante il caricamento dinamico di Firestore:", error);
        setDbLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
      if (unsubPersonal) unsubPersonal();
      if (unsubBroadcast) unsubBroadcast();
      if (unsubUser) unsubUser();
    };
  }, [user, authLoading]);

  // 2. Unione e Ordinamento del Feed (Memoizzato per performance)
  const feedCompleto = useMemo<FeedItem[]>(() => {
    // Mappiamo i broadcast aggiungendo lo stato di lettura
    const mappedBroadcasts: FeedItem[] = broadcastNotifs.map(b => ({
      ...b,
      isGlobal: true,
      isRead: readBroadcastIds.includes(b.id)
    }));

    // Mappiamo le personali
    const mappedPersonal: FeedItem[] = personalNotifs.map(p => ({
      ...p,
      isGlobal: false
    }));

    // Uniamo e ordiniamo per data decrescente
    return [...mappedPersonal, ...mappedBroadcasts].sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
  }, [personalNotifs, broadcastNotifs, readBroadcastIds]);

  // 3. Azione: Segna come letta e naviga
  const handleNotificationClick = async (notif: FeedItem) => {
    if (!notif.isRead && user) {
      try {
        const { doc, updateDoc, arrayUnion } = await import("firebase/firestore");
        const { getDb } = await import("@/services/db");
        const db = await getDb();
        
        if (notif.isGlobal) {
          // Se è un broadcast, aggiorniamo l'array sul documento utente
          const userRef = doc(db, "users", user.uid);
          updateDoc(userRef, { readBroadcasts: arrayUnion(notif.id) }).catch(console.error);
        } else {
          // Se è personale, aggiorniamo il documento della notifica
          const notifRef = doc(db, "notification", notif.id);
          updateDoc(notifRef, { isRead: true }).catch(console.error);
        }
      } catch (error) {
        console.error("Errore import dinamico Firestore", error);
      }
    }

    if (notif.link) {
      navigate(notif.link);
    }
  };

  // 4. Azione: Segna tutte come lette
  const markAllAsRead = async () => {
    const unreadPersonal = feedCompleto.filter(n => !n.isRead && !n.isGlobal);
    const unreadBroadcast = feedCompleto.filter(n => !n.isRead && n.isGlobal);
    
    if (unreadPersonal.length === 0 && unreadBroadcast.length === 0) return;

    // Aggiornamento ottimistico della UI
    setPersonalNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setReadBroadcastIds(prev => [...new Set([...prev, ...unreadBroadcast.map(b => b.id)])]);

    try {
      const { writeBatch, doc, updateDoc, arrayUnion } = await import("firebase/firestore");
      const { getDb } = await import("@/services/db");
      const db = await getDb();
      
      // 1. Aggiorniamo quelle personali tramite Batch
      if (unreadPersonal.length > 0) {
        const batch = writeBatch(db);
        unreadPersonal.forEach((notif) => {
          const notifRef = doc(db, "notification", notif.id);
          batch.update(notifRef, { isRead: true });
        });
        await batch.commit();
      }

      // 2. Aggiorniamo i broadcast aggiungendo in blocco gli ID al documento utente
      if (unreadBroadcast.length > 0 && user) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          readBroadcasts: arrayUnion(...unreadBroadcast.map(b => b.id))
        });
      }
    } catch (error) {
      console.error("Errore durante l'aggiornamento massivo", error);
    }
  };

  // Mappa le icone (aggiunto Megaphone per i broadcast)
  const getIconForType = (type: NotificationType, isRead: boolean, isGlobal?: boolean) => {
    const colorClass = isRead ? "text-(--color-muted)" : "text-(--color-text)";
    const size = 16;

    if (isGlobal) return <Megaphone size={size} className={colorClass} />;

    switch (type) {
      case "billing": return <CreditCard size={size} className={colorClass} />;
      case "team": return <Users size={size} className={colorClass} />;
      case "account": return <UserCircle size={size} className={colorClass} />;
      case "report": return <FileText size={size} className={colorClass} />;
      case "support": return <LifeBuoy size={size} className={colorClass} />;
      default: return <Info size={size} className={colorClass} />;
    }
  };

  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp || !timestamp.toDate) return "";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  };

  const unreadCount = feedCompleto.filter(n => !n.isRead).length;

  // Stato di caricamento
  if (authLoading || dbLoading) {
    return (
      <>
        <Helmet>
          <title>Caricamento notifiche... | Jurio</title>
        </Helmet>
        <div className="flex justify-center items-center h-64 text-(--color-muted) gap-2 bg-(--color-bg)">
          <Loader2 size={18} className="animate-spin text-(--color-text)" />
          <span className="text-xs font-bold uppercase tracking-widest">Caricamento notifiche...</span>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Helmet>
          <title>Accesso richiesto | Jurio</title>
        </Helmet>
        <div className="flex justify-center items-center h-64 text-(--color-muted) text-xs font-bold uppercase tracking-widest bg-(--color-bg)">
          Devi effettuare l'accesso per vedere le notifiche.
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>
          {unreadCount > 0 ? `(${unreadCount}) Notifiche` : "Notifiche"} | Jurio
        </title>
        <meta name="description" content="Visualizza gli aggiornamenti, le comunicazioni di servizio e le notifiche del tuo account." />
      </Helmet>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 bg-(--color-bg) text-(--color-text) min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) shadow-xs">
              <Bell size={20} className="opacity-80" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                Notifiche
              </h1>
              <p className="text-xs text-(--color-muted) font-light mt-0.5">
                Aggiornamenti e comunicazioni di servizio dal sistema.
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="bg-(--color-text) text-(--color-surface) text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-xs ml-2">
                {unreadCount} nuove
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button 
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors cursor-pointer outline-none"
            >
              <CheckCheck size={16} />
              <span>Segna tutte come lette</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {feedCompleto.length === 0 ? (
            <div className="relative p-12 text-center bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
              <Bell className="mx-auto text-(--color-muted) opacity-40 mb-3 mt-1" size={36} />
              <h3 className="text-sm sm:text-base font-medium text-(--color-text) mb-1" style={{ fontFamily: 'var(--font-serif)' }}>Nessuna notifica</h3>
              <p className="text-xs text-(--color-muted) font-light">Non hai ancora ricevuto aggiornamenti.</p>
            </div>
          ) : (
            feedCompleto.map((notif) => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notif)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(notif);
                    }
                  }}
                  className={`relative flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer shadow-xs overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-(--color-text) ${
                    notif.isRead 
                      ? "bg-(--color-surface) border-(--color-border) opacity-70" 
                      : "bg-(--color-surface) border-(--color-border)"
                  }`}
                >
                {!notif.isRead && (
                  <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
                )}

                <div className="p-2 rounded-md border border-(--color-border) bg-(--color-bg) shrink-0 mt-0.5 shadow-xs">
                  {getIconForType(notif.type, notif.isRead, notif.isGlobal)}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`text-xs sm:text-sm truncate tracking-tight ${notif.isRead ? 'font-light text-(--color-text)' : 'font-medium text-(--color-text)'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider text-(--color-muted) font-mono shrink-0">
                      {formatTime(notif.createdAt)}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 line-clamp-2 font-light ${notif.isRead ? 'text-(--color-muted)' : 'text-(--color-text)'}`}>
                    {notif.message}
                  </p>
                </div>

                <div className="shrink-0 self-center">
                   {notif.isRead ? (
                     <Check size={16} className="text-(--color-muted) opacity-50" />
                   ) : (
                     <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-text)">Controlla &rarr;</span>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}