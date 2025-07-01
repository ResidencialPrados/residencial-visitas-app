// --- Inicializar Firebase ---
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

// Al cargar la página, verifica sesión
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      alert("Sesión no iniciada. Redirigiendo a login.");
      window.location.href = "/residencial-visitas-app/index.html";
    } else {
      iniciarDashboardGuardia();
    }
  });
});

function iniciarDashboardGuardia() {
  const btnActivarQR = document.getElementById('btn-activar-qr');
  const qrReaderDiv = document.getElementById('qr-reader');
  let qrScanner = null;

  btnActivarQR.addEventListener('click', () => {
    if (!qrScanner) {
      qrReaderDiv.style.display = "block";
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decodedText) => {
          await qrScanner.stop();
          qrReaderDiv.innerHTML = "";
          qrReaderDiv.style.display = "none";
          qrScanner = null;
          await procesarVisita(decodedText);
        },
        (errorMessage) => {
          console.warn(`QR Scan error: ${errorMessage}`);
        }
      ).catch(err => {
        console.error("Error al iniciar lector QR:", err);
        alert("Error al iniciar el lector QR: " + err.message);
      });
    } else {
      qrScanner.stop().then(() => {
        qrReaderDiv.innerHTML = "";
        qrReaderDiv.style.display = "none";
        qrScanner = null;
      });
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
      if (snapshot.empty) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center; color:gray;">No hay visitas pendientes</td>`;
        tbody.appendChild(tr);
      } else {
        snapshot.forEach(doc => {
          const visita = doc.data();
          const tr = document.createElement('tr');
          const hora = visita.scheduledTime && visita.scheduledTime.toDate
            ? visita.scheduledTime.toDate().toLocaleString()
            : 'Sin hora';
          tr.innerHTML = `
            <td>${visita.visitorName || 'Sin nombre'}</td>
            <td>${visita.residentName || 'Sin residente'}</td>
            <td>${hora}</td>
            <td><button onclick="procesarVisita('${doc.id}')">Registrar Ingreso</button></td>
          `;
          tbody.appendChild(tr);
        });
      }
    }, error => {
      console.error("Error de permisos o Firestore:", error);
      tbody.innerHTML = `<tr><td colspan="4" style="color:red; text-align:center;">
        Error al cargar visitas. Verifica permisos en Firestore.
      </td></tr>`;
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

    const marca = prompt("Marca del vehículo (opcional):", "");
    const color = prompt("Color del vehículo (opcional):", "");
    const placa = prompt("Placa del vehículo (opcional):", "");

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
    alert("Error al registrar la visita. Revisa la consola.");
  }
}
