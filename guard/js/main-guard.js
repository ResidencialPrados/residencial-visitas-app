// js/main-guard.js

// ─── Inicializar Firebase ─────────────────────────────────────────────────────
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
const db   = firebase.firestore();

// ─── Al cargar la página, verifica sesión ────────────────────────────────────
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

// ─── Configuración inicial del Dashboard Guardia ─────────────────────────────
function iniciarDashboardGuardia() {
  const btnActivarQR = document.getElementById('btn-activar-qr');
  const qrReaderDiv  = document.getElementById('qr-reader');
  let qrScanner      = null;

  btnActivarQR.addEventListener('click', () => {
    if (!qrScanner) {
      qrReaderDiv.style.display = "block";
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async decodedText => {
          await qrScanner.stop();
          qrReaderDiv.innerHTML = "";
          qrReaderDiv.style.display = "none";
          qrScanner = null;
          await procesarVisita(decodedText);
        },
        errorMessage => console.warn(`QR Scan error: ${errorMessage}`)
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
  cargarPagosResidentes();
}

// ─── Cargar visitas pendientes (últimas 24 h) ────────────────────────────────
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('status', '==', 'pendiente')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center; color:gray;">
          No hay visitas pendientes
        </td>`;
        tbody.appendChild(tr);
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const hora = v.createdAt?.toDate().toLocaleString() || 'Sin hora';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.residentName || 'Sin residente'}</td>
            <td>${hora}</td>
            <td>
              <button onclick="procesarVisita('${doc.id}')">Registrar Ingreso</button>
            </td>
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

// ─── Procesar visita escaneada o botón ────────────────────────────────────────
async function procesarVisita(visitaId) {
  try {
    const visitaRef  = db.collection('visits').doc(visitaId);
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

    // Aquí puedes reemplazar prompts por un modal si lo prefieres
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

// ─── Cargar y filtrar estado de pagos de residentes ──────────────────────────
function cargarPagosResidentes() {
  const tbody    = document.getElementById('pagos-body');
  const buscador = document.getElementById('buscarResidente');
  let cache      = [];

  // Obtener todos los residentes
  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snapshot => {
      cache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderPagos(cache, buscador.value);
    });

  // Filtrar al tipear
  buscador.addEventListener('input', e => {
    renderPagos(cache, e.target.value);
  });

  function renderPagos(listado, filtro) {
    const txt = filtro.trim().toLowerCase();
    tbody.innerHTML = '';

    const filtrados = listado.filter(r =>
      (r.nombre || '').toLowerCase().includes(txt) ||
      String(r.casa || '').toLowerCase().includes(txt) ||
      String(r.bloque || '').toLowerCase().includes(txt)
    );

    if (filtrados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">No hay residentes que coincidan</td>
        </tr>`;
      return;
    }

    filtrados.forEach(r => {
      const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.casa   || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${estado}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
