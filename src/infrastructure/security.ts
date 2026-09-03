import { firebaseApp } from "@/infrastructure/firebase";

export async function getCurrentUser() {
  const { getAuth } = await import("firebase/auth");

  const auth = getAuth(firebaseApp);
  return auth.currentUser;
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.uid ?? null;
}

export async function getSecurityTokens(): Promise<{
  authToken: string;
  appCheckToken: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Utente non autenticato");
  }

  const authToken = await user.getIdToken();

  let appCheckToken = "";

  try {
    const {
      initializeFirebaseAppCheck
    } = await import("@/infrastructure/appCheck");

    const appCheck = initializeFirebaseAppCheck();

    if (appCheck) {
      const { getToken } = await import("firebase/app-check");
      const response = await getToken(appCheck, false);
      appCheckToken = response.token;
    }
  } catch (error) {
    console.warn(
      "App Check token non disponibile:",
      error
    );
  }

  return {
    authToken,
    appCheckToken,
  };
}