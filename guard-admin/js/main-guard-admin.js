// — Inicializar Firebase —
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

// — Cerrar sesión —
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// — Verificar sesión y rol al cargar —
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }
  const uid = user.uid;
  const userDoc = await db.collection('usuarios').doc(uid).get();
  const data = userDoc.data();

  if (!data || data.rol !== 'guard_admin') {
    if (data?.rol === 'resident') {
      window.location.href = "../resident/index.html";
    } else if (data?.rol === 'guard') {
      window.location.href = "../guard/index.html";
    } else {
      window.location.href = "../index.html";
    }
    return;
  }

  inicializarDashboard();
});

// — Inicializar Dashboard —
function inicializarDashboard() {
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// — Función auxiliar: valida email —
function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// — QR Scanner —
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

// — Cargar visitas últimas 24h —
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; color:gray;">
              No hay visitas en las últimas 24 horas
            </td>
          </tr>`;
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
          <td class="guard-cell">${v.guardName || ''}</td>
          <td>${hora}</td>
        `;

        const tdAccion = document.createElement('td');
        if (v.status === 'pendiente') {
          const btn = document.createElement('button');
          btn.textContent = 'Registrar';
          btn.className = 'btn btn-primary';
          btn.addEventListener('click', () => procesarVisita(doc.id));
          tdAccion.appendChild(btn);
        } else {
          tdAccion.textContent = 'Ingresado';
        }

        tr.appendChild(tdAccion);
        tbody.appendChild(tr);

        if (!v.guardName && v.guardId) {
          db.collection('usuarios').doc(v.guardId).get().then(snap => {
            if (snap.exists) {
              tr.querySelector('.guard-cell').textContent = snap.data().nombre;
            }
          });
        }
      });
    });
}

// — Procesar visita —
async function procesarVisita(visitaId) {
  try {
    const ref = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) return alert("Visita no encontrada.");
    if (snap.data().status === 'ingresado') return alert("Ya fue ingresada.");

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
      guardName: guardName,
      vehicle: { marca, color, placa }
    });

    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error(e);
    alert("Error al procesar la visita.");
  }
}

// — Cargar residentes y pagos —
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre || '').toLowerCase().includes(txt) ||
      (r.correo || '').toLowerCase().includes(txt) ||
      String(r.casa || '').includes(txt) ||
      String(r.bloque || '').includes(txt) ||
      (r.telefono || '').includes(txt)
    );

    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;">No hay residentes que coincidan</td>
        </tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(r => {
      const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');

      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.correo || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${estado}</td>
      `;

      const tdAccion = document.createElement('td');
      const pagarBtn = document.createElement('button');
      pagarBtn.textContent = 'Registrar Pago';
      pagarBtn.className = 'btn btn-primary';
      pagarBtn.addEventListener('click', () => registrarPago(r.id));
      tdAccion.appendChild(pagarBtn);

      tr.appendChild(tdAccion);
      tbody.appendChild(tr);
    });
  }
}

// — Registrar pago —
async function registrarPago(id) {
  if (!confirm("¿Registrar pago de este residente?")) return;
  await db.collection('usuarios').doc(id).update({
    estado_pago: 'Pagado',
    fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
  });
  alert("Pago registrado con éxito.");
}

// — Crear usuarios —
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const rolSelect = document.getElementById('rolUsuario');
  const camposExtra = document.getElementById('camposExtra');
  const msg = document.getElementById('crearUsuarioMsg');

  const emailInput = document.getElementById('nuevoEmail');
  const passInput = document.getElementById('nuevoPassword');
  const confirmInput = document.getElementById('nuevoConfirmPassword');
  const nombreInput = document.getElementById('nuevoNombre');
  const idInput = document.getElementById('nuevoIdentidad');
  const telInput = document.getElementById('nuevoTelefono');
  const casaInput = document.getElementById('nuevoCasa');
  const bloqueInput = document.getElementById('nuevoBloque');

  form.reset();
  camposExtra.style.display = 'none';
  msg.textContent = '';
  msg.style.color = 'red';

  rolSelect.addEventListener('change', () => {
    camposExtra.style.display = rolSelect.value ? 'block' : 'none';
    msg.textContent = '';
    [nombreInput, idInput, telInput, casaInput, bloqueInput].forEach(i =>
      i.parentElement.style.display = 'none'
    );

    if (rolSelect.value === 'guard' || rolSelect.value === 'guard_admin') {
      nombreInput.parentElement.style.display = 'block';
      idInput.parentElement.style.display = 'block';
      telInput.parentElement.style.display = 'block';
    } else if (rolSelect.value === 'resident') {
      nombreInput.parentElement.style.display = 'block';
      idInput.parentElement.style.display = 'block';
      telInput.parentElement.style.display = 'block';
      casaInput.parentElement.style.display = 'block';
      bloqueInput.parentElement.style.display = 'block';
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'red';

    const rol = rolSelect.value;
    const email = emailInput.value.trim();
    const password = passInput.value;
    const password2 = confirmInput.value;
    const nombre = nombreInput.value.trim();
    const identidad = idInput.value.trim();
    const telefono = telInput.value.trim();
    const casa = casaInput.value.trim();
    const bloque = bloqueInput.value.trim();

    if (!rol) {
      msg.textContent = 'Selecciona un rol.';
      return;
    }
    if (!email || !validarEmail(email)) {
      msg.textContent = 'Ingresa un correo válido.';
      return;
    }
    if (!password || password.length < 6) {
      msg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (password !== password2) {
      msg.textContent = 'Las contraseñas no coinciden.';
      return;
    }
    if ((rol === 'guard' || rol === 'guard_admin') && (!nombre || !identidad || !telefono)) {
      msg.textContent = 'Completa nombre, identidad y teléfono.';
      return;
    }
    if (rol === 'resident' && (!nombre || !identidad || !telefono || !casa || !bloque)) {
      msg.textContent = 'Completa todos los campos para residentes.';
      return;
    }

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

      msg.style.color = 'green';
      msg.textContent = 'Usuario creado con éxito.';
      form.reset();
      camposExtra.style.display = 'none';
      rolSelect.value = '';
    } catch (error) {
      console.error(error);
      msg.textContent = error.code === 'auth/email-already-in-use'
        ? 'El correo ya está registrado.'
        : 'Error: ' + error.message;
    }
  });
}
