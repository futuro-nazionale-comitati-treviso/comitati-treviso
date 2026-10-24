// ============================================================================
// CONFIGURAZIONE FIREBASE — DA COMPILARE
// ============================================================================
// 1. Vai su https://console.firebase.google.com/ e crea un progetto (gratuito,
//    piano "Spark" basta per questo uso).
// 2. Nel progetto: "Crea app" -> icona Web (</>) -> dai un nome (es. "comitati-tv").
//    NON serve Hosting Firebase, ospitiamo su GitHub Pages: salta quel passaggio.
// 3. Copia l'oggetto "firebaseConfig" che ti mostra e incollalo qui sotto,
//    sostituendo i valori placeholder.
// 4. Nel menu laterale vai su "Firestore Database" -> "Crea database" ->
//    scegli una regione europea (es. eur3) -> avvia in modalita' produzione.
// 5. Vai su "Regole" e incolla le regole suggerite in README.md (sezione
//    "Regole Firestore"), poi Pubblica.
// ============================================================================

const firebaseConfig = {
  apiKey: "AIzaSyAP7-ocDo7w1uEgwwSxpAjMpwVwRM9hFdw",
  authDomain: "comitati-treviso.firebaseapp.com",
  projectId: "comitati-treviso",
  storageBucket: "comitati-treviso.firebasestorage.app",
  messagingSenderId: "923701126894",
  appId: "1:923701126894:web:debdb8af331a39c24235ff"
};

// Inizializzazione (SDK compat, caricato via CDN in index.html).
// Se non hai ancora compilato la config sopra, l'app funziona comunque per
// mappa/rubrica (dati statici in data.js): solo Eventi resta
// disabilitato finche' non colleghi Firebase.
window.FN_FIREBASE_READY = false;
try {
  if (firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("INCOLLA")) {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.FN_FIREBASE_READY = true;
  } else {
    console.warn("[FN] Firebase non configurato: compila firebase-config.js per abilitare Eventi.");
  }
} catch (e) {
  console.error("[FN] Errore inizializzazione Firebase:", e);
}
