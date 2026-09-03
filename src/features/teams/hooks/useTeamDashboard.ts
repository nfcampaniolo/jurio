import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";
import { useAuth } from "@/context/useAuth";
import type { Team } from "@/interfaces/interfaces";

export function useTeamDashboard() {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const setupTeamSubscription = async () => {
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const db = await getDb();
        if (!isMounted) return;

        const q = query(
          collection(db, "teams"),
          where("member_ids", "array-contains", user.uid)
        );

        unsubscribe = onSnapshot(q, async (snapshot) => {
          if (snapshot.empty) {
            if (isMounted) {
              setTeam(null);
              setLoading(false);
            }
            return;
          }

          const teamDoc = snapshot.docs[0];
          const teamData = { id: teamDoc.id, ...teamDoc.data() } as Team;

          if (isMounted) setTeam(teamData);

          try {
            const memberRef = doc(db, `teams/${teamDoc.id}/members/${user.uid}`);
            const memberSnap = await getDoc(memberRef);

            if (isMounted) {
              if (memberSnap.exists()) {
                setMyRole(memberSnap.data().role);
              }
              setLoading(false);
            }
          } catch (err) {
            console.error("Errore durante la lettura del ruolo:", err);
            if (isMounted) setLoading(false);
          }
        });
      } catch (error) {
        console.error("Errore nell'inizializzazione del team:", error);
        if (isMounted) setLoading(false);
      }
    };

    setupTeamSubscription();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const isManager = Boolean(
    user &&
      team &&
      (myRole === "owner" ||
        myRole === "co-owner" ||
        team.owners?.includes(user.uid))
  );

  return {
    user,
    team,
    loading,
    isManager,
  };
}