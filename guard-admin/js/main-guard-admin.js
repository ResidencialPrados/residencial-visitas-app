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

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html";
    } else {
      cargarDashboardAdmin(user);
    }
  });
});

function cargarDashboardAdmin(user) {
  document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

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

  cargarVisitasPendientes();
  cargarResidentes();
  manejarCreacionUsuarios();
}

// Cargar visitas pendientes con el campo correcto
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  db.collection('visits')
    .where('status', '==', 'pendiente')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay visitas pendientes</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.residentName || 'Sin residente'}</td>
            <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : 'Sin hora'}</td>
            <td><button onclick="procesarVisita('${doc.id}')">Registrar</button></td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}

// Procesar visita
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
      vehicle: { marca: marca || null, color: color || null, placa: placa || null }
    });
    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error(e);
    alert("Error al procesar la visita.");
  }
}

// Cargar residentes
function cargarResidentes() {
  const tbody = document.getElementById('residents-body');
  db.collection('usuarios').where('rol', '==', 'resident').onSnapshot(snapshot => {
    tbody.innerHTML = '';
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay residentes registrados</td></tr>';
    } else {
      snapshot.forEach(doc => {
        const r = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.nombre || 'Sin nombre'}</td>
          <td>${r.correo || 'Sin correo'}</td>
          <td>${r.estado_pago || 'Pendiente'}</td>
          <td><button onclick="registrarPago('${doc.id}')">Registrar Pago</button></td>
        `;
        tbody.appendChild(tr);
      });
    }
  });
}

// Registrar pago
async function registrarPago(id) {
  if (confirm("¿Registrar pago de este residente?")) {
    await db.collection('usuarios').doc(id).update({
      estado_pago: 'Pagado',
      fecha_pago: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Pago registrado.");
  }
}

// Crear usuarios
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const msg = document.getElementById('crearUsuarioMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('nuevoEmail').value.trim();
    const password = document.getElementById('nuevoPassword').value.trim();
    const rol = document.getElementById('rolUsuario').value;

    msg.textContent = "Creando usuario...";

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCred.user.uid;
      await db.collection('usuarios').doc(uid).set({
        UID: uid,
        correo: email,
        rol: rol,
        nombre: "",
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      msg.textContent = "Usuario creado con éxito.";
      form.reset();
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        msg.textContent = "El correo ya está registrado. Si desea asignar rol, hable con soporte.";
      } else {
        msg.textContent = "Error al crear usuario: " + error.message;
      }
    }
  });
}
