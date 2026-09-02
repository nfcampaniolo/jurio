// File: src/context/AuthContext.ts
import { createContext } from "react";
type FirebaseUser = import("firebase/auth").User;

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  hasConflict: boolean; // <-- Aggiungi questo
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  hasConflict: false,
});