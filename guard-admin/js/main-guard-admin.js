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

// === Botones globales ===
document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut().then(() => location.href = '../index.html'));
document.getElementById('toggleHistorialBtn').addEventListener('click', () => location.href = 'historial.html');

// === Variables modal pago ===
const modalPago = document.getElementById('modalPago');
const modalPagoNombre = document.getElementById('modalPagoNombre');
const mesPagoSelect = document.getElementById('mesPago');
const anioPagoSelect = document.getElementById('anioPago');
const confirmarPagoBtn = document.getElementById('confirmarPagoBtn');
const cancelarPagoBtn = document.getElementById('cancelarPagoBtn');

let pagoResidenteId = null;
let ultimoMesPago = null;

// === Abrir modal de pago ===
function abrirModalPago(residente) {
  pagoResidenteId = residente.id;
  modalPagoNombre.textContent = `Residente: ${residente.nombre || 'Sin nombre'}`;

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  mesPagoSelect.innerHTML = '';
  meses.forEach((mes, i) => {
    const opt = document.createElement('option');
    opt.value = (i + 1).toString().padStart(2, '0');
    opt.textContent = mes;
    mesPagoSelect.appendChild(opt);
  });

  const anioActual = new Date().getFullYear();
  anioPagoSelect.innerHTML = '';
  for (let i = anioActual; i <= anioActual + 2; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    anioPagoSelect.appendChild(opt);
  }

  if (residente.mes_pago) {
    const [mes, anio] = residente.mes_pago.split("-");
    mesPagoSelect.value = mes;
    anioPagoSelect.value = anio;
    ultimoMesPago = residente.mes_pago;
  } else {
    mesPagoSelect.value = (new Date().getMonth() + 1).toString().padStart(2, '0');
    anioPagoSelect.value = anioActual;
    ultimoMesPago = null;
  }

  modalPago.classList.add('show');
}

// === Cerrar modal de pago ===
cancelarPagoBtn.addEventListener('click', () => {
  modalPago.classList.remove('show');
  pagoResidenteId = null;
  ultimoMesPago = null;
});

// === Confirmar y registrar pago ===
confirmarPagoBtn.addEventListener('click', async () => {
  if (!pagoResidenteId) return;
  const mes = mesPagoSelect.value.padStart(2, '0');
  const anio = anioPagoSelect.value;
  const fechaPago = `${mes}-${anio}`;

  if (fechaPago === ultimoMesPago) {
    alert("⚠️ Ya se ha registrado este mes previamente.");
    return;
  }

  try {
    await db.collection('usuarios').doc(pagoResidenteId).update({
      estado_pago: 'Pagado',
      fecha_pago: firebase.firestore.FieldValue.serverTimestamp(),
      mes_pago: fechaPago
    });
    alert(`✅ Pago registrado correctamente para ${fechaPago}.`);
    modalPago.classList.remove('show');
    pagoResidenteId = null;
    ultimoMesPago = null;
  } catch (e) {
    console.error(e);
    alert('❌ Error al registrar el pago.');
  }
});

// === Validar email ===
const validarEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// === Verificar sesión y rol ===
auth.onAuthStateChanged(async user => {
  if (!user) return location.href = '../index.html';
  const data = (await db.collection('usuarios').doc(user.uid).get()).data();
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
          <td>${v.status === 'pendiente' ? '<button class="btn btn-primary">Registrar</button>' : 'Ingresado'}</td>
        `;
        if (v.status === 'pendiente') {
          tr.querySelector('button').addEventListener('click', () => procesarVisita(doc.id));
        }
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
  const guardName = (await db.collection('usuarios').doc(guardUid).get()).data()?.nombre || 'Desconocido';

  await ref.update({
    status: 'ingresado',
    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
    guardId: guardUid,
    guardName,
    vehicle: { marca, color, placa }
  });
  alert('Ingreso registrado con éxito.');
}

// === Cargar residentes con orden y control de pagos ===
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let residentes = [];

  db.collection('usuarios').where('rol', '==', 'resident')
    .onSnapshot(snapshot => {
      residentes = snapshot.docs.map(doc => {
        const data = { id: doc.id, ...doc.data() };
        const hoy = new Date();
        if (data.mes_pago) {
          const [mes, anio] = data.mes_pago.split("-");
          const fechaPago = new Date(parseInt(anio), parseInt(mes) - 1);
          if (fechaPago < hoy) {
            db.collection('usuarios').doc(data.id).update({ estado_pago: 'Pendiente' });
            data.estado_pago = 'Pendiente';
          }
        } else {
          data.estado_pago = 'Pendiente';
        }
        return data;
      });
      render(residentes, buscador.value);
    });

  buscador.addEventListener('input', e => render(residentes, e.target.value));

  function render(lista, filtro) {
    const txt = filtro.trim().toLowerCase();
    const filtrados = lista.filter(r =>
      (r.nombre || '').toLowerCase().includes(txt) ||
      (r.correo || '').toLowerCase().includes(txt) ||
      (r.casa || '').includes(txt) ||
      (r.bloque || '').includes(txt) ||
      (r.telefono || '').includes(txt)
    );

    filtrados.sort((a, b) => (a.estado_pago === 'Pendiente' ? -1 : 1));

    tbody.innerHTML = filtrados.length ? '' : `<tr><td colspan="7" style="text-align:center;">No hay residentes que coincidan</td></tr>`;

    filtrados.forEach(r => {
      const estado = r.estado_pago === 'Pendiente' ? 'Pendiente' : `Pagado hasta: ${r.mes_pago || 'N/A'}`;
      const tr = document.createElement('tr');
      if (r.estado_pago === 'Pendiente') tr.style.color = 'red';

      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.correo || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${estado}</td>
        <td><button class="btn btn-primary">Registrar Pago</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => abrirModalPago(r));
      tbody.appendChild(tr);
    });
  }
}

// === Crear usuarios con pago inicial automático ===
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
    [nombre, identidad, telefono, casa, bloque].forEach(i => i.parentElement.style.display = 'none');
    if (rol.value === 'guard' || rol.value === 'guard_admin') [nombre, identidad, telefono].forEach(i => i.parentElement.style.display = 'block');
    if (rol.value === 'resident') [nombre, identidad, telefono, casa, bloque].forEach(i => i.parentElement.style.display = 'block');
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
      const now = new Date();
      const mesPago = (now.getMonth() + 1).toString().padStart(2, '0') + '-' + now.getFullYear();

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
        data.estado_pago = 'Pagado';
        data.mes_pago = mesPago;
        data.fecha_pago = firebase.firestore.FieldValue.serverTimestamp();
      }

      await db.collection('usuarios').doc(user.uid).set(data);
      msg.style.color = 'green';
      msg.textContent = '✅ Usuario creado y mes actual marcado como pagado.';
      form.reset();
      camposExtra.style.display = 'none';
      rol.value = '';
    } catch (e) {
      console.error(e);
      msg.textContent = e.code === 'auth/email-already-in-use' ? 'Correo ya registrado.' : 'Error: ' + e.message;
    }
  });
}
