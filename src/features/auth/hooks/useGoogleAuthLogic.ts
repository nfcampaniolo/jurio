import { useState } from "react";
import { loginWithGoogle } from "./auth";
import { userExists } from "@/shared/services/user";
import { useUserStore } from "@/infrastructure/userStore";
import { useNavigate } from "react-router-dom";

export function useGoogleAuthLogic() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUser = useUserStore((s) => s.setUser);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await loginWithGoogle();
      setUser(user);
      const exists = await userExists(user.uid);
      if (exists) {
        navigate("/profilo");
      } else {
        navigate("/registrati");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Errore login con Google"
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    handleGoogleLogin,
  };
}