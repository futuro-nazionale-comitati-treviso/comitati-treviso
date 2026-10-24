// Modulo Bacheca della community (Fase 2): registro di attivita' recenti
// (nuovo iscritto, nuovo modulo caricato, nuovo comitato registrato),
// mostrato nella Dashboard. Collection "attivita_treviso", scrittura aperta
// a chi genera davvero l'evento (vedi firestore.rules), lettura pubblica.
// Nessuna UI propria: e' dashboard.js a leggerla e disegnarla.
(function () {
  const COLLECTION = "attivita_treviso";

  function registra(tipo, messaggio) {
    if (!window.FN_FIREBASE_READY) return Promise.resolve();
    return window.db.collection(COLLECTION).add({
      tipo, messaggio: (messaggio || "").slice(0, 200),
      quando: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.warn("[FN] Bacheca: scrittura attivita' non riuscita:", e.message));
  }

  function ascoltaRecenti(cb, limite) {
    if (!window.FN_FIREBASE_READY) { cb([]); return () => {}; }
    return window.db.collection(COLLECTION).orderBy("quando", "desc").limit(limite || 8).onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.error("[FN] Errore lettura bacheca:", err); cb([]); });
  }

  window.FN_ATTIVITA = { registra, ascoltaRecenti };
})();
