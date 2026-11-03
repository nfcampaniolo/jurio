import { Navigate, useLocation } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import { AuthLoader } from "./AuthLoader";
import { ErrorScreen } from "../shared/components/ErrorScreen"; // Sostituisci con il tuo componente di errore
import { useSmoothLoading } from "@/shared/hooks/useSmoothLoading";

export const ProtectedRoute = ({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) => {
  const { status, hasConflict, errorMessage } = useAuth();
  const location = useLocation();
  const showLoader = useSmoothLoading(status === 'loading');

  if (status === 'error') return <ErrorScreen message="Errore di connessione. Impossibile verificare l'identità." details={errorMessage} />;
  if (status === 'loading') return showLoader ? <>{fallback ?? <AuthLoader />}</> : null;
  if (hasConflict) return <Navigate to="/sessione-attiva" replace />;
  if (status === 'unauthenticated') return <Navigate to="/login" state={{ from: location }} replace />;

  return <>{children}</>;
};
