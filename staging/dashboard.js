// Dashboard: vista d'insieme di benvenuto (Fase 2) — intestazione con nome e
// ruolo di chi e' loggato, azioni rapide per admin/superadmin, statistiche
// reali (comitati, iscritti, eventi, moduli), contatti rapidi e bacheca
// della community a sinistra, prossimi eventi e nuovi moduli a destra.
// Tutto calcolato al volo dai moduli esistenti (comitati-data.js, eventi.js,
// iscritti.js via collectionGroup, moduli.js, attivita.js): nessuna
// duplicazione di dati.
(function () {
  function tsToDate(ts) { return (ts && ts.toDate) ? ts.toDate() : null; }
  function ruoloLabel(r) { return r === "superadmin" ? "Amministratore principale" : r === "admin" ? "Amministratore" : "Referente"; }

  // Iscritti totali su tutta la rete: una sola onSnapshot su una collection
  // group, cosi' niente da sommare manualmente comitato per comitato.
  let totaleIscritti = null;
  let unsubIscrittiTotali = null;
  function ascoltaIscrittiTotali() {
    if (!window.FN_FIREBASE_READY || unsubIscrittiTotali) return;
    unsubIscrittiTotali = window.db.collectionGroup("iscritti_pubblici").onSnapshot(snap => {
      totaleIscritti = snap.size;
      render();
    }, err => { console.error("[FN] Errore conteggio iscritti totali:", err); });
  }

  // Bacheca della community: ultime attivita' registrate dagli altri moduli
  // (nuovo iscritto, nuovo modulo, nuovo comitato).
  let bacheca = [];
  let unsubBacheca = null;
  function ascoltaBacheca() {
    if (!window.FN_ATTIVITA || unsubBacheca) return;
    unsubBacheca = window.FN_ATTIVITA.ascoltaRecenti((lista) => { bacheca = lista; render(); }, 8);
  }

  function fmtRelativo(ts) {
    const d = tsToDate(ts);
    if (!d) return "";
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "adesso";
    if (diffMin < 60) return `${diffMin} min fa`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH} ore fa`;
    return d.toLocaleDateString("it-IT");
  }

  function eventiDelMese(all) {
    const now = new Date();
    return all.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }

  function moduliRecenti(all) {
    const now = Date.now();
    return all.filter(m => {
      const d = tsToDate(m.caricatoIl);
      return d && (now - d.getTime()) <= 30 * 86400000;
    });
  }

  function contattiRapidi(comitati) {
    return comitati
      .filter(d => d.ref)
      .slice()
      .sort((a, b) => (tsToDate(b.updatedAt) || 0) - (tsToDate(a.updatedAt) || 0))
      .slice(0, 5);
  }

  function renderWelcome() {
    const auth = window.FN_AUTH;
    const loggato = auth && auth.isLoggedIn();
    const nome = loggato ? auth.nome() : null;
    const ruolo = loggato ? auth.ruolo() : null;
    const isAdmin = loggato && auth.isAdmin();
    return `
      <div class="dash-welcome">
        <div>
          <h2>Bentornato${nome ? ", " + nome.split(" ")[0] : ""}</h2>
          <p class="muted">Comitati FN · Provincia di Treviso${ruolo ? ` — <span class="chip-ruolo chip-ruolo-${ruolo}" style="margin-left:6px;">${ruoloLabel(ruolo)}</span>` : ""}</p>
        </div>
        ${isAdmin ? `
        <div class="dash-welcome-actions">
          <button class="btn" id="dash-azione-blocco">🔓 Sblocca giorno evento</button>
          <button class="btn primary" id="dash-azione-admin">👤 Gestisci amministratori</button>
        </div>` : ""}
      </div>`;
  }

  function vaiAlProfilo() {
    const btn = document.querySelector('.tab-btn[data-tab="profilo"]');
    if (btn) btn.click();
  }

  function render() {
    const container = document.getElementById("dashboard-content");
    if (!container || !window.FN_COMITATI) return;
    const comitati = window.FN_COMITATI.getAll();
    const all = window.FN_EVENTI ? window.FN_EVENTI.getAll() : [];
    const moduli = window.FN_MODULI ? window.FN_MODULI.getAll() : [];
    const attivi = comitati.filter(d => d.stato === "attivo").length;
    const now = new Date();
    const imminenti = all.filter(e => e.date && new Date(e.date) >= now && (new Date(e.date) - now) <= 14 * 86400000 && e.stato !== "ANNULLATO")
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const delMese = eventiDelMese(all);
    const nuoviModuli = moduliRecenti(moduli);
    const statoLabel = window.FN_EVENTI ? window.FN_EVENTI.STATO_LABEL : {};

    const avviso = !window.FN_FIREBASE_READY
      ? `<div class="notice error">Firebase non configurato: la dashboard mostra solo i comitati (dati statici in sola lettura).</div>`
      : "";

    container.innerHTML = `
      ${avviso}
      ${renderWelcome()}
      <div class="dash-stat-grid">
        <div class="dash-stat-card"><div class="dash-stat-num">${attivi}</div><div class="dash-stat-label">Comitati attivi</div></div>
        <div class="dash-stat-card giallo"><div class="dash-stat-num">${totaleIscritti != null ? totaleIscritti : "…"}</div><div class="dash-stat-label">Iscritti totali</div></div>
        <div class="dash-stat-card"><div class="dash-stat-num">${delMese.length}</div><div class="dash-stat-label">Eventi questo mese</div></div>
        <div class="dash-stat-card giallo"><div class="dash-stat-num">${nuoviModuli.length}</div><div class="dash-stat-label">Nuovi moduli (30 gg)</div></div>
      </div>
      <div class="dash-two-col">
        <div>
          <div class="card" style="margin-bottom:18px;">
            <h3 style="margin-top:0;">📇 Contatti rapidi</h3>
            ${contattiRapidi(comitati).map(d => `
              <div class="dash-contatto-row">
                ${d.foto ? `<img src="${d.foto}" class="row-avatar-img" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="">` : `<div class="row-avatar" style="width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--grigio-chiaro);font-size:12px;font-weight:700;">${(d.ref || "?").slice(0, 2).toUpperCase()}</div>`}
                <div>
                  <div class="nome">${d.ref}</div>
                  <div class="sub">${d.name}</div>
                </div>
                <div class="icone">
                  <a href="tel:${d.tel}" title="Chiama">📞</a>
                  <a href="${window.FN_UTILS.waLink(d.tel)}" target="_blank" title="WhatsApp">💬</a>
                </div>
              </div>`).join("") || '<p class="detail empty">Nessun contatto disponibile.</p>'}
          </div>
          <div class="card">
            <h3 style="margin-top:0;">🗣️ Bacheca della community</h3>
            ${bacheca.length ? bacheca.map(a => `<div class="dash-bacheca-item">${a.messaggio}<small>${fmtRelativo(a.quando)}</small></div>`).join("") : '<p class="detail empty">Nessuna attività recente.</p>'}
          </div>
        </div>
        <div>
          <div class="card" style="margin-bottom:18px;">
            <h3 style="margin-top:0;">📅 Prossimi eventi</h3>
            ${imminenti.length ? imminenti.slice(0, 6).map(e => `
              <div class="dash-bacheca-item">
                <b>${e.title}</b> <span class="stato-badge stato-${(e.stato || "bozza").toLowerCase()}" style="font-size:10px;">${statoLabel[e.stato] || e.stato || "Bozza"}</span>
                <small>${new Date(e.date).toLocaleDateString("it-IT")} — ${e.comune || e.place || ""}</small>
              </div>`).join("") : '<p class="detail empty">Nessun evento nei prossimi 14 giorni.</p>'}
          </div>
          <div class="card">
            <h3 style="margin-top:0;">🆕 Nuovi moduli e iniziative</h3>
            ${moduli.length ? moduli.slice(0, 5).map(m => `
              <div class="dash-modulo-mini">
                <div class="cat">${m.categoria || ""}</div>
                <a href="${m.link}" target="_blank" rel="noopener"><b>${m.titolo}</b></a>
              </div>`).join("") : '<p class="detail empty">Nessun modulo caricato ancora.</p>'}
          </div>
        </div>
      </div>
    `;

    const btnBlocco = document.getElementById("dash-azione-blocco");
    if (btnBlocco) btnBlocco.addEventListener("click", vaiAlProfilo);
    const btnAdmin = document.getElementById("dash-azione-admin");
    if (btnAdmin) btnAdmin.addEventListener("click", vaiAlProfilo);
  }

  window.FN_DASHBOARD = {
    init() {
      window.FN_COMITATI.onChange(() => render());
      if (window.FN_EVENTI && window.FN_EVENTI.onChange) window.FN_EVENTI.onChange(() => render());
      if (window.FN_MODULI && window.FN_MODULI.onChange) window.FN_MODULI.onChange(() => render());
      if (window.FN_AUTH) window.FN_AUTH.onChange(() => render());
      ascoltaIscrittiTotali();
      ascoltaBacheca();
      render();
    },
    refresh: render
  };
})();
