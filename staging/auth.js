// Modulo Autenticazione (Fase 2): login/registrazione referenti con Firebase
// Authentication (email+password, verifica email), profilo ruolo su Firestore
// ("utenti/{uid}": referente | admin | superadmin — niente Cloud Functions,
// quindi niente custom claims: il ruolo e' un campo letto dalle security
// rules con get(), vedi ANALISI-E-ROADMAP.md). In fase di registrazione il
// referente SCRIVE il nome del comitato (nessun elenco da cui scegliere):
// cerchiamo un comitato esistente con lo stesso nome e ci colleghiamo, se non
// c'e' lo creiamo. Il vecchio "Chi sei" (menu a tendina, nessun login) resta
// per compatibilita' visiva ma non determina piu' i permessi di scrittura:
// quelli li decidono le security rules in base a questo modulo.
(function () {
  let currentUser = null; // oggetto Firebase Auth (o null)
  let profile = null;     // documento utenti/{uid} (o null finche' non caricato)
  let ready = false;
  const listeners = [];
  let unsubProfile = null;

  function notify() {
    listeners.forEach(fn => { try { fn(state()); } catch (e) { console.error("[FN] Errore in un listener auth:", e); } });
  }

  function state() {
    return { user: currentUser, profile, ruolo: profile ? profile.ruolo : null, pronto: ready };
  }

  function onChange(fn) {
    listeners.push(fn);
    if (ready) fn(state());
  }

  function isLoggedIn() { return !!currentUser; }
  function ruolo() { return profile ? profile.ruolo : null; }
  function isAdmin() { return ruolo() === "admin" || ruolo() === "superadmin"; }
  function isSuperadmin() { return ruolo() === "superadmin"; }
  function comitatoId() { return profile ? profile.comitatoId : null; }
  function nome() { return profile ? profile.nome : null; }

  // Un utente puo' modificare un comitato se e' admin/superadmin o se e'
  // il referente registrato su quel preciso comitato (vedi security rules).
  function puoModificareComitato(id) {
    if (isAdmin()) return true;
    return ruolo() === "referente" && comitatoId() === String(id);
  }

  // Cerca un comitato esistente per nome (case-insensitive); se non esiste lo
  // crea con i dati minimi forniti dal referente in fase di registrazione.
  async function cercaOCreaComitato(nomeInserito, datiReferente) {
    const nome = (nomeInserito || "").trim();
    if (!nome) throw new Error("Scrivi il nome del comitato che rappresenti.");
    const norm = nome.toLowerCase();
    const snap = await window.db.collection("comitati_treviso").where("nomeNormalizzato", "==", norm).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
    // Comitato nuovo: nasce direttamente dalla registrazione (nessuna
    // approvazione manuale, come richiesto). Il referente potra' completare
    // indirizzo/coordinate in un secondo momento dalla scheda comitato.
    return window.FN_COMITATI.create({
      name: nome,
      city: "",
      ref: datiReferente.nome,
      email: datiReferente.email,
      tel: datiReferente.telefono || ""
    });
  }

  async function registrati({ nome, email, password, comitatoNome, telefono }) {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await cred.user.sendEmailVerification();
    const comId = await cercaOCreaComitato(comitatoNome, { nome, email, telefono });
    await firebase.firestore().collection("utenti").doc(cred.user.uid).set({
      email, nome, comitatoId: comId, ruolo: "referente",
      creatoIl: firebase.firestore.FieldValue.serverTimestamp()
    });
    return cred.user;
  }

  function accedi(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }

  function esci() {
    return firebase.auth().signOut();
  }

  function reimpostaPassword(email) {
    return firebase.auth().sendPasswordResetEmail(email);
  }

  function aggiornaProfilo(patch) {
    if (!currentUser) return Promise.reject(new Error("Devi essere loggato."));
    return firebase.firestore().collection("utenti").doc(currentUser.uid).set(patch, { merge: true });
  }

  // Solo il superadmin puo' nominare/revocare un admin: cerca l'utente per
  // email e ne cambia il ruolo (le security rules verificano comunque lato
  // server che a farlo sia davvero il superadmin).
  async function impostaRuoloPerEmail(email, nuovoRuolo) {
    if (!isSuperadmin()) throw new Error("Solo il superadmin può nominare o revocare un amministratore.");
    if (nuovoRuolo === "superadmin") throw new Error("Non è possibile creare un secondo superadmin da qui.");
    const snap = await firebase.firestore().collection("utenti").where("email", "==", email.trim().toLowerCase()).limit(1).get();
    if (snap.empty) throw new Error("Nessun referente registrato con questa email.");
    await snap.docs[0].ref.set({ ruolo: nuovoRuolo }, { merge: true });
  }

  function init() {
    if (!window.FN_FIREBASE_READY) { ready = true; notify(); return; }
    firebase.auth().onAuthStateChanged(user => {
      currentUser = user;
      if (unsubProfile) { unsubProfile(); unsubProfile = null; }
      if (!user) {
        profile = null;
        ready = true;
        notify();
        return;
      }
      unsubProfile = firebase.firestore().collection("utenti").doc(user.uid).onSnapshot(doc => {
        profile = doc.exists ? doc.data() : null;
        ready = true;
        notify();
      }, err => {
        console.error("[FN] Errore lettura profilo utente:", err);
        ready = true;
        notify();
      });
    });
  }

  window.FN_AUTH = {
    init, onChange, isLoggedIn, ruolo, isAdmin, isSuperadmin, comitatoId, nome,
    puoModificareComitato, registrati, accedi, esci, reimpostaPassword,
    aggiornaProfilo, impostaRuoloPerEmail,
    currentUser: () => currentUser
  };
})();
