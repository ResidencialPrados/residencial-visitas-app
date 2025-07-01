// Inicializar Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35",
  measurementId: "G-TFYENFPEKX"
});

const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
  // Verificar sesión del guardia
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html"; // Redirigir a login si no está logueado
    } else {
      iniciarDashboardGuardia();
    }
  });
});

function iniciarDashboardGuardia() {
  const btnActivarQR = document.getElementById('btn-activar-qr');
  const qrReaderDiv = document.getElementById('qr-reader');
  let qrScanner;

  btnActivarQR.addEventListener('click', () => {
    if (!qrScanner) {
      qrReaderDiv.style.display = "block";
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          qrScanner.stop();
          qrReaderDiv.innerHTML = ""; // Limpiar lector
          await procesarVisita(decodedText);
        },
        (errorMessage) => {
          console.warn(`QR Scan error: ${errorMessage}`);
        }
      ).catch(err => {
        console.error("Error al iniciar lector QR:", err);
      });
    } else {
      qrScanner.stop();
      qrReaderDiv.innerHTML = "";
      qrScanner = null;
      qrReaderDiv.style.display = "none";
    }
  });

  cargarVisitasPendientes();
}

function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  db.collection('visits')
    .where('status', '==', 'pendiente')
    .orderBy('scheduledTime', 'asc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      snapshot.forEach(doc => {
        const visita = doc.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${visita.visitorName || 'Sin nombre'}</td>
          <td>${visita.residentName || 'Sin residente'}</td>
          <td>${visita.scheduledTime ? visita.scheduledTime.toDate().toLocaleString() : 'Sin hora'}</td>
          <td><button onclick="procesarVisita('${doc.id}')">Registrar Ingreso</button></td>
        `;
        tbody.appendChild(tr);
      });
    });
}

async function procesarVisita(visitaId) {
  try {
    const visitaRef = db.collection('visits').doc(visitaId);
    const visitaSnap = await visitaRef.get();

    if (!visitaSnap.exists) {
      alert("Visita no encontrada.");
      return;
    }

    const visita = visitaSnap.data();

    if (visita.status === 'ingresado') {
      alert("Esta visita ya fue ingresada previamente.");
      return;
    }

    const marca = prompt("Ingrese la marca del vehículo (opcional):", "");
    const color = prompt("Ingrese el color del vehículo (opcional):", "");
    const placa = prompt("Ingrese la placa del vehículo (opcional):", "");

    await visitaRef.update({
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

  } catch (error) {
    console.error("Error al procesar la visita:", error);
    alert("Ocurrió un error al registrar la visita.");
  }
}
