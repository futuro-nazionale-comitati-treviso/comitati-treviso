// Modulo Blocco giorno evento (Fase 2): un solo evento per giorno su tutta
// la piattaforma (non per comitato). Alla creazione di un evento il giorno
// si blocca per tutti; solo un admin/superadmin puo' sbloccarlo per
// permettere un secondo evento nello stesso giorno. Persistenza:
// "blocchi_giorno_treviso/{AAAA-MM-GG}" -> { eventoId, sbloccato }.
// Nota di compromesso (vedi ANALISI-E-ROADMAP.md, Fase 2 punto D.8): il
// controllo "giorno libero?" avviene qui, lato client, dentro una
// transazione Firestore — evita le doppie prenotazioni nell'uso normale
// dell'app, ma non e' una garanzia assoluta contro una scrittura diretta
// malevola su Firestore, lo stesso compromesso gia' accettato per il resto
// dei dati di questa app.
(function () {
  const COLLECTION = "blocchi_giorno_treviso";

  function chiaveGiorno(dataOraLocale) {
    // "2026-11-15T10:00" -> "2026-11-15"
    return (dataOraLocale || "").slice(0, 10);
  }

  // Prova a bloccare il giorno per il nuovo evento "eventoId". Restituisce
  // {ok:true} se il giorno era libero (o sbloccato) ed e' stato prenotato,
  // {ok:false} se esiste gia' un evento confermato in quel giorno.
  async function prenota(dataOraLocale, eventoId) {
    const key = chiaveGiorno(dataOraLocale);
    if (!key) return { ok: true, key: null };
    const ref = window.db.collection(COLLECTION).doc(key);
    try {
      await window.db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists && snap.data().sbloccato !== true) {
          throw new Error("GIORNO_BLOCCATO");
        }
        tx.set(ref, {
          eventoId, sbloccato: false,
          aggiornatoIl: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      return { ok: true, key };
    } catch (e) {
      if (e.message === "GIORNO_BLOCCATO") return { ok: false, key };
      throw e;
    }
  }

  function ascoltaBloccati(cb) {
    return window.db.collection(COLLECTION).where("sbloccato", "==", false).onSnapshot(snap => {
      cb(snap.docs.map(d => ({ giorno: d.id, ...d.data() })));
    }, err => console.error("[FN] Errore lettura blocchi giorno:", err));
  }

  function sblocca(giorno) {
    if (!window.FN_AUTH || !window.FN_AUTH.isAdmin()) return Promise.reject(new Error("Solo un amministratore può sbloccare un giorno."));
    return window.db.collection(COLLECTION).doc(giorno).set({ sbloccato: true }, { merge: true });
  }

  window.FN_BLOCCO_GIORNO = { chiaveGiorno, prenota, ascoltaBloccati, sblocca };
})();
