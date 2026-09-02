import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import {AuthLoader} from "./AuthLoader";

interface PublicOnlyProps {
  children: ReactNode;
}

export const PublicOnly = ({ children }: PublicOnlyProps) => {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  if (user) return <Navigate to="/profilo" replace />;
  return <>{children}</>;
};