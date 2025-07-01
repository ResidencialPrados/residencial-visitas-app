// --- Inicializar Firebase ---
firebase.initializeApp({
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_MENSAJES_ID",
  appId: "TU_APP_ID"
});
const auth = firebase.auth();
const db   = firebase.firestore();

// Referencia al contenedor principal
const appDiv = document.getElementById('app');

// Escucha cambios de autenticación
window.addEventListener('load', () => {
  auth.onAuthStateChanged(user => {
    if (user) loadResidentUI(user);
    else showResidentLogin();
  });
});

// Muestra formulario de login para residentes
function showResidentLogin() {
  appDiv.innerHTML = `
    <h2>Login Residente</h2>
    <form id="loginR">
      <input id="email" type="email" required placeholder="Email"/><br>
      <input id="pass"  type="password" required placeholder="Contraseña"/><br>
      <button>Entrar</button>
    </form>
    <p id="errorR" style="color:red;"></p>
  `;
  document.getElementById('loginR').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass  = document.getElementById('pass').value;
    document.getElementById('errorR').textContent = '';
    auth.signInWithEmailAndPassword(email, pass)
      .catch(err => document.getElementById('errorR').textContent = err.message);
  });
}

// Panel principal del residente
function loadResidentUI(user) {
  appDiv.innerHTML = `
    <h2>Bienvenido, ${user.email}</h2>
    <button id="logoutR">Cerrar Sesión</button>
    <h3>Anunciar Nueva Visita</h3>
    <form id="visitForm">
      <input id="visitorName" type="text" required placeholder="Nombre del visitante"/><br>
      <input id="house" type="text" required placeholder="Casa"/><br>
      <input id="block" type="text" required placeholder="Bloque"/><br>
      <input id="phone" type="tel" required placeholder="Tu teléfono"/><br>
      <button>Generar QR</button>
    </form>
    <div id="qrcode"></div>
  `;
  document.getElementById('logoutR').onclick = () => auth.signOut();
  document.getElementById('visitForm').addEventListener('submit', handleVisit);
}

// Maneja la creación de visita y generación de QR
async function handleVisit(e) {
  e.preventDefault();
  const visitorName = document.getElementById('visitorName').value;
  const house       = document.getElementById('house').value;
  const block       = document.getElementById('block').value;
  const phone       = document.getElementById('phone').value;
  // Crea documento en Firestore
  const ref = await db.collection('visits').add({
    visitorName,
    house,
    block,
    residentId: auth.currentUser.uid,
    residentName: auth.currentUser.email,
    residentPhone: phone,
    status: 'pendiente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  // Genera QR con el ID del documento
  document.getElementById('qrcode').innerHTML = '';
  new QRCode(document.getElementById('qrcode'), {
    text: ref.id,
    width: 200,
    height: 200
  });
}
