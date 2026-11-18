import React, { useState } from "react";
import { Eye20Regular, EyeOff20Regular, Open16Regular } from "@fluentui/react-icons";
import { useLogin } from "./useLogin";
import { LOGO_URL, WEB_APP_URL } from "../config/env";

const LoginPage: React.FC = () => {
  const {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    validationErrors,
    handleLogin,
    browserLogin,
    handleBrowserLogin,
    reopenBrowser,
    cancelBrowserLogin,
  } = useLogin();
  const waiting = browserLogin.phase === "waiting";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="page-container login-page">
      <div className="login-brand">
        <img src={LOGO_URL} alt="" />
      </div>

      <div className="login-card">
        <div className="card-header-bar" />

        <div className="card-content">
          <div className="card-title">
            <h1>Accedi a Jurio</h1>
            <p>Accedi al tuo spazio di lavoro</p>
          </div>

          {waiting ? (
            <div className="browser-login waiting" role="status" aria-live="polite">
              <p className="browser-login-title">Conferma l&apos;accesso nel browser</p>
              <p className="browser-login-text">
                Su jurio.it verifica che il codice sia lo stesso e seleziona{" "}
                <strong>Autorizza Word</strong>.
              </p>
              <p
                className="browser-login-code"
                aria-label={`Codice ${browserLogin.code.split("").join(" ")}`}
              >
                {browserLogin.code}
              </p>
              <p className="browser-login-wait">
                <span className="loader-spinner-inline" aria-hidden />
                In attesa di conferma…
              </p>
              <div className="browser-login-actions">
                <button type="button" className="btn-secondary" onClick={reopenBrowser}>
                  <Open16Regular aria-hidden />
                  Riapri il browser
                </button>
                <button type="button" className="btn-link" onClick={cancelBrowserLogin}>
                  Annulla
                </button>
              </div>
            </div>
          ) : (
            <div className="browser-login">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleBrowserLogin()}
                disabled={browserLogin.phase === "starting" || loading}
              >
                <Open16Regular aria-hidden />
                {browserLogin.phase === "starting" ? "Apertura del browser…" : "Accedi con Jurio"}
              </button>
              <p className="browser-login-help">
                Si apre il browser: entra su jurio.it con Google, email o il metodo che usi di
                solito.
              </p>
            </div>
          )}

          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}

          <div className="divider">
            <span />
            <span>oppure con email e password</span>
            <span />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
            className="login-form"
            noValidate
          >
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nome@studio.it"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                aria-invalid={Boolean(validationErrors.email)}
                className={validationErrors.email ? "input-error" : ""}
              />
              {validationErrors.email && (
                <span className="validation-msg">{validationErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="La tua password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  aria-invalid={Boolean(validationErrors.password)}
                  className={validationErrors.password ? "input-error" : ""}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                >
                  {showPassword ? <EyeOff20Regular /> : <Eye20Regular />}
                </button>
              </div>
              {validationErrors.password && (
                <span className="validation-msg">{validationErrors.password}</span>
              )}
            </div>

            <div className="forgot-row">
              <a
                href={`${WEB_APP_URL}/reimposta-password`}
                target="_blank"
                rel="noopener noreferrer"
                className="link-quiet"
              >
                Password dimenticata?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading || waiting || !email || !password}
              className="btn-secondary"
            >
              {loading ? "Accesso in corso..." : "Accedi"}
            </button>

            <div className="login-footer">
              <a href={`${WEB_APP_URL}/registrati`} target="_blank" rel="noopener noreferrer">
                Crea un account
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
