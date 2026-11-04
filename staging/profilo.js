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
          <div id="reg-privacy"></div>
          <button type="submit" class="btn primary">Crea account e invia verifica</button>
        </form>
        <p class="auth-hint">Nessuna approvazione manuale: ricevi una mail di verifica e sei subito operativo sul comitato che hai indicato. Gli iscritti non hanno un proprio accesso: li inserisci tu da qui una volta registrato.</p>`;
      const spuntaPrivacy = window.FN_PRIVACY.creaSpunta(document.getElementById("reg-privacy"));
      document.getElementById("register-form").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!spuntaPrivacy.isChecked()) { status.textContent = "Spunta la casella di presa visione per procedere."; return; }
        status.textContent = "Creazione account in corso…";
        window.FN_AUTH.registrati({
          nome: document.getElementById("reg-nome").value,
          comitatoNome: document.getElementById("reg-comitato").value,
          email: document.getElementById("reg-email").value,
          password: document.getElementById("reg-password").value,
          telefono: document.getElementById("reg-telefono").value,
          privacyAccettata: true
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
        <h3 style="margin-top:0;">Sede del comitato</h3>
        <form class="stack" id="profilo-sede-form">
          <label>Indirizzo</label>
          <input type="text" id="pf-sede" value="${com && com.indirizzo ? com.indirizzo : ""}" placeholder="Es. Piazza dei Signori 1, Treviso">
          <button type="submit" class="btn primary">📍 Salva e geolocalizza</button>
          <div class="email-modal-status" id="profilo-sede-status">${com && com.lat != null ? `Posizione salvata: ${com.lat.toFixed(5)}, ${com.lon.toFixed(5)}` : ""}</div>
        </form>
      </div>

      <div class="card iscritti-card">
        <div class="iscritti-card-head">
          <h3 style="margin:0;">👥 Iscritti del ${com ? com.name : "tuo comitato"}</h3>
        </div>
        <div class="iscritti-legenda">
          <span class="pill pill-private">Contatti — visibili solo a te</span>
          <span class="pill pill-public">Nome e professione — visibili a tutti</span>
        </div>
        <div id="iscritti-list"></div>
        <details class="iscritti-import" style="margin-top:12px;">
          <summary style="cursor:pointer;font-weight:700;">📥 Importa da Excel (elenco membri del sito ufficiale)</summary>
          <p class="muted" style="font-size:12px;margin:8px 0;">Il file resta sul tuo dispositivo: viene letto qui e non viene caricato da nessuna parte. Vengono importati solo nome, numero di tessera, email e cellulare; codice fiscale e indirizzo vengono ignorati. Reimportare lo stesso file non crea doppioni. Gli iscritti importati restano visibili solo a te finché non indichi la professione.</p>
          <input type="file" id="is-import-file" accept=".xlsx,.xls,.csv">
          <div id="is-import-anteprima" class="email-modal-status"></div>
          <button type="button" class="btn primary" id="is-import-conferma" style="display:none;margin-top:8px;"></button>
        </details>
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

    document.getElementById("profilo-sede-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!com) return;
      const sedeStatus = document.getElementById("profilo-sede-status");
      const indirizzo = document.getElementById("pf-sede").value;
      sedeStatus.textContent = "Ricerca della posizione in corso…";
      const pos = await window.FN_UTILS.geocodeIndirizzo(indirizzo);
      if (!pos) {
        sedeStatus.textContent = "Indirizzo non trovato: prova a scriverlo in modo più preciso (via, numero civico, comune).";
        return;
      }
      window.FN_COMITATI.update(com.id, { indirizzo, lat: pos.lat, lon: pos.lon })
        .then(() => { sedeStatus.textContent = `Posizione salvata: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`; })
        .catch(err => { sedeStatus.textContent = "Errore: " + err.message; });
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

    let importPronto = null;
    const fileInput = document.getElementById("is-import-file");
    const anteprimaEl = document.getElementById("is-import-anteprima");
    const confermaBtn = document.getElementById("is-import-conferma");
    fileInput.addEventListener("change", async () => {
      importPronto = null; confermaBtn.style.display = "none";
      const f = fileInput.files[0];
      if (!f) { anteprimaEl.textContent = ""; return; }
      anteprimaEl.textContent = "Lettura del file…";
      try {
        const lett = await window.FN_ISCRITTI.leggiExcel(f);
        const { nuove, gia } = await window.FN_ISCRITTI.anteprimaImport(stato.profile.comitatoId, lett.righe);
        const parti = [`${lett.righe.length} tesserati nel file`, `${nuove.length} nuovi`, `${gia.length} già presenti (non toccati)`];
        if (lett.scartate.length) parti.push(`${lett.scartate.length} righe scartate (${lett.scartate.slice(0, 5).map(x => `riga ${x.riga}: ${x.motivo}`).join("; ")}${lett.scartate.length > 5 ? "…" : ""})`);
        if (lett.doppioniNelFile) parti.push(`${lett.doppioniNelFile} doppioni nel file ignorati`);
        anteprimaEl.textContent = parti.join(" · ");
        if (nuove.length) {
          importPronto = nuove;
          confermaBtn.textContent = `Importa ${nuove.length} nuovi tesserati`;
          confermaBtn.style.display = "";
        }
      } catch (err) { anteprimaEl.textContent = "Errore: " + err.message; }
    });
    confermaBtn.addEventListener("click", async () => {
      if (!importPronto) return;
      confermaBtn.disabled = true;
      try {
        const n = await window.FN_ISCRITTI.importa(stato.profile.comitatoId, importPronto);
        anteprimaEl.textContent = `Importati ${n} tesserati. Ora puoi aggiungere la professione a ciascuno dall'elenco qui sopra.`;
        importPronto = null; confermaBtn.style.display = "none"; fileInput.value = "";
      } catch (err) { anteprimaEl.textContent = "Errore: " + err.message; }
      confermaBtn.disabled = false;
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
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    wrap.innerHTML = listaIscritti.map(i => `
      <div class="iscritto-row" data-id="${esc(i.id)}">
        <div class="iscritto-info">
          <div class="iscritto-nome">${esc(i.nome) || "(senza nome)"}${i.professione ? ` — <span class="iscritto-prof">${esc(i.professione)}</span>` : ""}</div>
          <div class="iscritto-contatti">${[i.email, i.telefono].filter(Boolean).map(esc).join(" · ") || "<i>nessun contatto</i>"}</div>
          ${i.professione ? "" : `<div class="form-row" style="margin-top:6px;gap:6px;">
            <input type="text" placeholder="Professione (poi diventa visibile a tutti con il nome)" data-is-prof-input="${esc(i.id)}" style="flex:3;">
            <button class="btn small" data-is-prof="${esc(i.id)}">Salva</button>
          </div>`}
        </div>
        <button class="btn small" data-is-del="${esc(i.id)}">Rimuovi</button>
      </div>`).join("");
    wrap.querySelectorAll("[data-is-prof]").forEach(btn => {
      btn.addEventListener("click", () => {
        const inp = wrap.querySelector(`[data-is-prof-input="${btn.dataset.isProf}"]`);
        const prof = (inp && inp.value || "").trim();
        if (!prof) return;
        btn.disabled = true;
        window.FN_ISCRITTI.aggiorna(comitatoId, btn.dataset.isProf, { professione: prof })
          .catch(err => { alert("Errore: " + err.message); btn.disabled = false; });
      });
    });
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

  function renderListaAdmin() {
    const wrap = document.getElementById("admin-lista-admin");
    if (!wrap) return;
    wrap.innerHTML = '<p class="detail empty">Caricamento…</p>';
    window.FN_AUTH.elencaAdmin().then(lista => {
      const altri = lista.filter(u => u.ruolo === "admin");
      wrap.innerHTML = altri.length
        ? altri.map(u => `
          <div class="iscritto-row" data-uid="${u.uid}">
            <div class="iscritto-info">
              <div class="iscritto-nome">${u.nome || "(senza nome)"}</div>
              <div class="iscritto-contatti">${u.email || ""}</div>
            </div>
            <button class="btn small" data-revoca="${u.uid}" data-email="${u.email || ""}">Revoca admin</button>
          </div>`).join("")
        : '<p class="detail empty">Nessun altro amministratore nominato.</p>';
      wrap.querySelectorAll("[data-revoca]").forEach(btn => {
        btn.addEventListener("click", () => {
          if (!confirm(`Togliere i permessi di amministratore a ${btn.dataset.email}?`)) return;
          window.FN_AUTH.impostaRuoloPerEmail(btn.dataset.email, "referente")
            .then(() => renderListaAdmin())
            .catch(err => alert("Errore: " + err.message));
        });
      });
    }).catch(err => { wrap.innerHTML = `<p class="detail empty">Errore: ${err.message}</p>`; });
  }

  // Elenco comitati con stato dell'account del referente (solo superadmin).
  async function renderCreaReferenti() {
    const wrap = document.getElementById("admin-ref-lista");
    if (!wrap) return;
    const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    wrap.innerHTML = '<p class="detail empty">Caricamento…</p>';
    let utenti;
    try { utenti = await window.FN_AUTH.elencaUtenti(); }
    catch (err) { wrap.innerHTML = `<p class="detail empty">Errore: ${esc(err.message)}</p>`; return; }
    const perEmail = new Map(utenti.map(u => [String(u.email || "").toLowerCase(), u]));
    const righe = window.FN_COMITATI.getAll()
      .filter(c => c.email)
      .sort((a, b) => a.name.localeCompare(b.name, "it"))
      .map(c => ({ c, u: perEmail.get(c.email.trim().toLowerCase()) || null }));
    const daCreare = righe.filter(r => !r.u);
    // Solo gli account creati da qui e non ancora invitati: chi si era gia' registrato da solo (o sei tu) non riceve nulla.
    const daInvitare = righe.filter(r => r.u && r.u.creatoDa && r.u.ruolo === "referente" && !r.u.invitoInviatoIl);
    wrap.innerHTML = `
      <div class="muted" style="font-size:12px;margin:8px 0;">${righe.length} comitati con email · ${daCreare.length} senza account · ${daInvitare.length} con account ma non ancora invitati</div>
      <div id="admin-ref-righe">${righe.map(({ c, u }) => `
        <div class="iscritto-row">
          <div class="iscritto-info">
            <div class="iscritto-nome">${esc(c.name)}</div>
            <div class="iscritto-contatti">${esc(c.ref || "(referente non indicato)")} · ${esc(c.email)}</div>
          </div>
          <span class="pill ${u ? ((u.invitoInviatoIl || !u.creatoDa) ? "pill-public" : "pill-private") : ""}">${u ? ((u.invitoInviatoIl || !u.creatoDa) ? "Ha già accesso" : "Account creato") : "Da creare"}</span>
        </div>`).join("")}</div>
      <div class="form-row" style="margin-top:10px;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn primary" id="admin-ref-crea" ${daCreare.length ? "" : "disabled"}>Crea ${daCreare.length} account (nessuna email)</button>
        <button type="button" class="btn" id="admin-ref-invita" ${daInvitare.length ? "" : "disabled"}>Invia link password a ${daInvitare.length}</button>
      </div>
      <div class="email-modal-status" id="admin-ref-status"></div>`;
    const status = document.getElementById("admin-ref-status");

    document.getElementById("admin-ref-crea").addEventListener("click", async (e) => {
      if (!confirm(`Creare ${daCreare.length} account referente? Non viene inviata nessuna email.`)) return;
      e.target.disabled = true;
      let ok = 0; const errori = [];
      for (const { c } of daCreare) {
        status.textContent = `Creazione ${ok + errori.length + 1}/${daCreare.length}…`;
        try {
          await window.FN_AUTH.creaReferente({ email: c.email, nome: c.ref || c.name, telefono: c.tel, comitatoId: c.id });
          ok++;
        } catch (err) {
          errori.push(`${c.name}: ${err.code === "auth/email-already-in-use" ? "esiste già un account con questa email" : err.message}`);
        }
      }
      status.textContent = `Creati ${ok} account.` + (errori.length ? ` Non riusciti (${errori.length}): ${errori.join("; ")}` : "");
      renderCreaReferenti().then(() => { document.getElementById("admin-ref-status").textContent = status.textContent; });
    });

    document.getElementById("admin-ref-invita").addEventListener("click", async (e) => {
      if (!confirm(`Inviare ora l'email con il link per impostare la password a ${daInvitare.length} referenti?`)) return;
      e.target.disabled = true;
      let ok = 0; const errori = [];
      for (const { c, u } of daInvitare) {
        status.textContent = `Invio ${ok + errori.length + 1}/${daInvitare.length}…`;
        try { await window.FN_AUTH.invitaReferente(u.uid, u.email); ok++; }
        catch (err) { errori.push(`${c.name}: ${err.message}`); }
      }
      const msg = `Inviati ${ok} inviti.` + (errori.length ? ` Non riusciti (${errori.length}): ${errori.join("; ")}` : "");
      renderCreaReferenti().then(() => { document.getElementById("admin-ref-status").textContent = msg; });
    });
  }

  function renderAdminPanel(stato) {
    const wrap = document.getElementById("profilo-admin-panel");
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="card admin-panel">
        <h3 style="margin-top:0;">Pannello amministratore</h3>
        ${stato.ruolo === "superadmin" ? `
        <div class="admin-section">
          <h4 style="margin:8px 0;">Gestisci amministratori</h4>
          <label>Email del referente da nominare amministratore</label>
          <div class="form-row">
            <input type="email" id="admin-nomina-email" placeholder="email@esempio.it" style="flex:2;">
            <button class="btn primary" id="admin-nomina-btn" style="flex:1;">Nomina admin</button>
          </div>
          <div class="email-modal-status" id="admin-nomina-status"></div>
          <div class="muted" style="font-size:11.5px;margin-bottom:10px;">Gli admin hanno gli stessi poteri tuoi tranne uno: non possono nominare altri admin.</div>
          <div id="admin-lista-admin"></div>
        </div>
        <div class="admin-section">
          <h4 style="margin:8px 0;">Allinea comitati con l'elenco ufficiale</h4>
          <div class="muted" style="font-size:11.5px;margin-bottom:6px;">Aggiunge i comitati dell'elenco ufficiale che non sono ancora nel database. Non modifica quelli esistenti.</div>
          <button type="button" class="btn" id="admin-riallinea-btn">Allinea ora</button>
          <div class="email-modal-status" id="admin-riallinea-status"></div>
        </div>
        <div class="admin-section">
          <h4 style="margin:8px 0;">Crea account referenti</h4>
          <div class="muted" style="font-size:11.5px;margin-bottom:6px;">Crea l'account di ogni referente usando l'email del suo comitato. Creare l'account non invia nessuna email: i link per impostare la password si inviano dopo, con il pulsante dedicato, quando decidi tu.</div>
          <button type="button" class="btn" id="admin-ref-carica">Mostra comitati</button>
          <div id="admin-ref-lista"></div>
        </div>
        <div class="admin-section">
          <h4 style="margin:8px 0;">Gestione referenti</h4>
          <label>Email del referente da cercare</label>
          <div class="form-row">
            <input type="email" id="admin-cerca-email" placeholder="email@esempio.it" style="flex:2;">
            <button type="button" class="btn" id="admin-cerca-btn" style="flex:1;">Cerca</button>
          </div>
          <div id="admin-referente-risultato"></div>
        </div>` : ""}
        <div class="admin-section">
          <div class="form-row">
            <h4 style="margin:8px 0;">Giorni con evento bloccato</h4>
          </div>
          <div id="admin-blocchi-list"><p class="detail empty">Nessun giorno bloccato al momento.</p></div>
        </div>
      </div>`;

    if (stato.ruolo === "superadmin") {
      document.getElementById("admin-ref-carica").addEventListener("click", () => renderCreaReferenti());
      document.getElementById("admin-riallinea-btn").addEventListener("click", () => {
        const st = document.getElementById("admin-riallinea-status");
        st.textContent = "Allineamento in corso…";
        window.FN_COMITATI.riallineaDaStatico()
          .then(n => { st.textContent = n.length ? `Aggiunti ${n.length} comitati: ${n.join(", ")}.` : "Nessun comitato da aggiungere: sei già allineato."; })
          .catch(err => { st.textContent = "Errore: " + err.message; });
      });
      document.getElementById("admin-nomina-btn").addEventListener("click", () => {
        const status = document.getElementById("admin-nomina-status");
        const email = document.getElementById("admin-nomina-email").value;
        status.textContent = "Nomina in corso…";
        window.FN_AUTH.impostaRuoloPerEmail(email, "admin")
          .then(() => { status.textContent = `${email} è ora amministratore.`; renderListaAdmin(); })
          .catch(err => { status.textContent = "Errore: " + err.message; });
      });
      renderListaAdmin();

      document.getElementById("admin-cerca-btn").addEventListener("click", async () => {
        const risultato = document.getElementById("admin-referente-risultato");
        const email = document.getElementById("admin-cerca-email").value;
        risultato.innerHTML = '<p class="detail empty">Ricerca…</p>';
        try {
          const u = await window.FN_AUTH.cercaUtentePerEmail(email);
          if (!u) { risultato.innerHTML = '<p class="detail empty">Nessun referente trovato con questa email.</p>'; return; }
          const comRef = window.FN_COMITATI.getById(u.comitatoId);
          risultato.innerHTML = `
            <form class="stack" id="admin-edit-referente-form" style="margin-top:8px;">
              <label>Nome e cognome</label>
              <input type="text" id="admin-edit-nome" value="${u.nome || ""}">
              <label>Telefono</label>
              <input type="tel" id="admin-edit-telefono" value="${u.telefono || ""}">
              <div class="muted" style="font-size:11.5px;">Comitato: ${comRef ? comRef.name : "—"} · ruolo: ${ruoloLabel(u.ruolo)}</div>
              <div class="actions">
                <button type="submit" class="btn primary">Salva dati referente</button>
                ${comRef ? '<button type="button" class="btn" id="admin-edit-comitato-btn">✏️ Modifica scheda comitato</button>' : ""}
                <button type="button" class="btn danger" id="admin-elimina-referente-btn" style="margin-left:auto;">🗑️ Elimina referente</button>
              </div>
              <div class="email-modal-status" id="admin-edit-status"></div>
            </form>`;
          document.getElementById("admin-edit-referente-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const status = document.getElementById("admin-edit-status");
            status.textContent = "Salvataggio…";
            window.FN_AUTH.aggiornaProfiloDi(u.uid, {
              nome: document.getElementById("admin-edit-nome").value,
              telefono: document.getElementById("admin-edit-telefono").value
            }).then(() => { status.textContent = "Dati aggiornati."; }).catch(err => { status.textContent = "Errore: " + err.message; });
          });
          if (comRef) {
            document.getElementById("admin-edit-comitato-btn").addEventListener("click", () => {
              window.FN_RUBRICA.openComitatoModal(comRef);
            });
          }
          document.getElementById("admin-elimina-referente-btn").addEventListener("click", () => {
            if (!confirm(`Cancellare definitivamente il profilo di ${u.nome || u.email}? Il comitato e i suoi iscritti restano, ma la persona perde l'accesso alla pagina Profilo.`)) return;
            window.FN_AUTH.eliminaUtente(u.uid)
              .then(() => { risultato.innerHTML = '<p class="detail empty">Profilo cancellato.</p>'; })
              .catch(err => alert("Errore: " + err.message));
          });
        } catch (err) {
          risultato.innerHTML = `<p class="detail empty">Errore: ${err.message}</p>`;
        }
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
