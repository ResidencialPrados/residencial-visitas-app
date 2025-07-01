// --- Inicializar Firebase ---
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MENSAJES_ID",
  appId: "TU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// --- Puntos de entrada de la aplicación ---
window.addEventListener('load', () => {
  showLogin();
});

function showLogin() {
  // Renderiza formulario de login (email/password)
}

// Aquí luego añadiremos:
//  - Registro de token FCM tras login
//  - showResidentDashboard()
//  - showGuardDashboard()
//  - Lógica de generación de QR (usando ZXing)
//  - Lógica de escaneo de QR
//  - Registro de ingreso en Firestore
//  - Estado de pago de residentes y coloreado
