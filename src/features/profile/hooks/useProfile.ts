import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, saveUserData, deleteUser, userExists, getRegisterPlanId, exportUserData } from "@/shared/services/user";
import { toast } from "react-hot-toast";
import type { UserData } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { logout } from "@/features/auth/hooks/auth";
import { deleteAccountFolder } from "@/shared/services/storage";
import { roleOptions } from "@/interfaces/interfaces";
import { trackEvent } from "@/infrastructure/analytics";

export const useProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [assignedTeamId, setAssignedTeamId] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [role, setRole] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [roleOther, setRoleOther] = useState<string>("");
  const [consents, setConsents] = useState({
    privacy: false,
    terms: false,
    comms: false,
    marketing: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const exists = await userExists(user.uid);
        if (!exists) {
          navigate("/registrati", { replace: true });
          return;
        }

        const data = await getUser(user.uid);
        const plan = await getRegisterPlanId(user.uid);
        if (cancelled) return;
        setPlanId(plan);
        setUserData(data);
        setName(data.name);
        setAssignedTeamId(data.assignedTeamId ?? null);
        setSurname(data.surname);
        setConsents(data.consents);
        setAvatar(user.photoURL || null);
        if (typeof data.role === "string" && data.role.trim()) {
          const roleValue = data.role.trim();
          const isStandardRole = roleOptions.some((opt) => opt.value === roleValue);
          if (isStandardRole) {
            setRole(roleValue);
            setRoleOther("");
          } else {
            setRole("altro");
            setRoleOther(roleValue);
          }
        } else {
          setRole("");
          setRoleOther("");
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          toast.error("Errore caricamento dati utente");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  // Carica avatar da Storage se l'avatar è un path (es. "users/uid/image.jpeg")
  useEffect(() => {
    if (!userData?.avatar) return;
    // se è già una URL http(s), non fare fetch
    if (userData.avatar.startsWith("http")) {
      setAvatar(userData.avatar);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Lazy import: non trascina firebase/storage nel bundle iniziale
        const [{ getStorageClient }, storageFns] = await Promise.all([
          import("@/infrastructure/storageClient"),
          import("firebase/storage"),
        ]);

        const storage = await getStorageClient();
        const { ref, getDownloadURL } = storageFns;
        const path = userData?.avatar;
        if (!path) return; // qui escludi null/undefined/""
        const url = await getDownloadURL(ref(storage, path));
        if (!cancelled) setAvatar(url);
      } catch (e) {
        if (!cancelled) console.error("Errore caricamento avatar da Storage", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userData?.avatar]);

  const handleConsentChange = (key: keyof typeof consents) =>
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    if (!name.trim() || !surname.trim()) return toast.error("Nome e cognome obbligatori");
    if (!consents.privacy || !consents.terms) return toast.error("Accetta privacy e termini");
    if (!user) return false;

    setSaving(true);
    try {
      let avatarPathOrUrl = avatar;

      if (avatarFile) {
        const { uploadAvatar } = await import("@/shared/services/storage");
        await uploadAvatar(avatarFile, user.uid);
        avatarPathOrUrl = `users/${user.uid}/image_1080x1080.jpeg`;
      }

      await saveUserData(user.uid, {
        name,
        surname,
        avatar: avatarPathOrUrl,
        consents,
        email: user.email,
      });

      setUserData((prev) =>
        prev
          ? { ...prev, name, surname, avatar: avatarPathOrUrl, consents, email: prev.email ?? null }
          : null
      );

      // tracking success
      trackEvent("profile_updated", { type: true });

      toast.success("Dati salvati correttamente");
      setAvatarFile(null);
      return true;
    } catch (e) {
      console.error(e);

      // tracking failure
      trackEvent("analytics_error", {
        name: "profile_updated",
        reason: e instanceof Error ? e.message : "unknown_error",
      });

      toast.error("Errore durante il salvataggio");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      await deleteAccountFolder(uid);
      await deleteUser(uid);
      await logout();
      toast.success("Profilo eliminato correttamente");
      navigate("/ricerca", { replace: true });
    } catch (error: unknown) {
      console.error("Errore eliminazione account:", error);
      const maybe = error as { code?: string; message?: string };
      if (maybe.code === "auth/requires-recent-login") {
        toast.error("Devi rifare il login per eliminare l'account.");
      } else {
        toast.error("Errore durante l'eliminazione del profilo.");
      }
    }
  };


  const exportAccount = async () => {
    if (!user) return;
    const uid = user.uid;
    try {
      await exportUserData(uid);
      toast.success("Profilo esportato correttamente");
    } catch (error: unknown) {
      console.error("Errore esportazione account:", error);
      const maybe = error as { code?: string; message?: string };
      if (maybe.code === "auth/requires-recent-login") {
        toast.error("Devi rifare il login per esportare l'account.");
      } else {
        toast.error("Errore durante l'esportazione del profilo.");
      }
    }
  };


  return {
    user,
    loading,
    userData,
    name,
    surname,
    avatar,
    avatarFile,
    consents,
    saving,
    assignedTeamId,
    setName,
    setSurname,
    setAvatar,
    setAvatarFile,
    setConsents,
    handleConsentChange,
    handleSave,
    deleteAccount,
    role,
    setRole,
    roleOther,
    setRoleOther,
    planId,
    exportAccount
  };
};