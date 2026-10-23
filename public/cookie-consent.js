/**
 * Jurio — Custom Cookie Consent Manager
 * CMP self-hosted, zero dipendenze.
 *
 * Google Consent Mode v2 + Google Tag Manager.
 *
 * Ordine di esecuzione:
 * 1. consent default: tutto denied, tranne security_storage.
 * 2. Idratazione del consenso da localStorage.
 * 3. Caricamento del container GTM.
 *
 * Design: eredita i token del sito (--color-*, --font-*, --radius) quando
 * presenti; in caso contrario usa gli stessi valori come fallback, in modo
 * che il banner sia identico anche su pagine senza il foglio di stile globale.
 * Non carica font esterni: prima del consenso non deve partire nessuna
 * richiesta verso terze parti (Google Fonts incluso).
 *
 * API pubblica:
 * window.JurioCookieConsent.open()
 * window.JurioCookieConsent.get()
 * window.JurioCookieConsent.onChange(callback)
 */
(function () {
  "use strict";

  var CONFIG = {
    gtmId: "GTM-5PR3B8LS",
    storageKey: "custom_consent_settings",
    version: "1",
    maxAgeDays: 180,
    privacyUrl: "https://jurio.it/privacy",
    cookiePolicyUrl: "https://jurio.it/cookie",
    logoUrl: "https://jurio.it/logo.webp",
    openTriggerSelector: "#open-cookie-banner, [data-cookie-settings]"
  };

  var w = window;
  var d = document;

  if (w.JurioCookieConsent) return;

  var listeners = [];
  var gtmLoaded = false;
  var root = null;

  w.dataLayer = w.dataLayer || [];

  function gtag() {
    w.dataLayer.push(arguments);
  }

  /* =========================================================
     GOOGLE CONSENT MODE V2
     ========================================================= */

  function toSignals(state) {
    var analytics =
      state && state.analytics ? "granted" : "denied";

    var marketing =
      state && state.marketing ? "granted" : "denied";

    return {
      security_storage: "granted",
      analytics_storage: analytics,
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing
    };
  }

  /* =========================================================
     CONSENSO: LETTURA E PERSISTENZA
     ========================================================= */

  function readStored() {
    try {
      var raw = w.localStorage.getItem(CONFIG.storageKey);

      if (!raw) return null;

      var value = JSON.parse(raw);

      if (!value || value.version !== CONFIG.version) {
        return null;
      }

      if (
        typeof value.analytics !== "boolean" ||
        typeof value.marketing !== "boolean"
      ) {
        return null;
      }

      if (typeof value.timestamp !== "string") {
        return null;
      }

      var timestamp = Date.parse(value.timestamp);
      var now = Date.now();

      if (isNaN(timestamp) || timestamp > now) {
        return null;
      }

      if (now - timestamp > CONFIG.maxAgeDays * 864e5) {
        return null;
      }

      return {
        analytics: value.analytics,
        marketing: value.marketing,
        timestamp: value.timestamp,
        version: value.version
      };
    } catch (e) {
      return null;
    }
  }

  function writeStored(analytics, marketing) {
    var value = {
      analytics: !!analytics,
      marketing: !!marketing,
      timestamp: new Date().toISOString(),
      version: CONFIG.version
    };

    try {
      w.localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify(value)
      );
    } catch (e) {
      // localStorage potrebbe essere disabilitato.
    }

    return value;
  }

  /* =========================================================
     CANCELLAZIONE BEST-EFFORT DEI COOKIE DI TRACCIAMENTO
     ========================================================= */

  function deleteTrackingCookies() {
    var hostname = w.location.hostname;
    var hostParts = hostname.split(".");
    var domains = [hostname];
    var paths = ["/"];
    var pathParts = w.location.pathname.split("/");
    var currentPath = "";

    for (var i = 0; i < hostParts.length - 1; i++) {
      var domain = "." + hostParts.slice(i).join(".");

      if (domains.indexOf(domain) === -1) {
        domains.push(domain);
      }
    }

    for (var p = 1; p < pathParts.length; p++) {
      if (!pathParts[p]) continue;

      currentPath += "/" + pathParts[p];

      if (paths.indexOf(currentPath) === -1) {
        paths.push(currentPath);
      }
    }

    var cookieNames = d.cookie.split(";");

    cookieNames.forEach(function (cookie) {
      var name = cookie.split("=")[0].trim();

      if (
        !/^(_ga|_gid|_gat|_gcl_|_fbp|_fbc|_hj|_ttp|_tt_)/i.test(name)
      ) {
        return;
      }

      paths.forEach(function (path) {
        d.cookie =
          name +
          "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=" +
          path;

        domains.forEach(function (domain) {
          d.cookie =
            name +
            "=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=" +
            path +
            "; Domain=" +
            domain;
        });
      });
    });
  }

  /* =========================================================
     SINCRONIZZAZIONE CON GTM
     ========================================================= */

  function sync(state, previous) {
    gtag("consent", "update", toSignals(state));

    w.dataLayer.push({
      event: "consent_updated"
    });

    // Blocco preventivo: GTM viene caricato solo con almeno un consenso non essenziale.
    if (state.analytics || state.marketing) {
      loadGtm();
    }

    var revoked =
      previous &&
      (
        (previous.analytics && !state.analytics) ||
        (previous.marketing && !state.marketing)
      );

    if (revoked) {
      deleteTrackingCookies();
    }

    listeners.slice().forEach(function (listener) {
      try {
        listener(state);
      } catch (e) {
        // Un listener esterno non deve interrompere il CMP.
      }
    });
  }

  function loadGtm() {
    if (gtmLoaded) return;

    gtmLoaded = true;

    w.dataLayer.push({
      "gtm.start": new Date().getTime(),
      event: "gtm.js"
    });

    var script = d.createElement("script");

    script.async = true;
    script.src =
      "https://www.googletagmanager.com/gtm.js?id=" +
      encodeURIComponent(CONFIG.gtmId);

    (d.head || d.documentElement).appendChild(script);
  }

  /* =========================================================
     STILI UI — DESIGN SYSTEM JURIO
     I token locali (--jc-*) leggono quelli del sito e ripiegano
     sugli stessi valori se il foglio di stile globale non c'è.
     ========================================================= */

  function injectStyles() {
    if (d.getElementById("jc-style")) return;

    var style = d.createElement("style");

    style.id = "jc-style";

    style.textContent = [
      /* --- Token ------------------------------------------------ */
      "#jc-root{" +
        "--jc-bg:var(--color-surface,#ffffff);" +
        "--jc-bg-soft:var(--color-bg,#f5f6f7);" +
        "--jc-text:var(--color-text,#1a1d21);" +
        "--jc-muted:var(--color-muted,#5f6672);" +
        "--jc-border:var(--color-border,#d6d9de);" +
        "--jc-accent:var(--color-primary,#e0a32e);" +
        "--jc-accent-hover:var(--color-primary-hover,#f0b541);" +
        "--jc-on-accent:#1a1d21;" +
        "--jc-radius:var(--radius,18px);" +
        "--jc-shadow:0 24px 70px rgba(42,34,24,.20),0 2px 8px rgba(42,34,24,.06);" +
        "--jc-sans:var(--font-sans,'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif);" +
        "--jc-serif:var(--font-serif,'Lora','Merriweather',Georgia,'Times New Roman',serif);" +
        "color-scheme:light}",

      /* --- Contenitore ----------------------------------------- */
      "#jc-root{position:fixed;inset:auto 0 0;z-index:2147483000;display:flex;justify-content:center;align-items:flex-end;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));font-family:var(--jc-sans);color:var(--jc-text);pointer-events:none}",

      "#jc-root *{box-sizing:border-box}",

      /* --- Card ------------------------------------------------ */
      ".jc-card{pointer-events:auto;position:relative;width:100%;max-width:760px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain;background:var(--jc-bg);color:var(--jc-text);border:1px solid var(--jc-border);border-radius:var(--jc-radius);box-shadow:var(--jc-shadow);padding:26px 28px 24px;font-size:14px;line-height:1.6;isolation:isolate;-webkit-font-smoothing:antialiased}",

      ".jc-card:before{content:'';position:absolute;inset:0 0 auto;height:3px;background:var(--jc-accent);border-radius:var(--jc-radius) var(--jc-radius) 0 0}",

      /* --- Header ---------------------------------------------- */
      ".jc-header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid var(--jc-border)}",

      ".jc-brand{display:flex;align-items:center;min-width:0}",

      ".jc-logo{display:block;height:28px;width:auto;max-width:160px;object-fit:contain}",

      ".jc-wordmark{font-family:var(--jc-serif);font-size:20px;font-weight:600;letter-spacing:.02em;color:var(--jc-text)}",

      ".jc-close{display:flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;border:1px solid var(--jc-border);border-radius:10px;background:transparent;color:var(--jc-muted);font:inherit;font-size:20px;line-height:1;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease}",

      ".jc-close:hover{background:var(--jc-bg-soft);border-color:var(--jc-muted);color:var(--jc-text)}",

      ".jc-back{border:0;background:transparent;color:var(--jc-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:8px 0 8px 8px;white-space:nowrap;text-decoration:underline;text-decoration-color:var(--jc-accent);text-decoration-thickness:2px;text-underline-offset:4px}",

      ".jc-back:hover{text-decoration-color:var(--jc-text)}",

      /* --- Testi ----------------------------------------------- */
      ".jc-title{margin:0 0 8px;font-family:var(--jc-serif);font-size:clamp(21px,2.4vw,25px);font-weight:600;line-height:1.2;letter-spacing:-.01em;color:var(--jc-text)}",

      ".jc-copy{margin:0;max-width:66ch;color:var(--jc-muted);font-size:13px;line-height:1.55}",

      ".jc-note{display:flex;align-items:flex-start;gap:8px;margin-top:14px;padding:8px 10px;border:1px solid var(--jc-border);border-left:3px solid var(--jc-accent);border-radius:8px;background:var(--jc-bg-soft);color:var(--jc-muted);font-size:11.5px;line-height:1.45}",

      ".jc-legal-links{display:inline-flex;flex-wrap:wrap;align-items:center;gap:7px;margin-left:2px}",

      ".jc-legal-links a{color:var(--jc-text);font-weight:600;text-decoration:underline;text-decoration-color:var(--jc-accent);text-decoration-thickness:2px;text-underline-offset:3px}",

      ".jc-legal-links a:hover{text-decoration-color:var(--jc-text)}",

      /* --- Azioni ---------------------------------------------- */
      ".jc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}",

      ".jc-btn{display:inline-flex;align-items:center;justify-content:center;flex:1 1 150px;min-width:0;min-height:42px;padding:10px 14px;border:1px solid var(--jc-text);border-radius:10px;background:var(--jc-text);color:var(--jc-bg);font:inherit;font-size:13px;font-weight:600;line-height:1.3;text-align:center;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease,transform .16s ease}",

      ".jc-btn:hover{background:var(--jc-accent);border-color:var(--jc-accent);color:var(--jc-on-accent)}",

      ".jc-btn:active{transform:translateY(1px)}",

      ".jc-btn--ghost{background:var(--jc-bg-soft);border-color:var(--jc-muted);color:var(--jc-text)}",

      ".jc-btn--ghost:hover{background:var(--jc-bg-soft);border-color:var(--jc-text);color:var(--jc-text)}",

      ".jc-btn:focus-visible,.jc-close:focus-visible,.jc-back:focus-visible,.jc-switch:focus-visible,.jc-legal-links a:focus-visible{outline:3px solid var(--jc-accent);outline-offset:3px}",

      ".jc-btn--accept{background:var(--jc-accent);border-color:var(--jc-accent);color:var(--jc-on-accent);font-weight:700}",

      ".jc-btn--accept:hover{background:var(--jc-accent-hover);border-color:var(--jc-accent-hover);color:var(--jc-on-accent)}",
      
      /* --- Preferenze ------------------------------------------ */
      ".jc-settings-intro{margin-bottom:20px}",

      ".jc-section-label{margin:0 0 8px;color:var(--jc-text);font-size:13px;font-weight:700}",

      ".jc-preferences{border-top:1px solid var(--jc-border)}",

      ".jc-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 2px;border-bottom:1px solid var(--jc-border)}",

      ".jc-row-copy{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0;cursor:pointer}",

      ".jc-row--required .jc-row-copy{cursor:default}",

      ".jc-row-title{font-size:14px;font-weight:600;line-height:1.35;color:var(--jc-text)}",

      ".jc-row-description{max-width:56ch;color:var(--jc-muted);font-size:12.5px;line-height:1.55}",

      ".jc-always{display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:28px;padding:5px 11px;border:1px solid var(--jc-border);border-radius:999px;background:var(--jc-bg-soft);color:var(--jc-muted);font-size:12px;font-weight:600;white-space:nowrap}",

      ".jc-switch{position:relative;appearance:none;-webkit-appearance:none;display:block;flex:none;width:46px;height:26px;margin:0;border:1px solid var(--jc-border);border-radius:999px;background:var(--jc-bg-soft);cursor:pointer;transition:background .18s ease,border-color .18s ease}",

      ".jc-switch:before{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:var(--jc-muted);transition:transform .18s ease,background .18s ease}",

      ".jc-switch:checked{border-color:var(--jc-accent);background:var(--jc-accent)}",

      ".jc-switch:checked:before{transform:translateX(20px);background:var(--jc-on-accent)}",

      ".jc-settings-footer{margin-top:14px;color:var(--jc-muted);font-size:12px;line-height:1.5}",

      /* --- Responsive ------------------------------------------ */
      "@media(max-width:560px){#jc-root{padding:10px;padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}.jc-card{width:100%;max-height:calc(100vh - 20px);max-height:calc(100dvh - 20px);padding:20px 16px 16px}.jc-header{margin-bottom:16px;padding-bottom:12px}.jc-logo{height:24px}.jc-copy{font-size:12.5px}.jc-actions{display:grid;grid-template-columns:1fr;gap:7px;margin-top:16px}.jc-btn{width:100%}.jc-row{gap:12px;padding:13px 0}.jc-row-description{font-size:12px}}",

      "@media(max-width:370px){.jc-card{padding-left:14px;padding-right:14px}.jc-row{align-items:flex-start}.jc-switch{margin-top:4px}}",

      "@media(prefers-reduced-motion:reduce){.jc-card{animation:none}.jc-btn,.jc-close,.jc-switch,.jc-switch:before{transition:none}}",
      /* --- Tema scuro: segue la preferenza di sistema ---------- */
      "@media(prefers-color-scheme:dark){" +
        "#jc-root{" +
          "--jc-bg:var(--color-surface,#1a1a1a);" +
          "--jc-bg-soft:var(--color-bg,#111111);" +
          "--jc-text:var(--color-text,#e6e7ea);" +
          "--jc-muted:var(--color-muted,#a1a7b0);" +
          "--jc-border:var(--color-border,#2e2e2e);" +
          "--jc-shadow:0 24px 70px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.35);" +
          "color-scheme:dark}" +
        ".jc-btn:hover{background:var(--jc-accent);border-color:var(--jc-accent);color:var(--jc-on-accent)}" +
        ".jc-btn--ghost:hover{background:#242424}" +
      "}"
    ].join("\n");

    d.head.appendChild(style);
  }

  /* =========================================================
     UI: UTILITY
     ========================================================= */

  function closeUi() {
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }

    root = null;
  }

  function save(analytics, marketing) {
    var previous = readStored();
    var state = writeStored(analytics, marketing);

    closeUi();
    sync(state, previous);
  }

  function el(tag, attrs, text) {
    var node = d.createElement(tag);

    Object.keys(attrs || {}).forEach(function (key) {
      node.setAttribute(key, attrs[key]);
    });

    if (text !== undefined && text !== null) {
      node.textContent = text;
    }

    return node;
  }

  function button(label, onClick, variant) {
    var className = "jc-btn";

    if (variant === "ghost") {
      className += " jc-btn--ghost";
    } else if (variant === "accept") {
      className += " jc-btn--accept";
    }

    var node = el("button", {
      type: "button",
      class: className
    }, label);

    node.addEventListener("click", onClick);

    return node;
  }

  function appendPolicyLinks(parent) {
    var links = el("span", {
      class: "jc-legal-links"
    });

    links.appendChild(
      el(
        "a",
        { href: CONFIG.cookiePolicyUrl },
        "Cookie policy"
      )
    );

    links.appendChild(
      el("span", { "aria-hidden": "true" }, "·")
    );

    links.appendChild(
      el(
        "a",
        { href: CONFIG.privacyUrl },
        "Privacy policy"
      )
    );

    parent.appendChild(links);
  }

  /* =========================================================
     UI: HEADER
     ========================================================= */

  function buildLogo() {
    var brand = el("div", {
      class: "jc-brand"
    });

    var img = el("img", {
      class: "jc-logo",
      src: CONFIG.logoUrl,
      alt: "Jurio",
      height: "28",
      decoding: "async"
    });

    // Se il logo non è raggiungibile, ripiega sul wordmark testuale.
    img.addEventListener("error", function () {
      if (img.parentNode) {
        img.parentNode.replaceChild(
          el("span", { class: "jc-wordmark" }, "Jurio"),
          img
        );
      }
    });

    brand.appendChild(img);

    return brand;
  }

  function appendBrand(header, showSettings) {
    header.appendChild(buildLogo());

    if (showSettings) {
      var back = el(
        "button",
        {
          type: "button",
          class: "jc-back"
        },
        "← Torna al banner"
      );

      back.addEventListener("click", function () {
        render(false);
      });

      header.appendChild(back);
    } else {
      var close = el(
        "button",
        {
          type: "button",
          class: "jc-close",
          "aria-label": "Rifiuta i cookie non necessari e chiudi"
        },
        "×"
      );

      close.addEventListener("click", function () {
        save(false, false);
      });

      header.appendChild(close);
    }
  }

  /* =========================================================
     UI: CATEGORIE
     ========================================================= */

  function requiredRow() {
    var row = el("div", {
      class: "jc-row jc-row--required"
    });

    var copy = el("div", {
      class: "jc-row-copy"
    });

    copy.appendChild(
      el("span", {
        class: "jc-row-title"
      }, "Cookie necessari")
    );

    copy.appendChild(
      el("span", {
        class: "jc-row-description"
      }, "Essenziali per sicurezza, sessione e funzionamento del servizio.")
    );

    row.appendChild(copy);

    row.appendChild(
      el("span", {
        class: "jc-always"
      }, "Sempre attivi")
    );

    return row;
  }

  function toggleRow(id, title, description, checked) {
    var row = el("div", {
      class: "jc-row"
    });

    var label = el("label", {
      class: "jc-row-copy",
      for: id
    });

    label.appendChild(
      el("span", {
        class: "jc-row-title"
      }, title)
    );

    label.appendChild(
      el("span", {
        class: "jc-row-description"
      }, description)
    );

    var input = el("input", {
      id: id,
      type: "checkbox",
      class: "jc-switch",
      role: "switch",
      "aria-label": title
    });

    input.checked = !!checked;

    row.appendChild(label);
    row.appendChild(input);

    return row;
  }

  /* =========================================================
     UI: RENDER
     ========================================================= */

  function render(showSettings) {
    if (!d.body) {
      onReady(function () {
        render(showSettings);
      });

      return;
    }

    injectStyles();
    closeUi();

    var current = readStored();

    root = el("div", {
      id: "jc-root"
    });

    var card = el("section", {
      class: "jc-card",
      role: "dialog",
      "aria-modal": "false",
      "aria-labelledby": "jc-title",
      "aria-describedby": "jc-description"
    });

    var header = el("div", {
      class: "jc-header"
    });

    appendBrand(header, showSettings);
    card.appendChild(header);

    if (!showSettings) {
      card.appendChild(
        el(
          "h2",
          {
            id: "jc-title",
            class: "jc-title"
          },
          "La tua privacy, alle tue condizioni"
        )
      );

      var intro = el(
        "p",
        {
          id: "jc-description",
          class: "jc-copy"
        },
        "Jurio utilizza cookie tecnici per il funzionamento del servizio. Con il tuo consenso possiamo attivare strumenti di analisi e tecnologie pubblicitarie. Puoi accettare, rifiutare o personalizzare le categorie; potrai modificare la scelta in qualsiasi momento. "
      );

      appendPolicyLinks(intro);
      card.appendChild(intro);

      card.appendChild(
        el(
          "div",
          {
            class: "jc-note"
          },
          "I cookie non necessari restano disattivati finché non esprimi una scelta."
        )
      );

      // "Accetta solo essenziali" e "Accetta tutti" hanno lo stesso peso visivo.
      var actions = el("div", {
        class: "jc-actions"
      });

      actions.appendChild(
        button("Accetta solo essenziali", function () {
          save(false, false);
        }, "ghost")
      );

      actions.appendChild(
        button("Accetta tutti", function () {
          save(true, true);
        }, "accept")
      );

      actions.appendChild(
        button("Personalizza", function () {
          render(true);
        }, "ghost")
      );
      card.appendChild(actions);
    } else {
      card.appendChild(
        el(
          "h2",
          {
            id: "jc-title",
            class: "jc-title"
          },
          "Preferenze cookie"
        )
      );

      var introSettings = el(
        "p",
        {
          id: "jc-description",
          class: "jc-copy jc-settings-intro"
        },
        "Scegli quali categorie autorizzare. I cookie necessari al funzionamento e alla sicurezza del servizio restano sempre attivi. "
      );

      appendPolicyLinks(introSettings);
      card.appendChild(introSettings);

      card.appendChild(
        el("p", {
          class: "jc-section-label"
        }, "Categorie di cookie")
      );

      var preferences = el("div", {
        class: "jc-preferences"
      });

      preferences.appendChild(requiredRow());

      preferences.appendChild(
        toggleRow(
          "jc-an",
          "Cookie analitici",
          "Ci aiutano a comprendere come viene utilizzato il sito e a migliorarne l'esperienza.",
          !!(current && current.analytics)
        )
      );

      preferences.appendChild(
        toggleRow(
          "jc-mk",
          "Pubblicitari e profilazione",
          "Consentono la misurazione delle campagne e, ove previsto, la personalizzazione degli annunci.",
          !!(current && current.marketing)
        )
      );

      card.appendChild(preferences);

      card.appendChild(
        el(
          "div",
          {
            class: "jc-settings-footer"
          },
          "Puoi aggiornare le preferenze in qualunque momento dalle impostazioni cookie."
        )
      );

      var settingsActions = el("div", {
        class: "jc-actions"
      });

      settingsActions.appendChild(
        button("Accetta solo essenziali", function () {
          save(false, false);
        }, "ghost")
      );

      settingsActions.appendChild(
        button("Accetta tutti", function () {
          save(true, true);
        }, "accept")
      );

      settingsActions.appendChild(
        button("Salva preferenze", function () {
          var analyticsInput = d.getElementById("jc-an");
          var marketingInput = d.getElementById("jc-mk");

          save(
            !!(analyticsInput && analyticsInput.checked),
            !!(marketingInput && marketingInput.checked)
          );
        })
      );

      card.appendChild(settingsActions);
    }

    root.appendChild(card);
    d.body.appendChild(root);

    if (showSettings) {
      var firstToggle = d.getElementById("jc-an");

      if (firstToggle) {
        firstToggle.focus();
      }
    }
  }

  function onReady(callback) {
    if (d.body) {
      callback();
    } else {
      d.addEventListener("DOMContentLoaded", callback);
    }
  }

  /* =========================================================
     API PUBBLICA
     ========================================================= */

  w.JurioCookieConsent = {
    open: function () {
      onReady(function () {
        render(true);
      });
    },

    get: readStored,

    onChange: function (callback) {
      if (typeof callback !== "function") {
        return function () {};
      }

      listeners.push(callback);

      return function unsubscribe() {
        var index = listeners.indexOf(callback);

        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }
  };

  /* =========================================================
     TRIGGER DELEGATO
     Funziona anche con elementi aggiunti dinamicamente.
     ========================================================= */

  d.addEventListener("click", function (event) {
    var target = event.target;

    var trigger =
      target && target.closest
        ? target.closest(CONFIG.openTriggerSelector)
        : null;

    if (trigger) {
      event.preventDefault();
      w.JurioCookieConsent.open();
    }
  });

  /* =========================================================
     BOOTSTRAP — ORDINE RIGOROSO
     ========================================================= */

  // 1. Imposta i valori di default prima del caricamento di GTM.
  gtag("consent", "default", {
    security_storage: "granted",
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500
  });

  gtag("set", "ads_data_redaction", true);

  // 2. Idrata il consenso eventualmente salvato.
  var stored = readStored();

  if (stored) {
    sync(stored, null);
  } else {
    deleteTrackingCookies();
  }

  // 3. GTM viene caricato da sync() solo dopo il consenso.

  // 4. Se non esiste un consenso valido, mostra il banner.
  if (!stored) {
    onReady(function () {
      render(false);
    });
  }
})();