import { FieldValue, DocumentReference } from "firebase-admin/firestore";
import { getDb} from "../_deps";

export async function applyTeamVisibility(
  docRef: DocumentReference, 
  data: any, 
  userIdField: string
): Promise<void> {
  
  // 1. Recuperiamo l'ID dell'utente dal documento appena creato
  const userId = data[userIdField];
  if (!userId) {
    console.warn(`Campo utente '${userIdField}' non trovato nel doc ${docRef.id}`);
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
          console.log(`Aggiunti ${teamMembers.length} membri a visibleTo per ${docRef.path}`);
        }
      } else {
        // L'utente ha un team, ma il team non ha come default la condivisione.
        console.log(`Il team ${teamDoc.id} ha visibility_default = "${teamData.visibility_default}". Nessuna condivisione applicata.`);
      }
    } else {
      console.log(`Nessun team trovato per l'utente ${userId}`);
    }
  } catch (error) {
    console.error(`Errore in applyTeamVisibility per ${docRef.path}:`, error);
  }
}