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
    if (user) loadGuardUI(user);
    else showGuardLogin();
  });
});

// Muestra formulario de login para guardias
function showGuardLogin() {
  appDiv.innerHTML = `
    <h2>Login Guardia</h2>
    <form id="loginG">
      <input id="email" type="email" required placeholder="Email"/><br>
      <input id="pass"  type="password" required placeholder="Contraseña"/><br>
      <button>Entrar</button>
    </form>
    <p id="errorG" style="color:red;"></p>
  `;
  document.getElementById('loginG').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass  = document.getElementById('pass').value;
    document.getElementById('errorG').textContent = '';
    auth.signInWithEmailAndPassword(email, pass)
      .catch(err => document.getElementById('errorG').textContent = err.message);
  });
}

// Panel principal del guardia
function loadGuardUI(user) {
  appDiv.innerHTML = `
    <h2>Bienvenido, Guardia</h2>
    <button id="logoutG">Cerrar Sesión</button>
    <h3>Escanear QR de Visita</h3>
    <video id="video" width="300" height="200"></video>
    <div id="scan-result"></div>
    <h3>Visitas Pendientes</h3>
    <ul id="pending-list"></ul>
  `;
  document.getElementById('logoutG').onclick = () => auth.signOut();

  initQRScanner();
  subscribePendingVisits();
}

// Inicializa el escáner de QR con ZXing
function initQRScanner() {
  const codeReader = new ZXing.BrowserMultiFormatReader();
  const videoElem = document.getElementById('video');

  codeReader.decodeFromVideoDevice(null, videoElem, (result, err) => {
    if (result) {
      codeReader.reset();
      handleScanResult(result.getText());
    }
  });
}

// Maneja el resultado del escaneo
async function handleScanResult(text) {
  // text debería ser el ID de la visita
  const visitRef = db.collection('visits').doc(text);
  const visitSnap = await visitRef.get();
  if (!visitSnap.exists) {
    alert('Visita no encontrada');
    return;
  }
  const visit = visitSnap.data();
  if (visit.status === 'ingresado') {
    alert('Esta visita ya ingresó');
    return;
  }

  // Mostrar datos y formulario de vehículo
  document.getElementById('scan-result').innerHTML = `
    <p><strong>Visitante:</strong> ${visit.visitorName}</p>
    <p><strong>Casa/Bloque:</strong> ${visit.house} / ${visit.block}</p>
    <p><strong>Anunciante:</strong> ${visit.residentName}</p>
    <p><strong>Teléfono:</strong> ${visit.residentPhone}</p>
    <form id="vehicleForm">
      <label>Marca:<br><input id="marca" /></label><br>
      <label>Color:<br><input id="color" /></label><br>
      <label>Placa:<br><input id="placa" /></label><br>
      <button>Registrar Ingreso</button>
    </form>
  `;
  document.getElementById('vehicleForm').addEventListener('submit', async e => {
    e.preventDefault();
    await visitRef.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      vehicle: {
        marca: document.getElementById('marca').value || null,
        color: document.getElementById('color').value || null,
        placa: document.getElementById('placa').value || null
      },
      guardId: auth.currentUser.uid
    });
    alert('Ingreso registrado con éxito');
    document.getElementById('scan-result').textContent = '';
  });
}

// Muestra lista en tiempo real de visitas pendientes
function subscribePendingVisits() {
  db.collection('visits')
    .where('status', '==', 'pendiente')
    .onSnapshot(snapshot => {
      const list = document.getElementById('pending-list');
      list.innerHTML = '';
      snapshot.forEach(doc => {
        const v = doc.data();
        const li = document.createElement('li');
        li.textContent = `${v.visitorName} → ${v.house}/${v.block} (${v.scheduledTime || 'sin hora'})`;
        list.appendChild(li);
      });
    });
}

