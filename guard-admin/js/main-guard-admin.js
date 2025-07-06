// js/main-guard-admin.js

// — Inicializar Firebase —
firebase.initializeApp({
  apiKey:    "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:"residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket:"residencial-qr.appspot.com",
  messagingSenderId:"21258599408",
  appId:     "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
const auth = firebase.auth();
const db   = firebase.firestore();

// — Cerrar sesión —
document.getElementById('logoutBtn')?.addEventListener('click', () =>
  auth.signOut().then(() => window.location.href = '../index.html')
);

// — Verificar sesión y rol antes de cargar dashboard —
auth.onAuthStateChanged(async user => {
  if (!user) {
    console.warn("🔒 No hay usuario autenticado → redirigiendo a login");
    window.location.href = '../index.html';
    return;
  }

  try {
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.rol !== 'guard_admin') {
      console.warn(`⚠️ Acceso denegado, rol inválido (${userData?.rol}) → cerrando sesión`);
      await auth.signOut();
      window.location.href = '../index.html';
      return;
    }

    console.log("✅ Usuario guard_admin confirmado, cargando dashboard");
    inicializarDashboard();

  } catch (error) {
    console.error("❌ Error verificando rol del usuario:", error);
    await auth.signOut();
    window.location.href = '../index.html';
  }
});

// — Inicializar Dashboard —
function inicializarDashboard() {
  if (document.getElementById('activarQRBtn')) manejarQR();
  if (document.getElementById('visitas-body')) cargarVisitasPendientes();
  if (document.getElementById('crearUsuarioForm')) manejarCreacionUsuarios();
  if (document.getElementById('residents-body')) cargarResidentes();
  document.getElementById('pagosBtn')?.addEventListener('click', () => {
    window.location.href = 'pagos.html';
  });
}

// — Validar formato de email —
function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// — QR Scanner (sin duplicar instancias) —
function manejarQR() {
  const btn   = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let scanner = null;

  btn.onclick = () => {
    if (scanner) {
      scanner.stop().then(() => scanner.clear()).then(() => {
        qrDiv.innerHTML = '';
        qrDiv.style.display = 'none';
        scanner = null;
      });
    } else {
      qrDiv.innerHTML = '';
      qrDiv.style.display = 'block';
      scanner = new Html5Qrcode('qr-reader');
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        decoded => {
          scanner.stop().then(() => scanner.clear()).then(() => {
            qrDiv.innerHTML = '';
            qrDiv.style.display = 'none';
            scanner = null;
            window.location.href = `../process.html?id=${decoded.trim()}`;
          });
        },
        err => console.warn('QR Error:', err)
      ).catch(err => {
        console.error('Error al iniciar QR:', err);
        alert('No se pudo activar el lector QR: ' + err.message);
      });
    }
  };
}

// — Cargar visitas —
function cargarVisitasPendientes() {
  const tbody  = document.getElementById('visitas-body');
  const cutoff = new Date(Date.now() - 24*60*60*1000);

  db.collection('visits')
    .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(cutoff))
    .orderBy('createdAt','desc')
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
        const v    = doc.data();
        const tr   = document.createElement('tr');
        const hora = v.createdAt?.toDate().toLocaleString() || '';
        tr.innerHTML = `
          <td>${v.visitorName || 'Sin nombre'}</td>
          <td>${v.vehicle?.marca   || ''}</td>
          <td>${v.vehicle?.color   || ''}</td>
          <td>${v.vehicle?.placa   || ''}</td>
          <td>${v.house            || ''}</td>
          <td>${v.block            || ''}</td>
          <td>${v.residentPhone    || ''}</td>
          <td class="guard-cell">Cargando…</td>
          <td>${hora}</td>
          <td>${
            v.status === 'pendiente'
              ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
              : 'Ingresado'
          }</td>`;
        tbody.appendChild(tr);

        if (v.guardId) {
          db.collection('usuarios').doc(v.guardId).get()
            .then(s => {
              tr.querySelector('.guard-cell').textContent = s.exists ? s.data().nombre : 'Desconocido';
            })
            .catch(() => {
              tr.querySelector('.guard-cell').textContent = 'Desconocido';
            });
        }
      });
    });
}

// — Procesar Visita —
async function procesarVisita(id) {
  try {
    const ref       = db.collection('visits').doc(id);
    const snap      = await ref.get();
    if (!snap.exists || snap.data().status === 'ingresado') {
      return alert('Visita no encontrada o ya ingresada.');
    }
    const marca     = prompt('Marca del vehículo:') || '';
    const color     = prompt('Color del vehículo:') || '';
    const placa     = prompt('Placa del vehículo:') || '';
    const guardUid  = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status:       'ingresado',
      checkInTime:  firebase.firestore.FieldValue.serverTimestamp(),
      guardId:      guardUid,
      guardName,
      vehicle:      { marca, color, placa }
    });
    alert('Ingreso registrado con éxito.');
  } catch (e) {
    console.error(e);
    alert('Error al procesar la visita.');
  }
}

// — Cargar residentes filtrados —
function cargarResidentes() {
  const tbody    = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      cache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      r.nombre?.toLowerCase().includes(txt) ||
      r.correo?.toLowerCase().includes(txt) ||
      String(r.casa).includes(txt) ||
      String(r.bloque).includes(txt) ||
      r.telefono?.includes(txt)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }
    tbody.innerHTML = '';

    const hoy      = new Date();
    const year     = hoy.getFullYear();
    const monthIdx = hoy.getMonth();

    filtered.forEach(r => {
      const pagos       = r.pagos || {};
      const claveActual = `${year}-${String(monthIdx+1).padStart(2,'0')}`;
      let pagoText;

      if (!(claveActual in pagos)) {
        pagoText = 'Pendiente';
      } else {
        const keys    = Object.keys(pagos).sort();
        const lastKey = keys.at(-1);
        const [y, m]  = lastKey.split('-');
        pagoText      = `${nombres[Number(m)-1]} ${y}`;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.nombre   || ''}</td>
        <td>${r.correo   || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa     || ''}</td>
        <td>${r.bloque   || ''}</td>
        <td>${pagoText}</td>`;
      tbody.appendChild(tr);
    });
  }
}

// — Crear usuarios dinámico —
function manejarCreacionUsuarios() {
  const form        = document.getElementById('crearUsuarioForm');
  const rolSelect   = document.getElementById('rolUsuario');
  const camposExtra = document.getElementById('camposExtra');
  const msg         = document.getElementById('crearUsuarioMsg');
  const campoCasa   = document.getElementById('campoCasa');
  const campoBloque = document.getElementById('campoBloque');
  if (!form || !rolSelect || !camposExtra || !msg) return;

  const emailInput   = document.getElementById('nuevoEmail');
  const passInput    = document.getElementById('nuevoPassword');
  const confirmInput = document.getElementById('nuevoConfirmPassword');
  const nombreInput  = document.getElementById('nuevoNombre');
  const idInput      = document.getElementById('nuevoIdentidad');
  const telInput     = document.getElementById('nuevoTelefono');
  const casaInput    = document.getElementById('nuevoCasa');
  const bloqueInput  = document.getElementById('nuevoBloque');

  camposExtra.style.display = 'none';
  campoCasa.style.display   = 'none';
  campoBloque.style.display = 'none';
  msg.textContent           = '';

  rolSelect.addEventListener('change', () => {
    camposExtra.style.display = rolSelect.value ? 'block' : 'none';
    if (rolSelect.value === 'resident') {
      campoCasa.style.display   = 'block';
      campoBloque.style.display = 'block';
    } else {
      campoCasa.style.display   = 'none';
      campoBloque.style.display = 'none';
    }
    msg.textContent = '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.style.color = 'red';
    msg.textContent = '';

    const rol       = rolSelect.value;
    const email     = emailInput.value.trim();
    const pass      = passInput.value;
    const pass2     = confirmInput.value;
    const nombre    = nombreInput.value.trim();
    const identidad = idInput.value.trim();
    const telefono  = telInput.value.trim();
    const casa      = casaInput.value.trim();
    const bloque    = bloqueInput.value.trim();

    if (!rol) {
      msg.textContent = 'Selecciona un rol.'; return;
    }
    if (!validarEmail(email)) {
      msg.textContent = 'Ingresa un correo válido.'; return;
    }
    if (pass.length < 6) {
      msg.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return;
    }
    if (pass !== pass2) {
      msg.textContent = 'Las contraseñas no coinciden.'; return;
    }
    if ((rol === 'guard' || rol === 'guard_admin') &&
        (!nombre || !identidad || !telefono)) {
      msg.textContent = 'Completa nombre, identidad y teléfono.'; return;
    }
    if (rol === 'resident' &&
        (!nombre || !identidad || !telefono || !casa || !bloque)) {
      msg.textContent = 'Completa todos los campos para residentes.'; return;
    }

    msg.textContent = 'Creando usuario…';
    try {
      const currentUser = auth.currentUser;
      const currentEmail = currentUser.email;

      const { user } = await auth.createUserWithEmailAndPassword(email, pass);
      const data = {
        UID:            user.uid,
        correo:         email,
        rol,
        nombre,
        identidad,
        telefono,
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (rol === 'resident') {
        Object.assign(data, { casa, bloque, estado_pago: 'Pendiente' });
      }
      await db.collection('usuarios').doc(user.uid).set(data);

      // Restaurar sesión del admin después de crear usuario
      await auth.signInWithEmailAndPassword(currentEmail, passInput.value);

      msg.style.color = 'green';
      msg.textContent = 'Usuario creado con éxito.';
      form.reset();
      camposExtra.style.display = 'none';
      campoCasa.style.display   = 'none';
      campoBloque.style.display = 'none';
    } catch (error) {
      console.error(error);
      msg.textContent = error.code === 'auth/email-already-in-use'
        ? 'El correo ya está registrado.'
        : 'Error: ' + error.message;
    }
  });
}
