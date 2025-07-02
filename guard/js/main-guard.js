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

// ─── Cerrar sesión ─────────────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () =>
  auth.signOut().then(() => window.location.href = "../index.html")
);

// ─── Verificar sesión al cargar ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html";
    } else {
      iniciarDashboardGuardia();
    }
  });
});

// ─── Inicialización del Dashboard ──────────────────────────────────────────────
function iniciarDashboardGuardia() {
  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
}

// ─── Manejo de QR ──────────────────────────────────────────────────────────────
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
            // Redirige a process.html para el guardia
            window.location.href = `../process.html?id=${visitId}`;
          });
        },
        err => console.warn("QR Scan error:", err)
      ).catch(err => {
        console.error("No se pudo iniciar lector QR:", err);
        alert("Error al iniciar lector QR: " + err.message);
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

// ─── Cargar visitas pendientes (últimas 24h) ─────────────────────────────────
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('status', '==', 'pendiente')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      console.log("Visitas pendientes:", snapshot.docs.map(d=>d.data()));
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
          const v = doc.data();
          const hora = v.createdAt
            ? v.createdAt.toDate().toLocaleString()
            : '';
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
            <td>${hora}</td>
            <td>
              ${v.status === 'pendiente'
                ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>
          `;
          tbody.appendChild(tr);

          // Si no está guardName, lo buscamos por guardId
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
            Error al cargar visitas. Verifica la consola.
          </td>
        </tr>`;
    });
}

// ─── Procesar visita (botón) ───────────────────────────────────────────────────
async function procesarVisita(visitaId) {
  try {
    const ref  = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Esta visita ya fue ingresada.");

    // Pedir datos del vehículo
    const marca = prompt("Marca (opcional):","") || '';
    const color = prompt("Color (opcional):","") || '';
    const placa = prompt("Placa (opcional):","") || '';

    // Obtener nombre del guardia
    const guardUid  = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : '';

    // Actualizar
    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: guardUid,
      guardName,
      vehicle: { marca, color, placa }
    });

    alert("Ingreso registrado con éxito.");
  } catch (e) {
    console.error("Error procesando visita:", e);
    alert("Error al registrar visita. Revisa la consola.");
  }
}

// ─── Cargar y filtrar residentes ───────────────────────────────────────────────
function cargarResidentes() {
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
    const pendientes = [];
    const pagados = [];
    list.forEach(r => {
      if (!['nombre','correo','telefono','casa','bloque']
            .some(f => (r[f]||'').toLowerCase().includes(txt))) return;
      if (r.estado_pago === 'Pagado') pagados.push(r);
      else pendientes.push(r);
    });
    const all = pendientes.concat(pagados);
    tbody.innerHTML = '';
    if (all.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;">No hay residentes registrados</td>
        </tr>`;
      return;
    }
    all.forEach(r => {
      const tr = document.createElement('tr');
      if (r.estado_pago !== 'Pagado') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre || ''}</td>
        <td>${r.correo || ''}</td>
        <td>${r.telefono || ''}</td>
        <td>${r.casa || ''}</td>
        <td>${r.bloque || ''}</td>
        <td>${r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente'}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
