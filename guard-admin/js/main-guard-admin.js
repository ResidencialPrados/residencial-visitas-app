// === Inicializar Firebase ===
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});

const auth = firebase.auth();
const db = firebase.firestore();

// === Cerrar sesión ===
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// === Verificar sesión y cargar dashboard ===
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "../index.html";
  } else {
    inicializarDashboard();
  }
});

function inicializarDashboard() {
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// === Validar Email ===
function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// === QR Scanner ===
function manejarQR() {
  const btnQR = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let qrScanner = null;

  btnQR.addEventListener('click', () => {
    if (!qrScanner) {
      qrDiv.style.display = 'block';
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decodedText => {
          qrScanner.stop().then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = 'none';
            qrScanner = null;
            window.location.href = `../process.html?id=${decodedText.trim()}`;
          });
        },
        err => console.warn("QR Error:", err)
      ).catch(err => {
        console.error("Error al iniciar lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    } else {
      qrScanner.stop().then(() => {
        qrDiv.innerHTML = "";
        qrDiv.style.display = 'none';
        qrScanner = null;
      });
    }
  });
}

// === Cargar visitas últimas 24h ===
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:gray;">No hay visitas en las últimas 24 horas</td></tr>`;
        return;
      }
      snapshot.forEach(doc => {
        const v = doc.data();
        const hora = v.createdAt?.toDate().toLocaleString() || '';
        const tr = document.createElement('tr');

        tr.innerHTML = `
          <td>${v.visitorName || 'Sin nombre'}</td>
          <td>${v.vehicle?.marca || ''}</td>
          <td>${v.vehicle?.color || ''}</td>
          <td>${v.vehicle?.placa || ''}</td>
          <td>${v.house || ''}</td>
          <td>${v.block || ''}</td>
          <td>${v.residentPhone || ''}</td>
          <td>${v.guardName || ''}</td>
          <td>${hora}</td>
          <td>${v.status === 'pendiente' ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>` : 'Ingresado'}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

// === Procesar Visita ===
async function procesarVisita(id) {
  try {
    const ref = db.collection('visits').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().status === 'ingresado') {
      return alert("Visita no encontrada o ya ingresada.");
    }

    const marca = prompt("Marca del vehículo:") || '';
    const color = prompt("Color del vehículo:") || '';
    const placa = prompt("Placa del vehículo:") || '';

    const guardUid = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: guardUid,
      guardName,
      vehicle: { marca, color, placa }
    });

    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error(e);
    alert("Error al procesar la visita.");
  }
}

// === Cargar Residentes ===
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let residentes = [];

  db.collection('usuarios').where('rol', '==', 'resident')
    .onSnapshot(snapshot => {
      residentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render(residentes, buscador.value);
    });

  buscador.addEventListener('input', e => render(residentes, e.target.value));

  function render(lista, filtro) {
    const filtroLower = filtro.trim().toLowerCase();
    const filtrados = lista.filter(r =>
      (r.nombre || '').toLowerCase().includes(filtroLower) ||
      (r.correo || '').toLowerCase().includes(filtroLower) ||
      (r.casa || '').toString().includes(filtroLower) ||
      (r.bloque || '').toString().includes(filtroLower) ||
      (r.telefono || '').includes(filtroLower)
    );

    tbody.innerHTML = filtrados.length ? '' : `<tr><td colspan="7" style="text-align:center;">No hay residentes que coincidan</td></tr>`;

    filtrados.forEach(residente => {
      const estado = residente.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${residente.nombre || ''}</td>
        <td>${residente.correo || ''}</td>
        <td>${residente.telefono || ''}</td>
        <td>${residente.casa || ''}</td>
        <td>${residente.bloque || ''}</td>
        <td>${estado}</td>
        <td><button onclick="registrarPago('${residente.id}')">Registrar Pago</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// === Registrar Pago ===
async function registrarPago(id) {
  if (!confirm("¿Registrar pago de este residente?")) return;
  try {
    await db.collection('usuarios').doc(id).update({
      estado_pago: 'Pagado',
      fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Pago registrado con éxito.");
  } catch (e) {
    console.error(e);
    alert("Error al registrar el pago.");
  }
}

// === Crear Usuarios con campos dinámicos ===
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const rolSelect = document.getElementById('rolUsuario');
  const msg = document.getElementById('crearUsuarioMsg');

  const emailInput = document.getElementById('nuevoEmail');
  const passInput = document.getElementById('nuevoPassword');
  const confirmInput = document.getElementById('nuevoConfirmPassword');
  const nombreInput = document.getElementById('nuevoNombre');
  const idInput = document.getElementById('nuevoIdentidad');
  const telInput = document.getElementById('nuevoTelefono');
  const casaInput = document.getElementById('nuevoCasa');
  const bloqueInput = document.getElementById('nuevoBloque');

  const campoCasa = document.getElementById('campoCasa');
  const campoBloque = document.getElementById('campoBloque');

  rolSelect.addEventListener('change', () => {
    if (rolSelect.value === 'resident') {
      campoCasa.style.display = 'block';
      campoBloque.style.display = 'block';
    } else {
      campoCasa.style.display = 'none';
      campoBloque.style.display = 'none';
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'red';

    const rol = rolSelect.value;
    const email = emailInput.value.trim();
    const password = passInput.value;
    const confirmPassword = confirmInput.value;
    const nombre = nombreInput.value.trim();
    const identidad = idInput.value.trim();
    const telefono = telInput.value.trim();
    const casa = casaInput.value.trim();
    const bloque = bloqueInput.value.trim();

    if (!rol) return msg.textContent = 'Selecciona un rol.';
    if (!email || !validarEmail(email)) return msg.textContent = 'Ingresa un correo válido.';
    if (!password || password.length < 6) return msg.textContent = 'Contraseña mínima de 6 caracteres.';
    if (password !== confirmPassword) return msg.textContent = 'Las contraseñas no coinciden.';
    if (!nombre || !identidad || !telefono) return msg.textContent = 'Completa nombre, identidad y teléfono.';
    if (rol === 'resident' && (!casa || !bloque)) return msg.textContent = 'Completa casa y bloque.';

    msg.textContent = 'Creando usuario…';

    try {
      const { user } = await auth.createUserWithEmailAndPassword(email, password);
      const data = {
        UID: user.uid,
        correo: email,
        rol,
        nombre,
        identidad,
        telefono,
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (rol === 'resident') {
        data.casa = casa;
        data.bloque = bloque;
        data.estado_pago = 'Pendiente';
      }

      await db.collection('usuarios').doc(user.uid).set(data);
      alert('✅ Usuario creado con éxito.');
      form.reset();
      rolSelect.value = '';
      campoCasa.style.display = 'none';
      campoBloque.style.display = 'none';
      msg.textContent = '';
    } catch (error) {
      console.error(error);
      msg.textContent = error.code === 'auth/email-already-in-use' ? 'El correo ya está registrado.' : 'Error: ' + error.message;
    }
  });
}
