import { Link } from 'react-router-dom';

export default function PianiLicenze() {
  return (
    <div className="space-y-8">
      {/* Intestazione Sezione */}
      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-md font-bold tracking-widest text-(--color-text) uppercase bg-(--color-surface) border border-(--color-border) px-2.5 py-1 rounded-sm shadow-xs">
            3. Account
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-surface) border border-(--color-border) px-2.5 py-0.5 rounded-sm shadow-xs">
            Abbonamenti & Tariffe
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-medium text-(--color-text) tracking-tight mt-1 mb-2.5" >
          Piani e Licenze d'Uso
        </h1>
        <p className="text-md  text-(--color-muted) font-light leading-relaxed">
          L'accesso alle funzionalità della piattaforma è strutturato mediante l'acquisto di <strong className="font-semibold text-(--color-text)">licenze a tempo determinato</strong>, disponibili con durata mensile o annuale. A differenza dei classici abbonamenti, il servizio <strong className="font-semibold text-(--color-text)">non prevede alcun rinnovo automatico</strong>: alla scadenza non viene effettuato alcun addebito.
        </p>
      </div>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 1: I Piani Disponibili */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            I Piani Disponibili
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            L'offerta si articola in due profili pensati per differenti esigenze operative:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card Piano Essential */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Ricerca & Consultazione
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Piano Essential</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Il profilo dedicato alla ricerca e alla consultazione giuridica nomofilattica.
            </p>
            <ul className="text-md text-(--color-muted) font-light space-y-2 pt-2 border-t border-(--color-border) leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Accesso illimitato alla banca dati delle Corti Supreme (Cassazione, Consiglio di Stato, Corte Costituzionale).</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Analisi strutturale del nomofilattico e repertorio massime.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Ricerca semantica multilivello e strumenti di raffinamento.</span>
              </li>
            </ul>
          </div>

          {/* Card Piano Business */}
          <div className="relative p-5 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <span className="inline-block text-md font-bold text-(--color-text) uppercase tracking-widest bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs mt-1">
              Suite Completa AI
            </span>
            <h3 className="text-sm sm:text-base font-medium text-(--color-text) tracking-tight" >Piano Business</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              La soluzione completa concepita per studi legali e dipartimenti aziendali.
            </p>
            <ul className="text-md text-(--color-muted) font-light space-y-2 pt-2 border-t border-(--color-border) leading-relaxed">
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Tutti i vantaggi inclusi nel piano Essential.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Archivio cloud riservato con acquisizione intelligente documenti (OCR, audio MP3, Word, PDF).</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Consulente Legale, gestione fascicoli di studio e thread persistenti.</span>
              </li>
              <li className="flex items-start">
                <span className="text-(--color-text) mr-2 font-bold">•</span>
                <span>Verifica coerenza tra atti e giurisprudenza, redazione assistita e assistenza tecnica prioritaria.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* --- PLACEHOLDER IMMAGINE 1 (Pricing Table & Piani) --- */}
        <div className="my-4">
          <div className="flex justify-center">
            <img
              src="https://jurio.it/guida-image/piani.webp"
              alt="Schermata di autenticazione con opzione Single Sign-On e recupero credenziali"
              loading="lazy"
            />
          </div>
          <p className="text-md text-(--color-muted) font-light mt-2 text-center italic">
            Figura 1: Schermata comparativa dei piani e selezione della frequenza di acquisto.
          </p>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 2: Durata e Tariffe */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Durata e Tariffe
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Tutti i prezzi sono indicati con <strong className="font-semibold text-(--color-text)">IVA inclusa</strong>. È possibile scegliere tra licenza mensile o annuale (con sensibile risparmio sul totale).
          </p>
        </div>

        {/* Tabella Comparativa Prezzi */}
        <div className="overflow-x-auto border border-(--color-border) rounded-lg bg-(--color-surface) shadow-xs">
          <table className="min-w-full text-md text-left">
            <thead className="bg-(--color-bg) border-b border-(--color-border) text-(--color-text) font-bold uppercase tracking-widest text-[10px]">
              <tr>
                <th className="py-3 px-4">Piano</th>
                <th className="py-3 px-4">Formula Mensile</th>
                <th className="py-3 px-4">Formula Annuale</th>
                <th className="py-3 px-4">Note Promozionali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border) text-(--color-muted) font-light">
              <tr>
                <td className="py-3.5 px-4 font-bold text-(--color-text)">Essential</td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-(--color-text)">12,20 €</span>
                  <span className="block text-[10px] text-(--color-text) font-medium mt-0.5">Promo 1° mese: 6,10 € (-50%)</span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-(--color-text)">61,00 €</span>
                  <span className="block text-[10px] text-(--color-muted) line-through mt-0.5">Listino 146,40 €</span>
                </td>
                <td className="py-3.5 px-4 text-(--color-text) font-medium">Sconto del 58% su base annua</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-(--color-text)">Business</td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-(--color-text)">48,80 €</span>
                  <span className="block text-[10px] text-(--color-text) font-medium mt-0.5">Promo 1° mese: 24,40 € (-50%)</span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-bold text-(--color-text)">244,00 €</span>
                  <span className="block text-[10px] text-(--color-muted) line-through mt-0.5">Listino 585,60 €</span>
                </td>
                <td className="py-3.5 px-4 text-(--color-text) font-medium">Risparmio dedicato sul canone complessivo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 3: Gestione dell'Account e Scadenza della Licenza */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Gestione dell'Account e Scadenza della Licenza
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Per verificare lo stato della propria licenza o procedere a un nuovo acquisto, accedi all'area personale cliccando sull'icona del profilo in alto a destra nell'header.
          </p>
        </div>

        <div className="relative p-5 sm:p-6 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden space-y-3">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <h3 className="text-md font-bold uppercase tracking-wider text-(--color-text) mt-1">Cosa succede alla scadenza del periodo acquistato:</h3>
          <ul className="text-md text-(--color-muted) font-light space-y-2 leading-relaxed">
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Nessun Addebito Imprevisto:</strong> La licenza si chiude senza rinnovi automatici sulla carta di credito.</span>
            </li>
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Protezione e Custodia dei Dati:</strong> Le funzioni avanzate vengono temporaneamente sospese, ma tutti i documenti elaborati, le annotazioni e i fascicoli restano custoditi in totale sicurezza nel proprio archivio privato.</span>
            </li>
            <li className="flex items-start">
              <span className="text-(--color-text) mr-2 font-bold">•</span>
              <span><strong className="font-semibold text-(--color-text)">Ripristino Immediato:</strong> Acquistando una nuova licenza in qualsiasi momento, l'intero archivio e la piena operatività tornano istantaneamente accessibili.</span>
            </li>
          </ul>
        </div>
      </section>

      <hr className="border-(--color-border)" />

      {/* SEZIONE 4: Modalità di Pagamento e Fatturazione */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight mb-1.5" >
            Modalità di Pagamento e Fatturazione Elettronica
          </h2>
          <p className="text-md  text-(--color-muted) font-light leading-relaxed">
            Tutte le transazioni economiche sono elaborate tramite il circuito <strong className="font-semibold text-(--color-text)">Stripe</strong>, a garanzia dei massimi standard di sicurezza informatica e conformità <strong className="font-semibold text-(--color-text)">PCI DSS</strong>. I dati delle carte di credito o debito vengono gestiti direttamente dal gateway in forma cifrata, senza mai transitare né risiedere sui server della piattaforma.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Metodi di Pagamento Ammessi</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              Pagamento sicuro con carta di credito o debito via Stripe. <em>Non sono previsti addebiti diretti SEPA ricorrenti, né pagamenti tramite PayPal, bonifici manuali o Carta del Docente.</em>
            </p>
          </div>

          <div className="relative p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs space-y-1 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-(--color-primary) opacity-70" />
            <h3 className="font-medium text-(--color-text) text-md  tracking-tight mt-0.5" >Fatturazione Elettronica</h3>
            <p className="text-md text-(--color-muted) font-light leading-relaxed">
              I dati fiscali inseriti durante il checkout vengono utilizzati per l'emissione della fattura elettronica relativa al singolo acquisto. Eventuali modifiche successive avranno effetto per le operazioni future.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg border border-(--color-border) bg-(--color-surface) text-md text-(--color-text) flex items-center justify-between flex-wrap gap-2 shadow-xs">
          <span className="font-light">Per supporto amministrativo o richieste su fatture e pagamenti:</span>
          <Link to="/contatti" className="font-bold uppercase tracking-wider text-(--color-text) hover:underline underline-offset-2">
            Contatta l'Assistenza Amministrativa (/contatti) →
          </Link>
        </div>
      </section>
    </div>
  );
}