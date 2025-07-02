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
        (decodedText) => {
          const visitId = decodedText.trim();
          qrScanner.stop().then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = 'none';
            qrScanner = null;
            window.location.href = `../process.html?id=${visitId}`;
          });
        },
        (err) => console.warn("QR Error:", err)
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay visitas en las últimas 24 horas</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.residentName || 'Sin residente'}</td>
            <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : 'Sin hora'}</td>
            <td>
              ${v.status === 'pendiente'
                ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>
          `;
          tbody.appendChild(tr);
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

    const marca = prompt("Marca del vehículo:");
    const color = prompt("Color del vehículo:");
    const placa = prompt("Placa del vehículo:");

    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: auth.currentUser.uid,
      vehicle: { marca: marca || '', color: color || '', placa: placa || '' }
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
    const snapshot = await db.collection('usuarios')
      .where('rol','==','resident')
      .get();

    const pendientes = [];
    const pagados     = [];
    snapshot.docs.forEach(doc => {
      const r = doc.data();
      const text = filterText.toLowerCase();
      const hayMatch = ['nombre','correo','telefono','casa','bloque']
        .some(f => (r[f]||'').toLowerCase().includes(text));
      if (!hayMatch) return;

      if (r.estado_pago === 'Pagado') pagados.push({ id: doc.id, ...r });
      else pendientes.push({ id: doc.id, ...r });
    });

    tbody.innerHTML = '';
    const todos = pendientes.concat(pagados);
    if (todos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay residentes registrados</td></tr>';
      return;
    }

    todos.forEach(r => {
      const tr = document.createElement('tr');
      if (r.estado_pago !== 'Pagado') tr.classList.add('pendiente');
      const statusLabel = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.correo || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${statusLabel}</td>
        <td><button onclick="registrarPago('${r.id}')">Registrar Pago</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Primera carga sin filtro
  fetchAndRender();

  // Re-render al buscar
  buscador.addEventListener('input', e => {
    fetchAndRender(e.target.value);
  });
}

// 📌 Registrar pago
async function registrarPago(id) {
  if (confirm("¿Registrar pago de este residente?")) {
    await db.collection('usuarios').doc(id).update({
      estado_pago: 'Pagado',
      fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Pago registrado con éxito.");
    // refrescar la tabla
    cargarResidentes();
  }
}

// 📌 Otros métodos (creación de usuarios, etc.) se mantienen igual
