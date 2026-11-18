import { initializeApp } from "firebase/app";
import type { AppCheck } from "firebase/app-check";
import { FIREBASE_CONFIG } from "../config/env";
import { setupAppCheck } from "./appCheck";

export const firebaseApp = initializeApp(FIREBASE_CONFIG);

export const appCheckInstance: AppCheck | undefined = setupAppCheck(firebaseApp);
