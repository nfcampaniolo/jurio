import { FieldValue, DocumentReference } from "firebase-admin/firestore";
import { getDb} from "../_deps";
import { logSafeError } from "../_logging";

export async function applyTeamVisibility(
  docRef: DocumentReference, 
  data: any
): Promise<void> {
  
  // 1. Recuperiamo l'ID dell'utente dal documento appena creato
  const userId = data.user;
  if (!userId) {
    console.warn("Campo utente non trovato nel documento");
    return;
  }

  const db = getDb();
  
  try {
    // 2. Cerchiamo se esiste un team di cui questo utente fa parte
    const teamsQuery = await db.collection("teams")
      .where("member_ids", "array-contains", userId)
      .limit(1)
      .get();

    if (!teamsQuery.empty) {
      const teamDoc = teamsQuery.docs[0];
      const teamData = teamDoc.data();

      // 3. ORA facciamo il controllo sul campo del TEAM
      if (teamData.visibility_default === "team") {
        const teamMembers = teamData.member_ids || [];

        if (teamMembers.length > 0) {
          // 4. Il team è configurato per condividere: aggiungiamo i membri al documento
          await docRef.update({
            visibleTo: FieldValue.arrayUnion(...teamMembers)
          });
          console.log(`Visibilità team aggiornata per ${teamMembers.length} membri`);
        }
      } else {
        // L'utente ha un team, ma il team non ha come default la condivisione.
        console.log("Nessuna condivisione applicata: visibilità team non abilitata");
      }
    } else {
      console.log("Nessun team trovato per l'utente");
    }
  } catch (error) {
    logSafeError("TEAM_VISIBILITY_UPDATE_FAILED", error);
  }
}