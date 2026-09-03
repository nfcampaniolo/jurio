import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { fetchWithSecurity } from "@/config/apiClient";
import { getAssign } from "@/config/env";
import { getDb } from "@/infrastructure/db";
import { getAvatar } from "@/shared/services/storage";
import type { TeamMember } from "@/interfaces/interfaces";

export interface EnrichedTeamMember extends TeamMember {
  displayName: string;
  avatarUrl?: string;
}

export interface UseTeamMembersProps {
  teamId: string;
  currentUserUid: string;
}

const REMOVE_MEMBER_ENDPOINT = getAssign().REMOVE_MEMBER_ENDPOINT;

export function useTeamMembers({ teamId, currentUserUid }: UseTeamMembersProps) {
  const [members, setMembers] = useState<EnrichedTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      setLoading(true);
      try {
        const db = await getDb();
        if (!isMounted) return;

        const q = collection(db, `teams/${teamId}/members`);

        unsubscribe = onSnapshot(q, async (snapshot) => {
          const membersPromises = snapshot.docs.map(async (memberDoc) => {
            const uid = memberDoc.id;
            const memberData = memberDoc.data() as TeamMember;

            let displayName = memberData.email || uid;
            let avatarUrl: string | undefined = undefined;

            try {
              const userRef = doc(db, `users/${uid}`);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                const name = userData.name || "";
                const surname = userData.surname || "";

                if (name || surname) {
                  displayName = `${name} ${surname}`.trim();
                }
              }
              avatarUrl = await getAvatar(uid);
            } catch (err) {
              console.log(err);
            }

            return {
              ...memberData,
              uid,
              displayName,
              avatarUrl,
            } as EnrichedTeamMember;
          });

          const resolvedMembers = await Promise.all(membersPromises);

          if (isMounted) {
            setMembers(resolvedMembers);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error("Errore nel caricamento dei membri del team:", error);
        if (isMounted) setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [teamId]);

  const handleRoleChange = async (targetUid: string, newRole: string) => {
    if (targetUid === currentUserUid) {
      toast.error("Non puoi cambiare il tuo stesso ruolo!");
      return;
    }

    try {
      const db = await getDb();
      const memberRef = doc(db, `teams/${teamId}/members/${targetUid}`);
      await updateDoc(memberRef, { role: newRole });
      toast.success("Ruolo aggiornato con successo");
    } catch (e: unknown) {
      toast.error("Errore nell'aggiornamento. Controlla i permessi.");
      console.error(e);
    }
  };

  const getInitial = (nameStr?: string) => {
    if (!nameStr) return "?";
    return nameStr.charAt(0).toUpperCase();
  };

  const removeMember = async (uidDelete: string, revokeDocumentAccess: boolean) => {
    try {
      // 1. Chiamata HTTP tramite l'helper di sicurezza
      const response = await fetchWithSecurity(REMOVE_MEMBER_ENDPOINT, {
        teamId,
        uidDelete,
        revokeDocumentAccess,
      });
      const data = await response.json();

      // 2. Gestione Errori dal Backend
      if (!response.ok) {
        throw new Error(data.error || "Errore durante l'operazione sul server");
      }

      // 3. Aggiornamento UI ottimistico (solo dopo conferma server)
      setMembers((prevMembers) => prevMembers.filter((m) => m.uid !== uidDelete));

      // 4. Gestione Redirect post-abbandono
      if (uidDelete === currentUserUid) {
        navigate("/profilo");
      }
    } catch (error: unknown) {
      console.error("[removeMember] Error:", error);
      toast.error("Impossibile completare l'operazione");
      throw error;
    }
  };

  return {
    members,
    loading,
    handleRoleChange,
    getInitial,
    removeMember,
  };
}