export async function mcpFetch<T>(
  url: string,
  authHeader: string,
  body: object
): Promise<{ data?: T; errorText?: string; isError?: boolean }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (response.status === 401) {
      return {
        errorText: "Sessione Jurio non valida o scaduta. Ricollega il tuo account Jurio dalle impostazioni del client MCP.",
        isError: true,
      };
    }
    if (response.status === 403) {
      return {
        errorText: "Accesso non consentito: nessun piano attivo rilevato. Attiva o rinnova il tuo piano su: https://jurio.it/prezzi",
        isError: false,
      };
    }
    if (response.status === 404) {
      return {
        errorText: "Errore: Risorsa o documento non trovato nello storage.",
        isError: true,
      };
    }
    if (response.status === 429) {
      return {
        errorText: "Hai raggiunto il limite di richieste disponibili per il tuo piano. Riprova più tardi.",
        isError: false,
      };
    }

    const data = await response.json().catch(async () => ({ error: await response.text() }));

    if (!response.ok) {
      return {
        errorText: `Errore dal backend Jurio (${response.status}): ${data.error ?? response.statusText}`,
        isError: true,
      };
    }

    return { data: data as T };
  } catch (error) {
    return {
      errorText: `Errore di rete o timeout: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    };
  }
}