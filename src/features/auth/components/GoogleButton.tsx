import { FcGoogle } from "react-icons/fc";
import { useGoogleAuthLogic } from "../hooks/useGoogleAuthLogic";

export function GoogleButton() {
  const { loading, error, handleGoogleLogin } = useGoogleAuthLogic();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        aria-busy={loading}
        aria-disabled={loading}
        className="
          flex items-center justify-center gap-3 p-3 rounded-xl mx-auto
          bg-white text-neutral-900
          border border-neutral-300
          hover:bg-neutral-100
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900
          transition
          disabled:opacity-60 disabled:cursor-not-allowed
        "
      >
        <FcGoogle size={22} aria-hidden="true" focusable={false} />
        <span className="font-medium">
          {loading ? "Caricamento..." : "Accedi con Google"}
        </span>
      </button>

      <div aria-live="polite" role="status" className="min-h-5">
        {error ? (
          <p className="text-sm text-red-700 text-center font-medium">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
