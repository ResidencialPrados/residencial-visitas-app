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
  auth.signOut().then(() => location.href = '../index.html');
});

// === Verificar sesión ===
auth.onAuthStateChanged(async user => {
  if (!user) {
    location.href = '../index.html';
    return;
  }
  const doc = await db.collection('usuarios').doc(user.uid).get();
  const data = doc.data();
  if (!data || data.rol !== 'guard_admin') {
    location.href = '../index.html';
    return;
  }
  inicializarDashboard();
});

// === Inicializar Dashboard ===
function inicializarDashboard() {
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// === Validar email ===
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
            location.href = `../process.html?id=${decodedText.trim()}`;
          });
        },
        err => console.warn("QR Error:", err)
      ).catch(err => {
        console.error("Error QR:", err);
        alert("Error al iniciar QR: " + err.message);
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

// === Cargar visitas ===
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:gray;">No hay visitas</td></tr>`;
        return;
      }
      snapshot.forEach(doc => {
        const v = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${v.visitorName || ''}</td>
          <td>${v.vehicle?.marca || ''}</td>
          <td>${v.vehicle?.color || ''}</td>
          <td>${v.vehicle?.placa || ''}</td>
          <td>${v.house || ''}</td>
          <td>${v.block || ''}</td>
          <td>${v.residentPhone || ''}</td>
          <td>${v.guardName || ''}</td>
          <td>${v.createdAt?.toDate().toLocaleString() || ''}</td>
          <td>${v.status === 'pendiente' ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>` : 'Ingresado'}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

// === Procesar visita ===
async function procesarVisita(id) {
  const ref = db.collection('visits').doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status === 'ingresado') {
    alert('Visita no encontrada o ya ingresada.');
    return;
  }
  const marca = prompt('Marca del vehículo:') || '';
  const color = prompt('Color del vehículo:') || '';
  const placa = prompt('Placa del vehículo:') || '';
  const guardId = auth.currentUser.uid;
  const guardDoc = await db.collection('usuarios').doc(guardId).get();
  const guardName = guardDoc.data()?.nombre || 'Guardia';

  await ref.update({
    status: 'ingresado',
    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
    guardId,
    guardName,
    vehicle: { marca, color, placa }
  });
  alert('Visita registrada correctamente.');
}

// === Cargar residentes ===
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');

  db.collection('usuarios').where('rol', '==', 'resident')
    .onSnapshot(snapshot => {
      const residentes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      render(residentes);
      buscador.addEventListener('input', () => render(residentes));
    });

  function render(residentes) {
    const filtro = buscador.value.toLowerCase();
    tbody.innerHTML = '';
    const filtrados = residentes.filter(r =>
      (r.nombre || '').toLowerCase().includes(filtro) ||
      (r.correo || '').toLowerCase().includes(filtro) ||
      (r.telefono || '').includes(filtro) ||
      (r.casa || '').includes(filtro) ||
      (r.bloque || '').includes(filtro)
    );
    if (!filtrados.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }
    filtrados.forEach(r => {
      const tr = document.createElement('tr');
      const estado = r.estado_pago === 'Pagado' ? `Pagado hasta: ${r.mes_pago || ''}` : 'Pendiente';
      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.correo || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${estado}</td>
        <td><button onclick="registrarPago('${r.id}')">Registrar Pago</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// === Registrar pago ===
async function registrarPago(id) {
  if (!confirm('¿Registrar pago?')) return;
  const now = new Date();
  const mes_pago = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  await db.collection('usuarios').doc(id).update({
    estado_pago: 'Pagado',
    mes_pago,
    fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert('Pago registrado correctamente.');
}

// === Manejar creación de usuarios ===
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const rolSelect = document.getElementById('rolUsuario');
  const camposExtra = document.getElementById('camposExtra');
  const msg = document.getElementById('crearUsuarioMsg');

  const email = document.getElementById('nuevoEmail');
  const pass = document.getElementById('nuevoPassword');
  const confirm = document.getElementById('nuevoConfirmPassword');
  const nombre = document.getElementById('nuevoNombre');
  const identidad = document.getElementById('nuevoIdentidad');
  const telefono = document.getElementById('nuevoTelefono');
  const casa = document.getElementById('nuevoCasa');
  const bloque = document.getElementById('nuevoBloque');

  // Mostrar campos según rol
  rolSelect.addEventListener('change', () => {
    camposExtra.classList.remove('hidden');
    document.getElementById('labelNombre').classList.add('hidden');
    document.getElementById('labelIdentidad').classList.add('hidden');
    document.getElementById('labelTelefono').classList.add('hidden');
    document.getElementById('labelCasa').classList.add('hidden');
    document.getElementById('labelBloque').classList.add('hidden');

    if (rolSelect.value === 'guard' || rolSelect.value === 'guard_admin') {
      document.getElementById('labelNombre').classList.remove('hidden');
      document.getElementById('labelIdentidad').classList.remove('hidden');
      document.getElementById('labelTelefono').classList.remove('hidden');
    }
    if (rolSelect.value === 'resident') {
      document.getElementById('labelNombre').classList.remove('hidden');
      document.getElementById('labelIdentidad').classList.remove('hidden');
      document.getElementById('labelTelefono').classList.remove('hidden');
      document.getElementById('labelCasa').classList.remove('hidden');
      document.getElementById('labelBloque').classList.remove('hidden');
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'red';

    if (!rolSelect.value) return msg.textContent = 'Selecciona un rol.';
    if (!validarEmail(email.value)) return msg.textContent = 'Correo inválido.';
    if (pass.value.length < 6) return msg.textContent = 'Contraseña mínima 6 caracteres.';
    if (pass.value !== confirm.value) return msg.textContent = 'Contraseñas no coinciden.';
    if (!nombre.value || !identidad.value || !telefono.value) return msg.textContent = 'Completa los campos requeridos.';
    if (rolSelect.value === 'resident' && (!casa.value || !bloque.value)) return msg.textContent = 'Completa casa y bloque para residente.';

    msg.textContent = 'Creando usuario...';
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email.value.trim(), pass.value);
      const data = {
        UID: user.uid,
        correo: email.value.trim(),
        rol: rolSelect.value,
        nombre: nombre.value.trim(),
        identidad: identidad.value.trim(),
        telefono: telefono.value.trim(),
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (rolSelect.value === 'resident') {
        data.casa = casa.value.trim();
        data.bloque = bloque.value.trim();
        data.estado_pago = 'Pagado';
        data.mes_pago = `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
        data.fecha_pago = firebase.firestore.FieldValue.serverTimestamp();
      }

      await db.collection('usuarios').doc(user.uid).set(data);
      msg.style.color = 'green';
      msg.textContent = '✅ Usuario creado correctamente.';
      form.reset();
      camposExtra.classList.add('hidden');
      rolSelect.value = '';
    } catch (e) {
      console.error(e);
      msg.textContent = e.code === 'auth/email-already-in-use' ? 'Correo ya registrado.' : 'Error: ' + e.message;
    }
  });
}
