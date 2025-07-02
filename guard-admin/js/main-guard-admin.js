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
const db = firebase.firestore();

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// Escuchar autenticación
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html";
    } else {
      inicializarDashboard(user);
    }
  });
});

function inicializarDashboard(user) {
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
        async (decodedText) => {
          qrScanner.stop();
          qrDiv.innerHTML = "";
          await procesarVisita(decodedText);
        },
        err => console.warn("QR Error:", err)
      );
    } else {
      qrScanner.stop();
      qrDiv.innerHTML = "";
      qrDiv.style.display = 'none';
      qrScanner = null;
    }
  });
}

// 📌 Cargar visitas (pendientes e ingresadas) de las últimas 24h
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - (24 * 60 * 60 * 1000));

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay visitas recientes</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.residentName || 'Sin residente'}</td>
            <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : 'Sin hora'}</td>
            <td>${v.status === 'pendiente' ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>` : 'Ingresado'}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}

// 📌 Procesar visita
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
      vehicle: {
        marca: marca || null,
        color: color || null,
        placa: placa || null
      }
    });
    alert("Ingreso registrado correctamente.");
  } catch (e) {
    console.error(e);
    alert("Error al procesar la visita.");
  }
}

// 📌 Cargar residentes
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');

  function renderizar(snapshot) {
    tbody.innerHTML = '';
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay residentes registrados</td></tr>';
    } else {
      snapshot.forEach(doc => {
        const r = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.nombre || ''}</td>
          <td>${r.correo || ''}</td>
          <td>${r.telefono || ''}</td>
          <td>${r.casa || ''}</td>
          <td>${r.bloque || ''}</td>
          <td>${r.estado_pago || 'Pendiente'}</td>
          <td><button onclick="registrarPago('${doc.id}')">Registrar Pago</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  let consulta = db.collection('usuarios').where('rol', '==', 'resident');
  consulta.onSnapshot(renderizar);

  buscador.addEventListener('input', () => {
    const texto = buscador.value.toLowerCase();
    if (!texto) {
      consulta.onSnapshot(renderizar);
    } else {
      db.collection('usuarios')
        .where('rol', '==', 'resident')
        .get()
        .then(snapshot => {
          const filtrados = snapshot.docs.filter(doc => {
            const data = doc.data();
            return (
              (data.nombre || '').toLowerCase().includes(texto) ||
              (data.correo || '').toLowerCase().includes(texto) ||
              (data.telefono || '').toLowerCase().includes(texto) ||
              (data.casa || '').toLowerCase().includes(texto) ||
              (data.bloque || '').toLowerCase().includes(texto)
            );
          });
          renderizar({ empty: filtrados.length === 0, forEach: cb => filtrados.forEach(cb) });
        });
    }
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
  }
}

// 📌 Crear usuarios con rol únicamente (simplificado)
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const msg = document.getElementById('crearUsuarioMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rol = document.getElementById('rolUsuario').value;
    msg.textContent = "Creando usuario...";

    try {
      const userCred = await auth.createUserWithEmailAndPassword(
        `usuario${Date.now()}@residencialqr.com`,
        Math.random().toString(36).slice(-8) + "Aa1"
      );
      const uid = userCred.user.uid;
      await db.collection('usuarios').doc(uid).set({
        UID: uid,
        correo: userCred.user.email,
        rol: rol,
        nombre: "",
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp(),
        estado_pago: "Pendiente"
      });
      msg.textContent = `Usuario creado: ${userCred.user.email}. Solicita al residente completar sus datos.`;
      form.reset();
    } catch (error) {
      console.error(error);
      msg.textContent = "Error: " + error.message;
    }
  });
}
