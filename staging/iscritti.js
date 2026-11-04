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
      if (!pronti.pub || !pronti.priv) return;
      // Unione per id: gli iscritti importati da Excel esistono solo in
      // iscritti_privati finche' il referente non indica la professione.
      const ids = new Set([...pubblici.map(p => p.id), ...privati.map(p => p.id)]);
      const pubById = new Map(pubblici.map(p => [p.id, p]));
      const privById = new Map(privati.map(p => [p.id, p]));
      cb([...ids].map(id => ({ ...(privById.get(id) || {}), ...(pubById.get(id) || {}), id })));
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
      // Niente permessi sui contatti: si continua con nome+professione.
      console.warn("[FN] Iscritti: contatti non leggibili per questo comitato:", err.message);
      pronti.priv = true;
      merge();
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

  async function aggiorna(comitatoId, iscrittoId, { nome, professione, email, telefono }) {
    const ops = [];
    // Correzione del solo nome: il privato si aggiorna sempre; il pubblico solo
    // se esiste gia' (altrimenti correggere un nome renderebbe visibile a tutti
    // una persona che non ha ancora la professione).
    if (nome !== undefined && professione === undefined) {
      ops.push(privRef(comitatoId).doc(iscrittoId).set({ nome }, { merge: true }));
      const pubDoc = await pubRef(comitatoId).doc(iscrittoId).get();
      if (pubDoc.exists) ops.push(pubRef(comitatoId).doc(iscrittoId).set({ nome }, { merge: true }));
    } else if (nome !== undefined || professione !== undefined) {
      const pubPatch = { ...(nome !== undefined ? { nome } : {}), ...(professione !== undefined ? { professione } : {}) };
      // Un iscritto importato non ha ancora il record pubblico: il nome va
      // preso dal privato, cosi' il pubblico nasce completo (nome+professione).
      if (professione && nome === undefined) {
        const priv = await privRef(comitatoId).doc(iscrittoId).get();
        if (priv.exists && priv.data().nome) pubPatch.nome = priv.data().nome;
      }
      ops.push(pubRef(comitatoId).doc(iscrittoId).set(pubPatch, { merge: true }));
      if (professione) ops.push(privRef(comitatoId).doc(iscrittoId).set({ daCompletare: false }, { merge: true }));
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

  // ---------------------------------------------------------------------
  // Import da Excel (elenco membri scaricato dal sito ufficiale).
  // Il file viene letto SOLO nel browser (nessun upload). Si tengono quattro
  // campi — nome, tessera, email, cellulare — e tutto il resto (codice
  // fiscale, indirizzo, ...) viene scartato qui, prima di qualsiasi
  // salvataggio. L'ID del documento e' il numero di tessera: reimportare lo
  // stesso file (o uno aggiornato) non crea mai doppioni. Gli importati
  // finiscono SOLO in iscritti_privati (visibili al referente e agli admin)
  // e diventano pubblici solo quando il referente indica la professione.
  // ---------------------------------------------------------------------
  const COLONNE = {
    nome: ["nominativo", "nome", "nome e cognome", "cognome nome", "nome cognome"],
    tessera: ["tessera", "n tessera", "numero tessera", "n. tessera"],
    email: ["email", "e-mail", "mail", "posta elettronica"],
    telefono: ["cellulare", "telefono", "cell", "tel"]
  };

  function norm(h) { return String(h == null ? "" : h).trim().toLowerCase().replace(/\s+/g, " "); }

  function idTessera(t) { return String(t || "").trim().replace(/[^A-Za-z0-9_-]/g, "").toUpperCase(); }

  // Legge il file e restituisce { righe, scartate, colonneTrovate }. Non
  // legge ne' restituisce MAI il codice fiscale o l'indirizzo.
  async function leggiExcel(file) {
    if (!window.XLSX) throw new Error("Libreria Excel non caricata.");
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const grid = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
    if (!grid.length) throw new Error("Il file e' vuoto.");
    const hdr = grid[0].map(norm);
    const col = {};
    Object.keys(COLONNE).forEach(k => { col[k] = hdr.findIndex(h => COLONNE[k].includes(h)); });
    if (col.nome < 0 || col.tessera < 0) throw new Error("Non trovo le colonne NOMINATIVO e TESSERA: e' il file giusto?");
    const righe = [], scartate = [];
    grid.slice(1).forEach((r, i) => {
      const nome = String(r[col.nome] || "").trim().replace(/\s+/g, " ");
      const tessera = idTessera(r[col.tessera]);
      const email = col.email >= 0 ? String(r[col.email] || "").trim() : "";
      const telefono = col.telefono >= 0 ? String(r[col.telefono] || "").replace(/[^\d+]/g, "") : "";
      if (!nome && !tessera && !email && !telefono) return; // riga vuota
      if (!nome || !tessera) { scartate.push({ riga: i + 2, motivo: "manca nome o tessera" }); return; }
      if (email && !/^[^@\s]+@[^@\s]+\.\w+$/.test(email)) { scartate.push({ riga: i + 2, motivo: "email non valida" }); return; }
      righe.push({ nome, tessera, email, telefono });
    });
    // doppioni dentro lo stesso file: vale l'ultima occorrenza
    const perTessera = new Map(righe.map(r => [r.tessera, r]));
    return { righe: [...perTessera.values()], scartate, doppioniNelFile: righe.length - perTessera.size, colonne: { email: col.email >= 0, telefono: col.telefono >= 0 } };
  }

  // Divide le righe in nuove / gia' presenti rispetto agli iscritti del comitato.
  async function anteprimaImport(comitatoId, righe) {
    const snap = await privRef(comitatoId).get();
    const presenti = new Set(snap.docs.map(d => d.id));
    return { nuove: righe.filter(r => !presenti.has(r.tessera)), gia: righe.filter(r => presenti.has(r.tessera)) };
  }

  async function importa(comitatoId, righe) {
    const CHUNK = 400;
    for (let i = 0; i < righe.length; i += CHUNK) {
      const batch = window.db.batch();
      righe.slice(i, i + CHUNK).forEach(r => {
        batch.set(privRef(comitatoId).doc(r.tessera), {
          nome: r.nome, tessera: r.tessera, email: r.email, telefono: r.telefono,
          daCompletare: true, importatoIl: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    }
    if (window.FN_ATTIVITA && righe.length) {
      const com = window.FN_COMITATI && window.FN_COMITATI.getById(comitatoId);
      window.FN_ATTIVITA.registra("iscritto", `${righe.length} nuovi iscritti importati in ${com ? com.name : "un comitato"}.`);
    }
    return righe.length;
  }

  window.FN_ISCRITTI = { ascoltaPubblici, ascoltaCompleti, crea, aggiorna, rimuovi, leggiExcel, anteprimaImport, importa };
})();
