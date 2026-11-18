import React from "react";
import { LockClosed16Regular } from "@fluentui/react-icons";

/** Informativa sintetica sul trattamento del documento. Deve restare allineata al comportamento reale. */
export const PrivacyNote: React.FC = () => (
  <details className="privacy-note">
    <summary>
      <LockClosed16Regular aria-hidden />
      Riservatezza dei documenti
    </summary>
    <ul>
      <li>
        Il testo inviato serve solo a rispondere alla richiesta: non viene salvato sui server Jurio
        né usato per addestrare modelli.
      </li>
      <li>
        L&apos;elaborazione AI avviene su Google Vertex AI nell&apos;Unione Europea; nomi, email e
        altri dati personali vengono pseudonimizzati prima dell&apos;invio.
      </li>
      <li>
        Le interrogazioni di ricerca, prive dei dati personali, sono indicizzate tramite il servizio
        di embedding di OpenAI; la revisione può svolgere verifiche sul web con le stesse cautele.
      </li>
      <li>
        La dettatura vocale è trascritta da Google Speech-to-Text nell&apos;Unione Europea;
        l&apos;audio non viene conservato.
      </li>
      <li>
        L&apos;add-in non conserva il documento sul dispositivo: il contenuto del pannello si
        cancella alla chiusura o all&apos;uscita.
      </li>
      <li>Nessuna modifica viene applicata al documento senza la tua conferma.</li>
    </ul>
  </details>
);
