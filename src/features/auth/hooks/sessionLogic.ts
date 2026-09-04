import { getAuthClient } from "./auth";
import { signOut } from "firebase/auth";

export async function forceSessionTakeover() {
  const auth = await getAuthClient();
  const user = auth.currentUser;
  
  if (!user) throw new Error("no_user");

  try {
    // 1. JWT
    const idToken = await user.getIdToken();
    
    // 2. AppCheck
    const { getToken } = await import("firebase/app-check");
    const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
    
    const appCheckInstance = initializeFirebaseAppCheck();
    let appCheckToken = "";
    
    if (appCheckInstance) {
      const appCheckData = await getToken(appCheckInstance, false);
      appCheckToken = appCheckData.token;
    }

    const response = await fetch(`https://forcetakeoversession-vqoobrenua-ew.a.run.app`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "X-Firebase-AppCheck": appCheckToken
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem('active_session_id', data.newSessionId);

  } catch (error) {
    console.error("Errore durante il takeover della sessione:", error);
    throw error; 
  }
}

export async function clearLocalSession() {
  const auth = await getAuthClient();
  localStorage.removeItem('active_session_id');
  await signOut(auth);
}