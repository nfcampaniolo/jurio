import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import type { Timestamp } from "firebase/firestore";
import type { JurioNotification } from "@/interfaces/interfaces";

// Tipo esportato per essere utilizzato anche nel componente UI
export type FeedItem = JurioNotification & { isGlobal?: boolean };

export function useNotifications() {
  const navigate = useNavigate();
  const { user, status } = useAuth();
  
  const authLoading = status === 'loading';
  
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
        const { getDb } = await import("@/infrastructure/db");
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

        // B. Avvisi Globali (Ultimi 30)
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

        // C. Profilo Utente
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

  // 2. Unione e Ordinamento del Feed
  const feedCompleto = useMemo<FeedItem[]>(() => {
    const mappedBroadcasts: FeedItem[] = broadcastNotifs.map(b => ({
      ...b,
      isGlobal: true,
      isRead: readBroadcastIds.includes(b.id)
    }));

    const mappedPersonal: FeedItem[] = personalNotifs.map(p => ({
      ...p,
      isGlobal: false
    }));

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
        const { getDb } = await import("@/infrastructure/db");
        const db = await getDb();
        
        if (notif.isGlobal) {
          const userRef = doc(db, "users", user.uid);
          updateDoc(userRef, { readBroadcasts: arrayUnion(notif.id) }).catch(console.error);
        } else {
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

    setPersonalNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setReadBroadcastIds(prev => [...new Set([...prev, ...unreadBroadcast.map(b => b.id)])]);

    try {
      const { writeBatch, doc, updateDoc, arrayUnion } = await import("firebase/firestore");
      const { getDb } = await import("@/infrastructure/db");
      const db = await getDb();
      
      if (unreadPersonal.length > 0) {
        const batch = writeBatch(db);
        unreadPersonal.forEach((notif) => {
          const notifRef = doc(db, "notification", notif.id);
          batch.update(notifRef, { isRead: true });
        });
        await batch.commit();
      }

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

  // Utility di formattazione temporale
  const formatTime = (timestamp: Timestamp) => {
    if (!timestamp || !timestamp.toDate) return "";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(date);
  };

  const unreadCount = feedCompleto.filter(n => !n.isRead).length;

  return {
    user,
    authLoading,
    dbLoading,
    feedCompleto,
    unreadCount,
    handleNotificationClick,
    markAllAsRead,
    formatTime
  };
}