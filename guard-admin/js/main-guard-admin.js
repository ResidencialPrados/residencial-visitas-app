// guard-admin/js/main-guard-admin.js

// Inicializar Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});

const auth = firebase.auth();
const db   = firebase.firestore();

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () =>
  auth.signOut().then(() => window.location.href = '../index.html')
);

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html";
    } else {
      inicializarDashboard();
    }
  });
});

function inicializarDashboard() {
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// 📌 Manejo QR
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
          const visitId = decodedText.trim();
          qrScanner.stop().then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = 'none';
            qrScanner = null;
            window.location.href = `../process.html?id=${visitId}`;
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

// 📌 Cargar visitas últimas 24h
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML =
          '<tr><td colspan="10" style="text-align:center;">No hay visitas en las últimas 24 horas</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
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
            <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : ''}</td>
            <td>
              ${v.status === 'pendiente'
                ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>
          `;
          tbody.appendChild(tr);

          // Si no tenemos guardName, obtenemos el nombre del guardia por su UID
          if (!v.guardName && v.guardId) {
            db.collection('usuarios').doc(v.guardId).get().then(userSnap => {
              if (userSnap.exists) {
                tr.querySelector('.guard-cell').textContent = userSnap.data().nombre;
              }
            });
          }
        });
      }
    });
}

// 📌 Procesar visita (botón en tabla)
async function procesarVisita(visitaId) {
  try {
    const ref = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) {
      alert("Visita no encontrada.");
      return;
    }
    const visita = snap.data();
    if (visita.status === 'ingresado') {
      alert("Esta visita ya fue ingresada.");
      return;
    }

    // Pedir datos
    const marca = prompt("Marca del vehículo:");
    const color = prompt("Color del vehículo:");
    const placa = prompt("Placa del vehículo:");

    // Obtener datos del guardia actual
    const guardUid = auth.currentUser.uid;
    const guardDoc = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardDoc.exists ? guardDoc.data().nombre : 'Desconocido';

    // Actualizar visita con guardId y guardName
    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: guardUid,
      guardName: guardName,
      vehicle: {
        marca: marca || '',
        color: color || '',
        placa: placa || ''
      }
    });

    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error(e);
    alert("Error al procesar la visita.");
  }
}

// 📌 Cargar residentes con orden y marcado de NO PAGO
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');

  async function fetchAndRender(filterText = "") {
    const snapshot = await db
      .collection('usuarios')
      .where('rol', '==', 'resident')
      .get();

    const pendientes = [];
    const pagados = [];
    snapshot.docs.forEach(doc => {
      const r = doc.data();
      const text = filterText.toLowerCase();
      const match = ['nombre','correo','telefono','casa','bloque']
        .some(f => (r[f]||'').toLowerCase().includes(text));
      if (!match) return;

      if (r.estado_pago==='Pagado') pagados.push({ id: doc.id, ...r });
      else pendientes.push({ id: doc.id, ...r });
    });

    tbody.innerHTML = '';
    const todos = pendientes.concat(pagados);
    if (todos.length===0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;">No hay residentes registrados</td></tr>';
      return;
    }

    todos.forEach(r => {
      const tr = document.createElement('tr');
      if (r.estado_pago!=='Pagado') tr.classList.add('pendiente');
      const label = r.estado_pago==='Pagado'?'Pagado':'Pendiente';
      tr.innerHTML = `
        <td>${r.nombre||''}</td>
        <td>${r.correo||''}</td>
        <td>${r.telefono||''}</td>
        <td>${r.casa||''}</td>
        <td>${r.bloque||''}</td>
        <td>${label}</td>
        <td><button onclick="registrarPago('${r.id}')">Registrar Pago</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  fetchAndRender();
  buscador.addEventListener('input', e => fetchAndRender(e.target.value));
}

// 📌 Registrar pago
async function registrarPago(id) {
  if (confirm("¿Registrar pago de este residente?")) {
    await db
      .collection('usuarios')
      .doc(id)
      .update({
        estado_pago: 'Pagado',
        fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
      });
    alert("Pago registrado con éxito.");
    cargarResidentes();
  }
}

// 📌 Manejar creación de usuarios con campos dinámicos
function manejarCreacionUsuarios() {
  const form        = document.getElementById('crearUsuarioForm');
  const rolSelect   = document.getElementById('rolUsuario');
  const camposExtra = document.getElementById('camposExtra');
  const msg         = document.getElementById('crearUsuarioMsg');

  const emailInput     = document.getElementById('nuevoEmail');
  const passInput      = document.getElementById('nuevoPassword');
  const labelNombre    = document.getElementById('labelNombre');
  const labelIdentidad = document.getElementById('labelIdentidad');
  const labelCasa      = document.getElementById('labelCasa');
  const labelBloque    = document.getElementById('labelBloque');
  const labelTelefono  = document.getElementById('labelTelefono');

  form.reset();
  camposExtra.style.display = 'none';

  rolSelect.addEventListener('change', () => {
    camposExtra.style.display = rolSelect.value ? 'block' : 'none';
    msg.textContent = '';

    [labelNombre,labelIdentidad,labelCasa,labelBloque,labelTelefono]
      .forEach(el=>el.style.display='none');

    if (rolSelect.value==='guard'||rolSelect.value==='guard_admin') {
      labelNombre.style.display   = 'block';
      labelTelefono.style.display = 'block';
      labelIdentidad.style.display= 'block';
    } else if (rolSelect.value==='resident') {
      labelNombre.style.display   = 'block';
      labelTelefono.style.display = 'block';
      labelCasa.style.display     = 'block';
      labelBloque.style.display   = 'block';
    }
  });

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    msg.textContent='Creando usuario...';

    const rol       = rolSelect.value;
    const email     = emailInput.value.trim();
    const password  = passInput.value.trim();
    const nombre    = document.getElementById('nuevoNombre').value.trim();
    const telefono  = document.getElementById('nuevoTelefono').value.trim();
    const identidad = document.getElementById('nuevoIdentidad').value.trim();
    const casa      = document.getElementById('nuevoCasa').value.trim();
    const bloque    = document.getElementById('nuevoBloque').value.trim();

    if(!rol||!email||!password){
      msg.textContent='Seleccione rol, email y contraseña.';
      return;
    }
    if((rol==='guard'||rol==='guard_admin')&&(!nombre||!telefono||!identidad)){
      msg.textContent='Complete nombre, teléfono e identidad.';
      return;
    }
    if(rol==='resident'&&(!nombre||!telefono||!casa||!bloque)){
      msg.textContent='Complete nombre, teléfono, casa y bloque.';
      return;
    }

    try {
      const { user } = await auth.createUserWithEmailAndPassword(email,password);
      const data = {
        UID:user.uid,
        correo:email,
        rol,
        nombre,
        telefono,
        fecha_creacion:firebase.firestore.FieldValue.serverTimestamp()
      };
      if(rol==='resident'){
        data.casa=casa;
        data.bloque=bloque;
        data.estado_pago='Pendiente';
      } else {
        data.identidad=identidad;
      }
      await db.collection('usuarios').doc(user.uid).set(data);
      msg.textContent='Usuario creado con éxito.';
      form.reset();
      camposExtra.style.display='none';
      rolSelect.value='';
    } catch(error){
      console.error(error);
      msg.textContent = error.code==='auth/email-already-in-use'
        ?'El correo ya está registrado.'
        :'Error: '+error.message;
    }
  });
}
