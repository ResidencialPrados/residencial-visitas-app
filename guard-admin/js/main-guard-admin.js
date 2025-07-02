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

// Inicializar al cargar
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

// 📌 Manejo QR (versión actualizada para redirigir a process.html)
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
          // Detener scanner
          qrScanner.stop().then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = 'none';
            qrScanner = null;
            // Redirigir al guardia a process.html con el ID
            window.location.href = `${window.location.origin}/process.html?id=${visitId}`;
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
  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

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
              ${v.status === 'pendiente' ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>` : 'Ingresado'}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}

// 📌 Procesar visita (este método ya no se invoca vía QR, pero se mantiene para botón en tabla)
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

// 📌 Cargar residentes con buscador
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
      db.collection('usuarios').where('rol', '==', 'resident').get().then(snapshot => {
        const filtrados = snapshot.docs.filter(doc => {
          const d = doc.data();
          return (
            (d.nombre || '').toLowerCase().includes(texto) ||
            (d.correo || '').toLowerCase().includes(texto) ||
            (d.telefono || '').toLowerCase().includes(texto) ||
            (d.casa || '').toLowerCase().includes(texto) ||
            (d.bloque || '').toLowerCase().includes(texto)
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

// 📌 Manejar creación de usuarios con campos dinámicos
function manejarCreacionUsuarios() {
  const form = document.getElementById('crearUsuarioForm');
  const rolSelect = document.getElementById('rolUsuario');
  const msg = document.getElementById('crearUsuarioMsg');

  const nombreInput = document.getElementById('nuevoNombre');
  const telefonoInput = document.getElementById('nuevoTelefono');
  const identidadInput = document.getElementById('nuevoIdentidad');
  const casaInput = document.getElementById('nuevoCasa');
  const bloqueInput = document.getElementById('nuevoBloque');

  rolSelect.addEventListener('change', () => {
    const rol = rolSelect.value;
    // Reset visibilidad
    nombreInput.style.display = 'none';
    telefonoInput.style.display = 'none';
    identidadInput.style.display = 'none';
    casaInput.style.display = 'none';
    bloqueInput.style.display = 'none';

    if (rol === 'guard' || rol === 'guard_admin') {
      nombreInput.style.display = 'block';
      telefonoInput.style.display = 'block';
      identidadInput.style.display = 'block';
    } else if (rol === 'resident') {
      nombreInput.style.display = 'block';
      telefonoInput.style.display = 'block';
      casaInput.style.display = 'block';
      bloqueInput.style.display = 'block';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('nuevoEmail').value.trim();
    const password = document.getElementById('nuevoPassword').value.trim();
    const rol = rolSelect.value;
    const nombre = nombreInput.value.trim();
    const telefono = telefonoInput.value.trim();
    const identidad = identidadInput.value.trim();
    const casa = casaInput.value.trim();
    const bloque = bloqueInput.value.trim();

    msg.textContent = "Creando usuario...";

    // Validaciones según rol
    if (!rol) {
      msg.textContent = "Debe seleccionar un rol.";
      return;
    }
    if (!nombre || !telefono || (rol !== 'resident' && !identidad) || (rol === 'resident' && (!casa || !bloque))) {
      msg.textContent = "Complete todos los campos obligatorios según el rol.";
      return;
    }

    try {
      const userCred = await auth.createUserWithEmailAndPassword(email, password);
      const uid = userCred.user.uid;

      const data = {
        UID: uid,
        correo: email,
        rol: rol,
        nombre: nombre,
        telefono: telefono,
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (rol === 'resident') {
        data.casa = casa;
        data.bloque = bloque;
        data.estado_pago = 'Pendiente';
      } else {
        data.identidad = identidad;
      }

      await db.collection('usuarios').doc(uid).set(data);
      msg.textContent = "Usuario creado con éxito.";
      form.reset();
      rolSelect.value = '';
      nombreInput.style.display = 'none';
      telefonoInput.style.display = 'none';
      identidadInput.style.display = 'none';
      casaInput.style.display = 'none';
      bloqueInput.style.display = 'none';

    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        msg.textContent = "El correo ya está registrado.";
      } else {
        msg.textContent = "Error: " + error.message;
      }
    }
  });
}
