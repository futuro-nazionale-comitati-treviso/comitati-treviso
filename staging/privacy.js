// Modulo Privacy (Fase 2): informativa con spunta obbligatoria.
// - In registrazione: la spunta si abilita solo dopo aver aperto e letto
//   l'informativa fino in fondo (FN_PRIVACY.creaSpunta).
// - Referenti gia' registrati: al primo accesso dopo un cambio di VERSIONE
//   compare una finestra bloccante che chiede di riaccettare.
// - Cosa viene registrato su utenti/{uid}: privacyAccettataIl (data/ora
//   del server, imposta dalle security rules) e privacyVersione.
//
// ATTENZIONE: il testo qui sotto e' una BOZZA da far rivedere al legale di
// Futuro Nazionale (vedi doc di progetto "privacy-e-consenso-call-bozza-per-
// legale"). Le parti tra [parentesi quadre] vanno completate. Quando il
// testo cambia in modo sostanziale, aggiornare VERSIONE: tutti i referenti
// dovranno riaccettare al prossimo accesso.
(function () {
  const VERSIONE = "2026-11-01-bozza1";

  const TESTO_HTML = `
    <h4>Informativa sul trattamento dei dati personali</h4>
    <p><strong>Titolare del trattamento:</strong> [DA COMPLETARE: denominazione e contatti del titolare].</p>
    <p><strong>Chi usa questa piattaforma.</strong> La piattaforma serve a coordinare i comitati territoriali della provincia di Treviso: rubrica dei comitati, eventi, calendario, moduli e call tra referenti.</p>
    <p><strong>Quali dati trattiamo.</strong></p>
    <ul>
      <li>Dati del referente: nome e cognome, email, telefono, foto profilo, comitato di appartenenza e sede del comitato (l'indirizzo viene inviato a un servizio esterno di geocoding, OpenStreetMap/Nominatim, per ricavarne la posizione sulla mappa).</li>
      <li>Dati degli iscritti, inseriti dal referente: nome e professione (visibili a chiunque consulti la piattaforma) ed email e telefono (visibili solo al referente del comitato e agli amministratori).</li>
      <li>Dati sulle attività svolte nella piattaforma (es. nuovi iscritti, nuovi moduli, eventi creati) e su chi le ha svolte.</li>
    </ul>
    <p><strong>Impegno del referente.</strong> Inserendo dati di iscritti, il referente dichiara che si tratta di persone che hanno già sottoscritto l'informativa privacy all'atto del tesseramento, e si impegna a trattarli solo per le finalità del comitato.</p>
    <p><strong>Call e registrazioni.</strong> Le call tra referenti possono essere registrate (audio/video) dall'organizzatore al solo scopo di redigere un resoconto. L'avviso è indicato nell'invito e ricordato a voce all'inizio della call; chi non desidera essere registrato può non partecipare o lasciare la call. Le registrazioni e le trascrizioni non sono pubblicate nella piattaforma. [DA COMPLETARE: tempo di conservazione e dove sono conservate.]</p>
    <p><strong>Finalità e base giuridica.</strong> [DA COMPLETARE dal legale: finalità, base giuridica, eventuale trattamento di dati che rivelano opinioni politiche (art. 9 GDPR).]</p>
    <p><strong>Servizi di terzi.</strong> La piattaforma usa servizi di Google (Firebase: autenticazione e database), GitHub (pubblicazione del sito), EmailJS (invio email), OpenStreetMap/Nominatim (ricerca indirizzi) e, per le call, Google Meet o Zoom. [DA COMPLETARE: ubicazione dei dati e garanzie per eventuali trasferimenti extra-UE.]</p>
    <p><strong>Diritti.</strong> Puoi chiedere accesso, rettifica, cancellazione, limitazione e opposizione, e proporre reclamo al Garante per la protezione dei dati personali. [DA COMPLETARE: contatto per esercitare i diritti.]</p>
    <p class="privacy-fine">Fine dell'informativa.</p>
  `;

  const TESTO_SPUNTA = "Ho letto l'informativa sul trattamento dei dati personali. Mi impegno a inserire nella piattaforma solo dati di iscritti che hanno già sottoscritto l'informativa privacy all'atto del tesseramento, e a trattarli solo per le finalità del comitato.";

  // Apre il lettore dell'informativa. Risolve true se l'utente la legge
  // fino in fondo e preme "Ho letto", false se chiude senza confermare.
  function apriInformativa() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "fn-modal-overlay";
      overlay.style.zIndex = "1100";
      overlay.innerHTML = `
        <div class="fn-modal card privacy-modal">
          <div class="privacy-testo" id="privacy-testo">${TESTO_HTML}</div>
          <div class="auth-hint" id="privacy-scroll-hint">Scorri fino in fondo per poter confermare la lettura.</div>
          <div class="actions">
            <button type="button" class="btn primary" id="privacy-letto" disabled>Ho letto l'informativa</button>
            <button type="button" class="btn" id="privacy-chiudi">Chiudi</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const box = overlay.querySelector("#privacy-testo");
      const btnLetto = overlay.querySelector("#privacy-letto");
      const hint = overlay.querySelector("#privacy-scroll-hint");
      function controllaFondo() {
        if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) {
          btnLetto.disabled = false;
          hint.style.display = "none";
        }
      }
      box.addEventListener("scroll", controllaFondo);
      setTimeout(controllaFondo, 50); // testo corto: niente scroll necessario
      function chiudi(esito) { overlay.remove(); resolve(esito); }
      btnLetto.addEventListener("click", () => chiudi(true));
      overlay.querySelector("#privacy-chiudi").addEventListener("click", () => chiudi(false));
    });
  }

  // Costruisce nel contenitore indicato: link "Leggi l'informativa" +
  // casella di spunta (disabilitata finche' l'informativa non e' stata letta).
  // Restituisce { isChecked() }.
  function creaSpunta(contenitore) {
    contenitore.innerHTML = `
      <div class="privacy-spunta">
        <button type="button" class="btn small" data-privacy-apri>📄 Leggi l'informativa</button>
        <label class="privacy-check disabled">
          <input type="checkbox" data-privacy-check disabled>
          <span>${TESTO_SPUNTA}</span>
        </label>
        <div class="auth-hint" data-privacy-stato>Per spuntare la casella apri e leggi l'informativa fino in fondo.</div>
      </div>`;
    const apri = contenitore.querySelector("[data-privacy-apri]");
    const check = contenitore.querySelector("[data-privacy-check]");
    const label = contenitore.querySelector(".privacy-check");
    const stato = contenitore.querySelector("[data-privacy-stato]");
    apri.addEventListener("click", async () => {
      if (await apriInformativa()) {
        check.disabled = false;
        label.classList.remove("disabled");
        stato.textContent = "Informativa letta.";
      }
    });
    return { isChecked: () => check.checked };
  }

  // Finestra bloccante per chi e' gia' registrato ma non ha accettato la
  // versione corrente (utenti creati prima di questa funzione, o dopo un
  // aggiornamento del testo).
  let overlayRiaccettazione = null;
  function mostraRiaccettazione() {
    if (overlayRiaccettazione) return;
    const overlay = document.createElement("div");
    overlay.className = "fn-modal-overlay";
    overlay.style.zIndex = "1200";
    overlay.innerHTML = `
      <div class="fn-modal card" style="max-width:520px;">
        <h3>Informativa privacy</h3>
        <p style="font-size:13px;margin:0;">Per continuare a usare la piattaforma devi leggere e accettare l'informativa sul trattamento dei dati personali.</p>
        <div id="privacy-riacc-spunta"></div>
        <div class="email-modal-status" id="privacy-riacc-status"></div>
        <div class="actions">
          <button type="button" class="btn primary" id="privacy-riacc-ok">Accetto e continuo</button>
          <button type="button" class="btn" id="privacy-riacc-esci">Esci</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlayRiaccettazione = overlay;
    const spunta = creaSpunta(overlay.querySelector("#privacy-riacc-spunta"));
    const status = overlay.querySelector("#privacy-riacc-status");
    overlay.querySelector("#privacy-riacc-ok").addEventListener("click", () => {
      if (!spunta.isChecked()) { status.textContent = "Spunta la casella dopo aver letto l'informativa."; return; }
      status.textContent = "Salvataggio…";
      window.FN_AUTH.aggiornaProfilo({
        privacyAccettataIl: firebase.firestore.FieldValue.serverTimestamp(),
        privacyVersione: VERSIONE
      }).catch(err => { status.textContent = "Errore: " + err.message; });
    });
    overlay.querySelector("#privacy-riacc-esci").addEventListener("click", () => window.FN_AUTH.esci());
  }
  function nascondiRiaccettazione() {
    if (overlayRiaccettazione) { overlayRiaccettazione.remove(); overlayRiaccettazione = null; }
  }

  function init() {
    if (!window.FN_AUTH) return;
    window.FN_AUTH.onChange((stato) => {
      if (stato.user && stato.profile && stato.profile.privacyVersione !== VERSIONE) mostraRiaccettazione();
      else nascondiRiaccettazione();
    });
  }

  window.FN_PRIVACY = { VERSIONE, TESTO_SPUNTA, apriInformativa, creaSpunta, init };
})();
