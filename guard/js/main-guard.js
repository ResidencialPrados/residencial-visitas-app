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
      window.location.href = "../index.html";
    } else {
      iniciarDashboardGuardia();
    }
  });
});

// ─── Inicialización del Dashboard ──────────────────────────────────────────────
function iniciarDashboardGuardia() {
  document.getElementById('logoutBtn').addEventListener('click', () =>
    auth.signOut().then(() => window.location.href = "../index.html")
  );

  manejarQR();
  cargarVisitasPendientes();
  cargarResidentes();
}

// ─── Manejo QR ────────────────────────────────────────────────────────────────
function manejarQR() {
  const btn = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let scanner = null;

  btn.addEventListener('click', () => {
    if (!scanner) {
      qrDiv.style.display = 'block';
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async decoded => {
          await scanner.stop();
          qrDiv.innerHTML = "";
          qrDiv.style.display = 'none';
          scanner = null;
          procesarVisita(decoded.trim());
        },
        err => console.warn("QR Scan error:", err)
      ).catch(e => {
        console.error("Error al iniciar lector QR:", e);
        alert("No se pudo iniciar el lector QR: " + e.message);
      });
    } else {
      scanner.stop().then(() => {
        qrDiv.innerHTML = "";
        qrDiv.style.display = 'none';
        scanner = null;
      });
    }
  });
}

// ─── Cargar visitas pendientes (últimas 24h) ─────────────────────────────────
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24*60*60*1000);

  db.collection('visits')
    .where('status', '==', 'pendiente')
    .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt','asc')
    .onSnapshot(snap => {
      tbody.innerHTML = '';
      if (snap.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; color:gray;">
              No hay visitas pendientes
            </td>
          </tr>`;
      } else {
        snap.forEach(doc => {
          const v = doc.data();
          const hora = v.createdAt?.toDate().toLocaleString() || 'Sin hora';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || '—'}</td>
            <td>${v.vehicle?.marca || ''}</td>
            <td>${v.vehicle?.color || ''}</td>
            <td>${v.vehicle?.placa || ''}</td>
            <td>${v.house || ''}</td>
            <td>${v.block || ''}</td>
            <td>${v.residentPhone || ''}</td>
            <td class="guard-cell">${v.guardName || ''}</td>
            <td>${hora}</td>
            <td>
              <button onclick="procesarVisita('${doc.id}')">
                Registrar Ingreso
              </button>
            </td>
          `;
          tbody.appendChild(tr);

          // Si falta guardName lo cargamos por su UID
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
    }, e => {
      console.error("Error cargando visitas:", e);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; color:red;">
            Error al cargar visitas. Mira la consola.
          </td>
        </tr>`;
    });
}

// ─── Procesar visita escaneada o botón ────────────────────────────────────────
async function procesarVisita(visitaId) {
  try {
    const ref = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Esta visita ya fue ingresada.");

    const marca = prompt("Marca (opcional):","") || null;
    const color = prompt("Color (opcional):","") || null;
    const placa = prompt("Placa (opcional):","") || null;

    const guardUid  = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(guardUid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

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
    alert("Error al registrar visita. Revisa la consola.");
  }
}

// ─── Cargar y filtrar pagos de residentes (solo lectura) ─────────────────────
function cargarResidentes() {
  const tbody    = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache      = [];

  db.collection('usuarios')
    .where('rol','==','resident')
    .onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre||'').toLowerCase().includes(txt) ||
      String(r.casa||'').includes(txt) ||
      String(r.bloque||'').includes(txt)
    );
    if (!filtered.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">No hay residentes que coincidan</td>
        </tr>`;
      return;
    }
    tbody.innerHTML = '';
    filtered.forEach(r => {
      const estado = r.estado_pago==='Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (estado==='Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre}</td>
        <td>${r.casa}</td>
        <td>${r.bloque}</td>
        <td>${estado}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
