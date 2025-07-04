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

// === Enlazar botón “Ver Historial” ===
document.getElementById('toggleHistorialBtn').addEventListener('click', () => {
  window.location.href = 'historial.html';
});

// === Variables modal de pago ===
const modalPago = document.getElementById('modalPago');
const modalPagoNombre = document.getElementById('modalPagoNombre');
const mesPagoSelect = document.getElementById('mesPago');
const anioPagoSelect = document.getElementById('anioPago');
const confirmarPagoBtn = document.getElementById('confirmarPagoBtn');
const cancelarPagoBtn = document.getElementById('cancelarPagoBtn');

let pagoResidenteId = null;
let pagoResidenteNombre = null;

// === Abrir modal de pago ===
function abrirModalPago(residente) {
  pagoResidenteId = residente.id;
  pagoResidenteNombre = residente.nombre || 'Sin nombre';

  modalPagoNombre.textContent = `Residente: ${pagoResidenteNombre}`;

  const anioActual = new Date().getFullYear();
  anioPagoSelect.innerHTML = '';
  for (let i = anioActual; i <= anioActual + 2; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    anioPagoSelect.appendChild(opt);
  }

  modalPago.classList.add('show');
}

// === Cerrar modal de pago ===
cancelarPagoBtn.addEventListener('click', () => {
  modalPago.classList.remove('show');
  pagoResidenteId = null;
  pagoResidenteNombre = null;
});

// === Confirmar y registrar pago ===
confirmarPagoBtn.addEventListener('click', async () => {
  if (!pagoResidenteId) return;

  const mes = mesPagoSelect.value.padStart(2, '0');
  const anio = anioPagoSelect.value;
  const fechaPago = `${mes}-${anio}`;

  try {
    await db.collection('usuarios').doc(pagoResidenteId).update({
      estado_pago: 'Pagado',
      fecha_pago: firebase.firestore.FieldValue.serverTimestamp(),
      mes_pago: fechaPago
    });

    alert(`✅ Gracias por su pago.\nSu siguiente pago será el siguiente mes.`);
    modalPago.classList.remove('show');
    pagoResidenteId = null;
    pagoResidenteNombre = null;
  } catch (error) {
    console.error(error);
    alert('❌ Error al registrar el pago.');
  }
});

// === Verificar sesión y rol ===
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
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
  const guardUid = auth.currentUser.uid;
  const guardSnap = await db.collection('usuarios').doc(guardUid).get();
  const guardName = guardSnap.data()?.nombre || 'Desconocido';

  await ref.update({
    status: 'ingresado',
    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
    guardId: guardUid,
    guardName,
    vehicle: { marca, color, placa }
  });
  alert('Ingreso registrado con éxito.');
}

// === Cargar residentes y pagos ===
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

    tbody.innerHTML = filtrados.length ? '' :
      `<tr><td colspan="7" style="text-align:center;">No hay residentes que coincidan</td></tr>`;

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
      `;

      const tdAccion = document.createElement('td');
      const btnPagar = document.createElement('button');
      btnPagar.textContent = 'Registrar Pago';
      btnPagar.className = 'btn btn-primary';
      btnPagar.addEventListener('click', () => abrirModalPago(residente));
      tdAccion.appendChild(btnPagar);

      tr.appendChild(tdAccion);
      tbody.appendChild(tr);
    });
  }
}

// === Crear usuarios ===
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const rol = document.getElementById('rolUsuario');
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

  rol.addEventListener('change', () => {
    camposExtra.style.display = rol.value ? 'block' : 'none';
    [nombre, identidad, telefono, casa, bloque].forEach(input => input.parentElement.style.display = 'none');
    if (rol.value === 'guard' || rol.value === 'guard_admin') {
      [nombre, identidad, telefono].forEach(input => input.parentElement.style.display = 'block');
    } else if (rol.value === 'resident') {
      [nombre, identidad, telefono, casa, bloque].forEach(input => input.parentElement.style.display = 'block');
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.textContent = '';
    msg.style.color = 'red';

    if (!rol.value) return msg.textContent = 'Selecciona un rol.';
    if (!email.value || !validarEmail(email.value)) return msg.textContent = 'Correo inválido.';
    if (!pass.value || pass.value.length < 6) return msg.textContent = 'Contraseña mínima de 6 caracteres.';
    if (pass.value !== confirm.value) return msg.textContent = 'Las contraseñas no coinciden.';
    if ((rol.value === 'guard' || rol.value === 'guard_admin') && (!nombre.value || !identidad.value || !telefono.value)) return msg.textContent = 'Completa los campos requeridos.';
    if (rol.value === 'resident' && (!nombre.value || !identidad.value || !telefono.value || !casa.value || !bloque.value)) return msg.textContent = 'Completa todos los campos para residente.';

    msg.textContent = 'Creando usuario...';
    try {
      const { user } = await auth.createUserWithEmailAndPassword(email.value.trim(), pass.value);
      const data = {
        UID: user.uid,
        correo: email.value.trim(),
        rol: rol.value,
        nombre: nombre.value.trim(),
        identidad: identidad.value.trim(),
        telefono: telefono.value.trim(),
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (rol.value === 'resident') {
        data.casa = casa.value.trim();
        data.bloque = bloque.value.trim();
        data.estado_pago = 'Pendiente';
      }
      await db.collection('usuarios').doc(user.uid).set(data);
      msg.style.color = 'green';
      msg.textContent = 'Usuario creado con éxito.';
      form.reset();
      camposExtra.style.display = 'none';
      rol.value = '';
    } catch (error) {
      console.error(error);
      msg.textContent = error.code === 'auth/email-already-in-use' ? 'Correo ya registrado.' : 'Error: ' + error.message;
    }
  });
}
