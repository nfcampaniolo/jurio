import { Navigate, useLocation } from "react-router-dom";
import { useContext, type ReactNode } from "react"; // <-- Aggiungi ReactNode
import { AuthContext } from "@/context/AuthContext";

// Sostituisci { children: JSX.Element } con { children: ReactNode }
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, hasConflict } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return null; 
  if (hasConflict) return <Navigate to="/sessione-attiva" replace />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children; // Ora accetterà qualsiasi figlio valido in React
};