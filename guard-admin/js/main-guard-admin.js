// js/main-guard-admin.js

// — Inicializar Firebase —
console.log('[Debug] Iniciando Firebase…');
firebase.initializeApp({
  apiKey:    "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:"residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId:     "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
console.log('[Debug] Firebase iniciado');

// — Referencias —
const auth = firebase.auth();
const db   = firebase.firestore();

// — Cerrar sesión —
document.getElementById('logoutBtn').addEventListener('click', () => {
  console.log('[Debug] click en logoutBtn');
  auth.signOut()
    .then(() => {
      console.log('[Debug] signOut OK, redirigiendo a index.html');
      window.location.href = '../index.html';
    })
    .catch(err => {
      console.error('[Debug] Error en signOut:', err);
      alert('Error al cerrar sesión: ' + err.message);
    });
});

// — Verificar sesión y cargar dashboard —
auth.onAuthStateChanged(user => {
  console.log('[Debug] onAuthStateChanged, user =', user);
  if (!user) {
    console.warn('[Debug] No hay usuario, redirigiendo a index.html');
    window.location.href = "../index.html";
  } else {
    console.log('[Debug] Usuario logueado, uid =', user.uid);
    inicializarDashboard();
  }
});

function inicializarDashboard() {
  console.log('[Debug] inicializarDashboard()');
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// — Función auxiliar: valida formato de email —
function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const ok = re.test(email);
  console.log('[Debug] validarEmail(', email, ') =', ok);
  return ok;
}

// — QR Scanner —
function manejarQR() {
  console.log('[Debug] activar lector QR');
  const btnQR = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let qrScanner = null;

  btnQR.addEventListener('click', () => {
    console.log('[Debug] click en activarQRBtn, qrScanner =', qrScanner);
    if (!qrScanner) {
      qrDiv.style.display = 'block';
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decodedText => {
          console.log('[Debug] QR decodificado:', decodedText);
          qrScanner.stop().then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = 'none';
            qrScanner = null;
            window.location.href = `../process.html?id=${decodedText.trim()}`;
          });
        },
        err => console.warn('[Debug] QR Error:', err)
      ).catch(err => {
        console.error('[Debug] Error al iniciar lector QR:', err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    } else {
      console.log('[Debug] Deteniendo lector QR');
      qrScanner.stop().then(() => {
        qrDiv.innerHTML = "";
        qrDiv.style.display = 'none';
        qrScanner = null;
      });
    }
  });
}

// — Cargar últimas 24h de visitas —
function cargarVisitasPendientes() {
  console.log('[Debug] cargarVisitasPendientes()');
  const tbody   = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      console.log('[Debug] snapshot visitas:', snapshot.size);
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:gray;">
          No hay visitas en las últimas 24 horas
        </td></tr>`;
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
          <td>${v.status === 'pendiente'
            ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
            : 'Ingresado'}</td>`;
        tbody.appendChild(tr);

        if (!v.guardName && v.guardId) {
          db.collection('usuarios').doc(v.guardId).get().then(snap => {
            console.log('[Debug] fetch guardName para visita:', doc.id, snap.exists);
            if (snap.exists) {
              tr.querySelector('.guard-cell').textContent = snap.data().nombre;
            }
          });
        }
      });
    }, err => {
      console.error('[Debug] Error snapshot visitas:', err);
    });
}

// — Procesar visita —
async function procesarVisita(visitaId) {
  console.log('[Debug] procesarVisita:', visitaId);
  try {
    const ref = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    console.log('[Debug] visita snap.exists=', snap.exists, 'data=', snap.data());
    if (!snap.exists || snap.data().status === 'ingresado') {
      return alert("Visita no encontrada o ya ingresada.");
    }

    const marca = prompt("Marca del vehículo:") || '';
    const color = prompt("Color del vehículo:") || '';
    const placa = prompt("Placa del vehículo:") || '';
    console.log('[Debug] Datos vehículo:', { marca, color, placa });

    const guardUid  = auth.currentUser.uid;
    console.log('[Debug] procesarVisita guardUid=', guardUid);
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status:      'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId:     guardUid,
      guardName,
      vehicle:     { marca, color, placa }
    });
    console.log('[Debug] Visita actualizada con éxito');
    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error('[Debug] Error en procesarVisita:', e);
    alert("Error al procesar la visita.");
  }
}

// — Cargar y filtrar residentes —
function cargarResidentes() {
  console.log('[Debug] cargarResidentes()');
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      console.log('[Debug] snapshot residentes:', snap.size);
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render(cache, buscador.value);
    }, err => {
      console.error('[Debug] Error snapshot residentes:', err);
    });

  buscador.addEventListener('input', e => {
    console.log('[Debug] buscarResidente input:', e.target.value);
    render(cache, e.target.value);
  });

  function render(list, filter) {
    console.log('[Debug] render residentes, filter=', filter);
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre   || '').toLowerCase().includes(txt) ||
      (r.correo   || '').toLowerCase().includes(txt) ||
      String(r.casa   || '').includes(txt) ||
      String(r.bloque || '').includes(txt) ||
      (r.telefono || '').includes(txt)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay residentes que coincidan</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(r => {
      const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr     = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre||''}</td>
        <td>${r.correo||''}</td>
        <td>${r.telefono||''}</td>
        <td>${r.casa||''}</td>
        <td>${r.bloque||''}</td>
        <td>${estado}</td>
        <td><button onclick="registrarPago('${r.id}')">Registrar Pago</button></td>`;
      tbody.appendChild(tr);
    });
  }
}

// — Registrar pago —
async function registrarPago(id) {
  console.log('[Debug] registrarPago:', id);
  if (!confirm("¿Registrar pago de este residente?")) return;
  try {
    await db.collection('usuarios').doc(id).update({
      estado_pago: 'Pagado',
      fecha_pago:  firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log('[Debug] Pago registrado con éxito para:', id);
    alert("Pago registrado con éxito.");
  } catch (e) {
    console.error('[Debug] Error registrarPago:', e);
    alert("Error al registrar el pago.");
  }
}

// — Crear Usuarios con campos dinámicos y logs —
function manejarCreacionUsuarios() {
  console.log('[Debug] manejarCreacionUsuarios()');
  const form        = document.getElementById('crearUsuarioForm');
  const rolSelect   = document.getElementById('rolUsuario');
  const camposExtra = document.getElementById('camposExtra');
  const msg         = document.getElementById('crearUsuarioMsg');

  const emailInput   = document.getElementById('nuevoEmail');
  const passInput    = document.getElementById('nuevoPassword');
  const confirmInput = document.getElementById('nuevoConfirmPassword');
  const nombreInput  = document.getElementById('nuevoNombre');
  const idInput      = document.getElementById('nuevoIdentidad');
  const telInput     = document.getElementById('nuevoTelefono');
  const casaInput    = document.getElementById('nuevoCasa');
  const bloqueInput  = document.getElementById('nuevoBloque');

  // estado inicial
  form.reset();
  camposExtra.style.display = 'none';
  msg.textContent = '';
  msg.style.color = 'red';

  rolSelect.addEventListener('change', () => {
    console.log('[Debug] rolUsuario cambió a:', rolSelect.value);
    camposExtra.style.display = rolSelect.value ? 'block' : 'none';
    msg.textContent = '';

    // ocultar todos
    [ nombreInput, idInput, telInput, casaInput, bloqueInput ]
      .forEach(i => i.parentElement.style.display = 'none');

    if (rolSelect.value === 'guard' || rolSelect.value === 'guard_admin') {
      console.log('[Debug] Mostrar campos para guardia');
      nombreInput.parentElement.style.display = 'block';
      idInput.parentElement.style.display     = 'block';
      telInput.parentElement.style.display    = 'block';
    } else if (rolSelect.value === 'resident') {
      console.log('[Debug] Mostrar campos para residente');
      nombreInput.parentElement.style.display = 'block';
      idInput.parentElement.style.display     = 'block';
      telInput.parentElement.style.display    = 'block';
      casaInput.parentElement.style.display   = 'block';
      bloqueInput.parentElement.style.display = 'block';
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    console.log('[Debug] submit crearUsuarioForm');
    msg.style.color = 'red';
    msg.textContent = '';

    const values = {
      rol:       rolSelect.value,
      email:     emailInput.value.trim(),
      password:  passInput.value,
      password2: confirmInput.value,
      nombre:    nombreInput.value.trim(),
      identidad: idInput.value.trim(),
      telefono:  telInput.value.trim(),
      casa:      casaInput.value.trim(),
      bloque:    bloqueInput.value.trim()
    };
    console.log('[Debug] Valores form:', values);

    // Validaciones…
    if (!values.rol) {
      msg.textContent = 'Selecciona un rol.'; return;
    }
    if (!values.email || !validarEmail(values.email)) {
      msg.textContent = 'Ingresa un correo válido.'; return;
    }
    if (!values.password || values.password.length < 6) {
      msg.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return;
    }
    if (values.password !== values.password2) {
      msg.textContent = 'Las contraseñas no coinciden.'; return;
    }
    if ((values.rol === 'guard' || values.rol === 'guard_admin')
        && (!values.nombre || !values.identidad || !values.telefono)) {
      msg.textContent = 'Completa nombre, identidad y teléfono.'; return;
    }
    if (values.rol === 'resident'
        && (!values.nombre || !values.identidad || !values.telefono
            || !values.casa || !values.bloque)) {
      msg.textContent = 'Completa todos los campos para residentes.'; return;
    }

    console.log('[Debug] Todos los datos válidos, creando usuario en Firebase Auth…');
    msg.textContent = 'Creando usuario…';
    try {
      const { user } = await auth.createUserWithEmailAndPassword(
        values.email,
        values.password
      );
      console.log('[Debug] Firebase Auth creado user.uid=', user.uid);

      const data = {
        UID:            user.uid,
        correo:         values.email,
        rol:            values.rol,
        nombre:         values.nombre,
        identidad:      values.identidad,
        telefono:       values.telefono,
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (values.rol === 'resident') {
        data.casa        = values.casa;
        data.bloque      = values.bloque;
        data.estado_pago = 'Pendiente';
      }

      console.log('[Debug] Guardando documento usuario en Firestore:', data);
      await db.collection('usuarios').doc(user.uid).set(data);

      console.log('[Debug] Usuario Firestore creado con éxito');
      msg.style.color = 'green';
      msg.textContent = 'Usuario creado con éxito.';
      form.reset();
      rolSelect.value = '';
      camposExtra.style.display = 'none';
    } catch (error) {
      console.error('[Debug] Error al crear usuario:', error);
      if (error.code === 'auth/email-already-in-use') {
        msg.textContent = 'El correo ya está registrado.';
      } else {
        msg.textContent = 'Error: ' + error.message;
      }
    }
  });
}
