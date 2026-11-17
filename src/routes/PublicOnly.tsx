import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { AuthLoader } from "./AuthLoader";
import { ErrorScreen } from "../shared/components/ErrorScreen"; // Sostituisci con il tuo
import { useSmoothLoading } from "@/shared/hooks/useSmoothLoading";
import { needsEmailVerification } from "@/features/auth/hooks/auth";

interface PublicOnlyProps {
  children: ReactNode;
}

export const PublicOnly = ({ children }: PublicOnlyProps) => {
  const { user, status, errorMessage } = useAuth();
  const showLoader = useSmoothLoading(status === 'loading');
  
  if (status === 'error') return <ErrorScreen message="Errore di rete temporaneo." details={errorMessage} />;
  if (status === 'loading') return showLoader ? <AuthLoader /> : null;
  // Un account email non ancora verificato non viene spinto verso /profilo:
  // è il form di login/registrazione a decidere la destinazione (es. /verifica-email).
  if (status === 'authenticated' && !needsEmailVerification(user)) return <Navigate to="/profilo" replace />;
  
  return <>{children}</>;
};
