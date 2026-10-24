// Modulo Iscritti (Fase 2): anagrafica degli iscritti di ogni comitato,
// inserita e gestita dal referente — gli iscritti NON hanno un proprio
// account, nessun login, nessuna email. Visibilita' differenziata: nome e
// professione sono pubblici (chiunque apra l'app li vede, anche senza
// login — sottocollection "iscritti_pubblici"), i dati di contatto (email,
// telefono) sono visibili solo al referente di quello specifico comitato
// o a un admin/superadmin ("iscritti_privati" — le security rules fanno
// rispettare questo confine, qui ci limitiamo a leggere/scrivere le due
// sottocollection separate).
(function () {
  function comRef(comitatoId) { return window.db.collection("comitati_treviso").doc(String(comitatoId)); }
  function pubRef(comitatoId) { return comRef(comitatoId).collection("iscritti_pubblici"); }
  function privRef(comitatoId) { return comRef(comitatoId).collection("iscritti_privati"); }

  // Solo nome+professione: usato per mostrare gli iscritti nella scheda
  // comitato (tab Comitati), visibile a chiunque anche senza login.
  function ascoltaPubblici(comitatoId, cb) {
    return pubRef(comitatoId).onSnapshot(snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { console.error("[FN] Errore lettura iscritti pubblici:", err); cb([]); });
  }

  // Nome+professione+contatti uniti: usato nella pagina personale del
  // referente (lui vede sempre i contatti dei propri iscritti). Se i
  // permessi non bastano (non sei il referente di questo comitato), la
  // lettura dei privati fallisce e mostriamo solo i dati pubblici.
  function ascoltaCompleti(comitatoId, cb) {
    let pubblici = [], privati = [], pronti = { pub: false, priv: false };
    function merge() {
      if (!pronti.pub) return;
      const privById = new Map(privati.map(p => [p.id, p]));
      cb(pubblici.map(p => ({ ...p, ...(privById.get(p.id) || {}) })));
    }
    const unsubPub = pubRef(comitatoId).onSnapshot(snap => {
      pubblici = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pronti.pub = true;
      merge();
    });
    const unsubPriv = privRef(comitatoId).onSnapshot(snap => {
      privati = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      pronti.priv = true;
      merge();
    }, err => {
      // Niente permessi sui contatti (es. admin che guarda un comitato non
      // suo senza esserlo davvero, o regole non ancora propagate): si
      // continua a mostrare nome+professione, senza bloccare la pagina.
      console.warn("[FN] Iscritti: contatti non leggibili per questo comitato:", err.message);
      pronti.priv = true;
    });
    return () => { unsubPub(); unsubPriv(); };
  }

  async function crea(comitatoId, { nome, professione, email, telefono }) {
    const id = pubRef(comitatoId).doc().id;
    await pubRef(comitatoId).doc(id).set({ nome: nome || "", professione: professione || "" });
    await privRef(comitatoId).doc(id).set({ email: email || "", telefono: telefono || "" });
    if (window.FN_ATTIVITA) {
      const com = window.FN_COMITATI && window.FN_COMITATI.getById(comitatoId);
      window.FN_ATTIVITA.registra("iscritto", `Nuovo iscritto in ${com ? com.name : "un comitato"}: ${nome || "senza nome"}.`);
    }
    return id;
  }

  function aggiorna(comitatoId, iscrittoId, { nome, professione, email, telefono }) {
    const ops = [];
    if (nome !== undefined || professione !== undefined) {
      ops.push(pubRef(comitatoId).doc(iscrittoId).set(
        { ...(nome !== undefined ? { nome } : {}), ...(professione !== undefined ? { professione } : {}) },
        { merge: true }
      ));
    }
    if (email !== undefined || telefono !== undefined) {
      ops.push(privRef(comitatoId).doc(iscrittoId).set(
        { ...(email !== undefined ? { email } : {}), ...(telefono !== undefined ? { telefono } : {}) },
        { merge: true }
      ));
    }
    return Promise.all(ops);
  }

  function rimuovi(comitatoId, iscrittoId) {
    return Promise.all([
      pubRef(comitatoId).doc(iscrittoId).delete(),
      privRef(comitatoId).doc(iscrittoId).delete()
    ]);
  }

  window.FN_ISCRITTI = { ascoltaPubblici, ascoltaCompleti, crea, aggiorna, rimuovi };
})();
