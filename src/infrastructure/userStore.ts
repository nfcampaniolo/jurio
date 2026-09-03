import { create } from 'zustand';
import { type User } from 'firebase/auth'; // Tipo utente Firebase

interface UserState {
  user: User | null;               // Stato dell'utente
  setUser: (user: User | null) => void; // Funzione per aggiornare lo stato
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));