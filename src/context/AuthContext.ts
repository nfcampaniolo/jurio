import { createContext } from "react";
import type { User } from "firebase/auth";

export interface AuthContextType {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error';
  hasConflict: boolean;
  errorMessage: string | null;
  resolveConflict: () => void; // Aggiunto per azzerare il conflitto all'istante
  /** Ricarica l'utente da Firebase (es. dopo la verifica email) e forza il re-render. */
  refreshUser: () => Promise<User | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);