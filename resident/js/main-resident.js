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
const qrCanvas = document.getElementById('qrCanvas');
const qr = new QRious({
  element: qrCanvas,
  size: 250,
  value: ''
});

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    const uid = user.uid;

    // Cargar datos del residente
    const doc = await db.collection('usuarios').doc(uid).get();
    if (!doc.exists) {
      document.getElementById('residenteInfo').textContent = "Datos no encontrados. Contacte a administración.";
      return;
    }

    const data = doc.data();
    document.getElementById('residenteInfo').textContent =
      `Nombre: ${data.nombre || 'N/A'}, Tel: ${data.phone || 'N/A'}, Bloque: ${data.block || 'N/A'}, Casa: ${data.house || 'N/A'}`;

    document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

    cargarVisitas(uid, data);

    manejarFormularioVisitas(uid, data);
  });
});

function manejarFormularioVisitas(uid, residenteData) {
  const form = document.getElementById('visitForm');
  const msg = document.getElementById('visitMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const visitorName = document.getElementById('visitorName').value.trim();
    const visitTime = document.getElementById('visitTime').value;

    if (!visitorName || !visitTime) {
      msg.textContent = "Todos los campos son obligatorios.";
      return;
    }

    const textoQR = `${residenteData.nombre || 'Residente'} anuncia a ${visitorName}, Casa ${residenteData.house || 'N/A'} Bloque ${residenteData.block || 'N/A'}, Tel ${residenteData.phone || 'N/A'}`;

    qr.value = textoQR;

    try {
      await db.collection('visits').add({
        visitorName,
        residentName: residenteData.nombre || 'Residente',
        residentId: uid,
        scheduledTime: firebase.firestore.Timestamp.fromDate(new Date(visitTime)),
        status: 'pendiente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      msg.textContent = "Visita anunciada con éxito.";
      form.reset();
    } catch (error) {
      console.error(error);
      msg.textContent = "Error al registrar la visita: " + error.message;
    }
  });
}

function cargarVisitas(uid, residenteData) {
  const tbody = document.getElementById('visitasList');

  db.collection('visits')
    .where('residentId', '==', uid)
    .orderBy('scheduledTime', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No hay visitas registradas</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.scheduledTime ? v.scheduledTime.toDate().toLocaleString() : 'Sin hora'}</td>
            <td>${v.status || 'Sin estado'}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}
