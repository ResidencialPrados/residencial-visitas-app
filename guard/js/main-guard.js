// ─── Inicializar Firebase ─────────────────────────────────────────────────────
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

// ─── Verificar sesión al cargar ────────────────────────────────────────────────
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

// ─── Inicialización del Dashboard ──────────────────────────────────────────────
function iniciarDashboardGuardia() {
  // Cerrar sesión
  document.getElementById('logoutBtn').addEventListener('click', () =>
    auth.signOut().then(() => window.location.href = "/residencial-visitas-app/index.html")
  );

  // QR
  const btnQR = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let qrScanner = null;
  btnQR.addEventListener('click', () => {
    if (!qrScanner) {
      qrDiv.style.display = "block";
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async decodedText => {
          await qrScanner.stop();
          qrDiv.innerHTML = "";
          qrDiv.style.display = "none";
          qrScanner = null;
          await procesarVisita(decodedText.trim());
        },
        err => console.warn("QR Scan error:", err)
      ).catch(err => {
        console.error("No se pudo iniciar lector QR:", err);
        alert("Error al iniciar lector QR: " + err.message);
      });
    } else {
      qrScanner.stop().then(() => {
        qrDiv.innerHTML = "";
        qrDiv.style.display = "none";
        qrScanner = null;
      });
    }
  });

  cargarVisitasPendientes();
  cargarPagosResidentes();
}

// ─── Cargar visitas pendientes (últimas 24 h) ─────────────────────────────────
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('status', '==', 'pendiente')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; color:gray;">
              No hay visitas pendientes
            </td>
          </tr>`;
      } else {
        snapshot.forEach(doc => {
          const v    = doc.data();
          const hora = v.createdAt?.toDate().toLocaleString() || 'Sin hora';
          const tr   = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName  || ''}</td>
            <td>${v.vehicle?.marca || ''}</td>
            <td>${v.vehicle?.color || ''}</td>
            <td>${v.vehicle?.placa || ''}</td>
            <td>${v.house        || ''}</td>
            <td>${v.block        || ''}</td>
            <td>${v.residentPhone|| ''}</td>
            <td class="guard-cell">${v.guardName || ''}</td>
            <td>${hora}</td>
            <td>
              <button onclick="procesarVisita('${doc.id}')">Registrar</button>
            </td>
          `;
          tbody.appendChild(tr);

          // Si hace falta nombre del guardia, lo traemos por guardId
          if (!v.guardName && v.guardId) {
            db.collection('usuarios').doc(v.guardId).get()
              .then(uSnap => {
                if (uSnap.exists) {
                  tr.querySelector('.guard-cell').textContent = uSnap.data().nombre;
                }
              });
          }
        });
      }
    }, err => {
      console.error("Error cargando visitas:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; color:red;">
            Error al cargar visitas. Mira la consola.
          </td>
        </tr>`;
    });
}

// ─── Procesar una visita (botón o QR) ─────────────────────────────────────────
async function procesarVisita(visitaId) {
  try {
    const ref  = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Esta visita ya fue ingresada.");

    // Datos del vehículo
    const marca = prompt("Marca (opcional):","") || null;
    const color = prompt("Color (opcional):","") || null;
    const placa = prompt("Placa (opcional):","") || null;

    // Nombre del guardia
    const guardUid  = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    // Actualizar
    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: guardUid,
      guardName,
      vehicle: { marca, color, placa }
    });

    alert("Ingreso registrado correctamente.");
  } catch (e) {
    console.error("Error procesando visita:", e);
    alert("Error al registrar visita. Mira la consola.");
  }
}

// ─── Cargar y filtrar estado de pagos de residentes ──────────────────────────
function cargarPagosResidentes() {
  const tbody    = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache      = [];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      cache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filt = list.filter(r =>
      (r.nombre||'').toLowerCase().includes(txt) ||
      (r.correo||'').toLowerCase().includes(txt) ||
      String(r.casa||'').includes(txt) ||
      String(r.bloque||'').includes(txt) ||
      (r.telefono||'').toLowerCase().includes(txt)
    );
    if (!filt.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;">No hay residentes que coincidan</td>
        </tr>`;
      return;
    }
    tbody.innerHTML = '';
    filt.forEach(r => {
      const est = r.estado_pago==='Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (est==='Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre}</td>
        <td>${r.correo}</td>
        <td>${r.telefono}</td>
        <td>${r.casa}</td>
        <td>${r.bloque}</td>
        <td>${est}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
