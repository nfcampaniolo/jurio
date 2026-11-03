import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { AuthLoader } from "./AuthLoader";
import { ErrorScreen } from "../shared/components/ErrorScreen"; // Sostituisci con il tuo
import { useSmoothLoading } from "@/shared/hooks/useSmoothLoading";

interface PublicOnlyProps {
  children: ReactNode;
}

export const PublicOnly = ({ children }: PublicOnlyProps) => {
  const { status, errorMessage } = useAuth();
  const showLoader = useSmoothLoading(status === 'loading');
  
  if (status === 'error') return <ErrorScreen message="Errore di rete temporaneo." details={errorMessage} />;
  if (status === 'loading') return showLoader ? <AuthLoader /> : null;
  if (status === 'authenticated') return <Navigate to="/profilo" replace />;
  
  return <>{children}</>;
};
