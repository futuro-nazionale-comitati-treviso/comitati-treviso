// Modulo Profilo (Fase 2): login/registrazione referenti, pagina personale
// (dati di contatto, foto tonda, iscritti con visibilita' differenziata) e
// pannello amministratore (nomina admin, sblocco giorni evento). Tutta la
// UI del tab "Profilo" vive qui, come eventi.js/dashboard.js per i loro tab.
(function () {
  let unsubIscritti = null;
  let listaIscritti = [];

  function container() { return document.getElementById("profilo-content"); }

  // -----------------------------------------------------------------------
  // Non loggato: form di accesso / registrazione
  // -----------------------------------------------------------------------
  function renderAuthForms(tab) {
    const el = container();
    if (!el) return;
    const isAccedi = tab !== "registrati";
    el.innerHTML = `
      <div class="card auth-card">
        <div class="auth-tabs">
          <button type="button" class="auth-tab ${isAccedi ? "active" : ""}" id="auth-tab-accedi">Accedi</button>
          <button type="button" class="auth-tab ${!isAccedi ? "active" : ""}" id="auth-tab-registrati">Registra il tuo comitato</button>
        </div>
        <div id="auth-form-area"></div>
        <div class="email-modal-status" id="auth-status"></div>
      </div>`;
    document.getElementById("auth-tab-accedi").addEventListener("click", () => renderAuthForms("accedi"));
    document.getElementById("auth-tab-registrati").addEventListener("click", () => renderAuthForms("registrati"));
    const area = document.getElementById("auth-form-area");
    const status = document.getElementById("auth-status");

    if (isAccedi) {
      area.innerHTML = `
        <form class="stack" id="login-form">
          <label>Email</label>
          <input type="email" id="login-email" required placeholder="nome.cognome@esempio.it">
          <label>Password</label>
          <input type="password" id="login-password" required>
          <button type="submit" class="btn primary">Accedi</button>
          <button type="button" class="btn" id="login-reset" style="align-self:flex-start;">Password dimenticata?</button>
        </form>`;
      document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        status.textContent = "Accesso in corso…";
        window.FN_AUTH.accedi(document.getElementById("login-email").value, document.getElementById("login-password").value)
          .catch(err => { status.textContent = "Errore: " + err.message; });
      });
      document.getElementById("login-reset").addEventListener("click", () => {
        const email = document.getElementById("login-email").value;
        if (!email) { status.textContent = "Scrivi prima la tua email, poi premi di nuovo."; return; }
        window.FN_AUTH.reimpostaPassword(email)
          .then(() => { status.textContent = "Email per reimpostare la password inviata."; })
          .catch(err => { status.textContent = "Errore: " + err.message; });
      });
    } else {
      area.innerHTML = `
        <form class="stack" id="register-form">
          <label>Nome e cognome</label>
          <input type="text" id="reg-nome" required placeholder="Es. Marco Rossetto">
          <label>Il tuo comitato</label>
          <input type="text" id="reg-comitato" required placeholder="Scrivi il nome del tuo comitato, es. Comitato Treviso Centro">
          <label>Email</label>
          <input type="email" id="reg-email" required placeholder="nome.cognome@esempio.it">
          <label>Password</label>
          <input type="password" id="reg-password" required minlength="6">
          <label>Telefono</label>
          <input type="tel" id="reg-telefono" placeholder="+39 ">
          <button type="submit" class="btn primary">Crea account e invia verifica</button>
        </form>
        <p class="auth-hint">Nessuna approvazione manuale: ricevi una mail di verifica e sei subito operativo sul comitato che hai indicato. Gli iscritti non hanno un proprio accesso: li inserisci tu da qui una volta registrato.</p>`;
      document.getElementById("register-form").addEventListener("submit", (e) => {
        e.preventDefault();
        status.textContent = "Creazione account in corso…";
        window.FN_AUTH.registrati({
          nome: document.getElementById("reg-nome").value,
          comitatoNome: document.getElementById("reg-comitato").value,
          email: document.getElementById("reg-email").value,
          password: document.getElementById("reg-password").value,
          telefono: document.getElementById("reg-telefono").value
        }).catch(err => { status.textContent = "Errore: " + err.message; });
      });
    }
  }

  // -----------------------------------------------------------------------
  // Loggato: pagina personale referente
  // -----------------------------------------------------------------------
  function ruoloLabel(r) {
    return r === "superadmin" ? "Amministratore principale" : r === "admin" ? "Amministratore" : "Referente";
  }

  function renderDashboard(stato) {
    const el = container();
    if (!el) return;
    const com = window.FN_COMITATI.getById(stato.profile.comitatoId);
    const foto = com && com.foto ? `<img src="${com.foto}" class="profilo-avatar-img" alt="">` : `<div class="profilo-avatar-vuoto">${(stato.profile.nome || "?").slice(0, 2).toUpperCase()}</div>`;

    el.innerHTML = `
      <div class="card profilo-head">
        <div class="profilo-avatar-wrap">
          ${foto}
          <label class="profilo-avatar-edit" title="Cambia foto">
            <input type="file" id="profilo-foto-input" accept="image/*" style="display:none;">
            ✏️
          </label>
        </div>
        <div style="flex:1;">
          <div class="detail-name">${stato.profile.nome}</div>
          <div class="muted">${com ? com.name : "Comitato non trovato"} · ${stato.profile.email}</div>
          <span class="chip-ruolo chip-ruolo-${stato.ruolo}">${ruoloLabel(stato.ruolo)}</span>
        </div>
        <button class="btn" id="profilo-logout">Esci</button>
      </div>

      <div class="card">
        <h3 style="margin-top:0;">I tuoi dati di contatto</h3>
        <form class="stack" id="profilo-dati-form">
          <label>Nome e cognome</label>
          <input type="text" id="pf-nome" value="${stato.profile.nome || ""}">
          <label>Telefono</label>
          <input type="tel" id="pf-telefono" value="${stato.profile.telefono || ""}">
          <button type="submit" class="btn primary">Salva modifiche</button>
        </form>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <h3 style="margin:0;">Iscritti del ${com ? com.name : "tuo comitato"}</h3>
        </div>
        <div class="iscritti-legenda">
          <span class="pill pill-private">Contatti — visibili solo a te</span>
          <span class="pill pill-public">Nome e professione — visibili a tutti</span>
        </div>
        <div id="iscritti-list"></div>
        <form class="stack" id="iscritto-form" style="margin-top:12px;">
          <div class="form-row">
            <div><label>Nome iscritto</label><input type="text" id="is-nome" required></div>
            <div><label>Professione</label><input type="text" id="is-professione" placeholder="Es. Elettricista"></div>
          </div>
          <div class="form-row">
            <div><label>Email</label><input type="email" id="is-email"></div>
            <div><label>Telefono</label><input type="tel" id="is-telefono"></div>
          </div>
          <button type="submit" class="btn primary">+ Aggiungi iscritto</button>
        </form>
      </div>

      <div id="profilo-admin-panel"></div>
    `;

    document.getElementById("profilo-logout").addEventListener("click", () => window.FN_AUTH.esci());

    document.getElementById("profilo-foto-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file || !com) return;
      const dataUrl = await window.FN_UTILS.compressImageForFirestore(file, 300000);
      if (!dataUrl) { alert("Immagine troppo pesante anche dopo la compressione: provane una più leggera."); return; }
      window.FN_COMITATI.update(com.id, { foto: dataUrl }).catch(err => alert("Errore: " + err.message));
    });

    document.getElementById("profilo-dati-form").addEventListener("submit", (e) => {
      e.preventDefault();
      window.FN_AUTH.aggiornaProfilo({
        nome: document.getElementById("pf-nome").value,
        telefono: document.getElementById("pf-telefono").value
      }).catch(err => alert("Errore: " + err.message));
    });

    document.getElementById("iscritto-form").addEventListener("submit", (e) => {
      e.preventDefault();
      window.FN_ISCRITTI.crea(stato.profile.comitatoId, {
        nome: document.getElementById("is-nome").value,
        professione: document.getElementById("is-professione").value,
        email: document.getElementById("is-email").value,
        telefono: document.getElementById("is-telefono").value
      }).then(() => e.target.reset()).catch(err => alert("Errore: " + err.message));
    });

    if (unsubIscritti) unsubIscritti();
    unsubIscritti = window.FN_ISCRITTI.ascoltaCompleti(stato.profile.comitatoId, (lista) => {
      listaIscritti = lista;
      renderIscrittiList(stato.profile.comitatoId);
    });

    if (stato.ruolo === "admin" || stato.ruolo === "superadmin") renderAdminPanel(stato);
  }

  function renderIscrittiList(comitatoId) {
    const wrap = document.getElementById("iscritti-list");
    if (!wrap) return;
    if (!listaIscritti.length) { wrap.innerHTML = '<p class="detail empty">Ancora nessun iscritto.</p>'; return; }
    wrap.innerHTML = listaIscritti.map(i => `
      <div class="iscritto-row" data-id="${i.id}">
        <div class="iscritto-info">
          <div class="iscritto-nome">${i.nome || "(senza nome)"}${i.professione ? ` — <span class="iscritto-prof">${i.professione}</span>` : ""}</div>
          <div class="iscritto-contatti">${[i.email, i.telefono].filter(Boolean).join(" · ") || "<i>nessun contatto</i>"}</div>
        </div>
        <button class="btn small" data-is-del="${i.id}">Rimuovi</button>
      </div>`).join("");
    wrap.querySelectorAll("[data-is-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (confirm("Rimuovere questo iscritto?")) window.FN_ISCRITTI.rimuovi(comitatoId, btn.dataset.isDel);
      });
    });
  }

  // -----------------------------------------------------------------------
  // Pannello amministratore: nomina admin (solo superadmin), sblocco giorni
  // -----------------------------------------------------------------------
  let unsubBlocchi = null;

  function renderAdminPanel(stato) {
    const wrap = document.getElementById("profilo-admin-panel");
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="card admin-panel">
        <h3 style="margin-top:0;">Pannello amministratore</h3>
        ${stato.ruolo === "superadmin" ? `
        <div class="admin-section">
          <label>Email del referente da nominare amministratore</label>
          <div class="form-row">
            <input type="email" id="admin-nomina-email" placeholder="email@esempio.it" style="flex:2;">
            <button class="btn primary" id="admin-nomina-btn" style="flex:1;">Nomina admin</button>
          </div>
          <div class="email-modal-status" id="admin-nomina-status"></div>
          <div class="muted" style="font-size:11.5px;">Gli admin hanno gli stessi poteri tuoi tranne uno: non possono nominare altri admin.</div>
        </div>` : ""}
        <div class="admin-section">
          <div class="form-row">
            <h4 style="margin:8px 0;">Giorni con evento bloccato</h4>
          </div>
          <div id="admin-blocchi-list"><p class="detail empty">Nessun giorno bloccato al momento.</p></div>
        </div>
      </div>`;

    if (stato.ruolo === "superadmin") {
      document.getElementById("admin-nomina-btn").addEventListener("click", () => {
        const status = document.getElementById("admin-nomina-status");
        const email = document.getElementById("admin-nomina-email").value;
        status.textContent = "Nomina in corso…";
        window.FN_AUTH.impostaRuoloPerEmail(email, "admin")
          .then(() => { status.textContent = `${email} è ora amministratore.`; })
          .catch(err => { status.textContent = "Errore: " + err.message; });
      });
    }

    if (unsubBlocchi) unsubBlocchi();
    unsubBlocchi = window.FN_BLOCCO_GIORNO.ascoltaBloccati((lista) => {
      const listEl = document.getElementById("admin-blocchi-list");
      if (!listEl) return;
      if (!lista.length) { listEl.innerHTML = '<p class="detail empty">Nessun giorno bloccato al momento.</p>'; return; }
      listEl.innerHTML = lista.map(b => `
        <div class="iscritto-row">
          <div class="iscritto-info"><div class="iscritto-nome">${b.giorno}</div></div>
          <button class="btn small" data-sblocca="${b.giorno}">Sblocca questo giorno</button>
        </div>`).join("");
      listEl.querySelectorAll("[data-sblocca]").forEach(btn => {
        btn.addEventListener("click", () => window.FN_BLOCCO_GIORNO.sblocca(btn.dataset.sblocca).catch(e => alert("Errore: " + e.message)));
      });
    });
  }

  window.FN_PROFILO = {
    init() {
      window.FN_AUTH.onChange((stato) => {
        if (!stato.pronto) return;
        if (!window.FN_FIREBASE_READY) {
          const el = container();
          if (el) el.innerHTML = `<div class="notice error">Firebase non configurato: compila firebase-config.js per abilitare login e registrazione.</div>`;
          return;
        }
        if (stato.user && stato.profile) {
          renderDashboard(stato);
        } else if (stato.user && !stato.profile) {
          // Account Firebase creato ma documento utenti non ancora arrivato
          // (es. appena dopo la registrazione): mostriamo un messaggio breve.
          const el = container();
          if (el) el.innerHTML = `<p class="detail empty">Preparazione del profilo…</p>`;
        } else {
          renderAuthForms("accedi");
        }
      });
    }
  };
})();
