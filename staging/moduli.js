// Modulo Moduli e documenti (Fase 2): metadati dei file condivisi dagli
// amministratori (titolo, categoria, link a una cartella/file Google Drive).
// Niente upload in app: niente Firebase Storage, niente piano Blaze, niente
// carta di credito — i file vivono su Drive, qui li elenchiamo e basta.
// Lettura pubblica, scrittura riservata ad admin/superadmin (vedi security
// rules). Questo modulo possiede sia i dati sia il rendering del tab
// "Moduli", come eventi.js/dashboard.js.
(function () {
  const COLLECTION = "moduli_treviso";
  const CATEGORIE = ["Modulistica", "Regolamenti", "Comunicazioni"];
  let cache = [];
  const listeners = [];

  function notify() { listeners.forEach(fn => { try { fn(cache); } catch (e) { console.error("[FN] Errore in un listener moduli:", e); } }); }
  function onChange(fn) { listeners.push(fn); fn(cache); }

  function listenData() {
    if (!window.FN_FIREBASE_READY) { cache = []; notify(); return; }
    window.db.collection(COLLECTION).orderBy("caricatoIl", "desc").onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notify();
      render();
    }, err => console.error("[FN] Errore lettura moduli:", err));
  }

  function getAll() { return cache.slice(); }

  function crea({ titolo, categoria, link }) {
    if (!window.FN_AUTH || !window.FN_AUTH.isAdmin()) return Promise.reject(new Error("Solo un amministratore può caricare un modulo."));
    return window.db.collection(COLLECTION).add({
      titolo: titolo || "", categoria: categoria || CATEGORIE[0], link: link || "",
      caricatoDa: window.FN_AUTH.nome() || "admin",
      caricatoIl: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function rimuovi(id) {
    if (!window.FN_AUTH || !window.FN_AUTH.isAdmin()) return Promise.reject(new Error("Solo un amministratore può rimuovere un modulo."));
    return window.db.collection(COLLECTION).doc(id).delete();
  }

  function tsToDate(ts) { return ts && typeof ts.toDate === "function" ? ts.toDate() : null; }
  function fmtData(ts) { const d = tsToDate(ts); return d ? d.toLocaleDateString("it-IT") : ""; }

  function card(m) {
    const admin = window.FN_AUTH && window.FN_AUTH.isAdmin();
    return `
      <div class="card modulo-card">
        <div class="modulo-cat">${m.categoria || ""}</div>
        <div class="modulo-titolo">${m.titolo}</div>
        <div class="modulo-meta">Caricato da ${m.caricatoDa || "admin"}${m.caricatoIl ? " · " + fmtData(m.caricatoIl) : ""}</div>
        <div class="actions">
          <a class="btn primary" href="${m.link}" target="_blank" rel="noopener">Apri su Drive</a>
          ${admin ? `<button class="btn" data-modulo-del="${m.id}">Rimuovi</button>` : ""}
        </div>
      </div>`;
  }

  function render() {
    const grid = document.getElementById("moduli-grid");
    if (!grid) return;
    if (!window.FN_FIREBASE_READY) {
      grid.innerHTML = `<div class="notice error">Firebase non configurato: compila firebase-config.js per vedere i moduli.</div>`;
      return;
    }
    grid.innerHTML = cache.length
      ? cache.map(card).join("")
      : '<p class="detail empty">Nessun modulo caricato per ora.</p>';
    grid.querySelectorAll("[data-modulo-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("Rimuovere questo modulo dall'elenco? Il file su Drive non viene toccato.")) {
          rimuovi(btn.dataset.moduloDel).catch(e => alert("Errore: " + e.message));
        }
      });
    });
    renderForm();
  }

  function renderForm() {
    const wrap = document.getElementById("moduli-form-wrap");
    if (!wrap) return;
    const admin = window.FN_AUTH && window.FN_AUTH.isAdmin();
    if (!admin) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;">Carica nuovo modulo</h3>
        <form class="stack" id="modulo-form">
          <label>Titolo</label>
          <input type="text" id="mod-titolo" required placeholder="Es. Modulo iscrizione comitato 2026">
          <label>Categoria</label>
          <select id="mod-categoria">${CATEGORIE.map(c => `<option>${c}</option>`).join("")}</select>
          <label>Link alla cartella/file su Google Drive</label>
          <input type="url" id="mod-link" required placeholder="https://drive.google.com/...">
          <button type="submit" class="btn primary">Pubblica</button>
        </form>
      </div>`;
    document.getElementById("modulo-form").addEventListener("submit", (e) => {
      e.preventDefault();
      crea({
        titolo: document.getElementById("mod-titolo").value,
        categoria: document.getElementById("mod-categoria").value,
        link: document.getElementById("mod-link").value
      }).then(() => e.target.reset()).catch(err => alert("Errore: " + err.message));
    });
  }

  window.FN_MODULI = {
    init() { listenData(); if (window.FN_AUTH) window.FN_AUTH.onChange(render); },
    onChange, getAll, crea, rimuovi, CATEGORIE, render
  };
})();
