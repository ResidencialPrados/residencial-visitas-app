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
const db = firebase.firestore();

// ─── Verificar sesión y rol al cargar ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    const uid = user.uid;
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const data = userDoc.data();

    if (!data || data.rol !== 'guard') {
      if (data?.rol === 'resident') {
        window.location.href = "../resident/index.html";
      } else if (data?.rol === 'guard_admin') {
        window.location.href = "../guard-admin/index.html";
      } else {
        window.location.href = "../index.html";
      }
      return;
    }

    iniciarDashboardGuardia();
  });
});

// ─── Inicialización del Dashboard ─────────────────────────────────────────────
function iniciarDashboardGuardia() {
  document.getElementById('logoutBtn').addEventListener('click', () =>
    auth.signOut().then(() => window.location.href = "../index.html")
  );

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
          procesarVisita(decodedText.trim());
        },
        err => console.warn("QR Scan error:", err)
      ).catch(err => {
        console.error("Error iniciando lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
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

// ─── Cargar visitas de las últimas 24 horas ──────────────────────────────────
function cargarVisitasPendientes() {
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      tbody.innerHTML = '';
      if (snap.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; color:gray;">
              No hay visitas en las últimas 24 horas
            </td>
          </tr>`;
      } else {
        snap.forEach(doc => {
          const v = doc.data();
          const hora = v.createdAt?.toDate().toLocaleString() || '–';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || '–'}</td>
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
                ? `<button class="btn btn-primary" onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>
          `;
          tbody.appendChild(tr);

          if (!v.guardName && v.guardId) {
            db.collection('usuarios').doc(v.guardId).get().then(uSnap => {
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

// ─── Procesar visita ──────────────────────────────────────────────────────────
async function procesarVisita(visitaId) {
  try {
    const ref = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Ya fue ingresada.");

    const marca = prompt("Marca (opcional):", "") || null;
    const color = prompt("Color (opcional):", "") || null;
    const placa = prompt("Placa (opcional):", "") || null;

    const uid = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(uid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status: 'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId: uid,
      guardName,
      vehicle: { marca, color, placa }
    });

    alert("Ingreso registrado.");
  } catch (e) {
    console.error("Error procesando visita:", e);
    alert("Error al registrar visita.");
  }
}

// ─── Cargar pagos de residentes con filtro ────────────────────────────────────
function cargarPagosResidentes() {
  const tbody = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre || '').toLowerCase().includes(txt) ||
      (r.correo || '').toLowerCase().includes(txt) ||
      String(r.casa || '').includes(txt) ||
      String(r.bloque || '').includes(txt) ||
      (r.telefono || '').includes(txt)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(r => {
      const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre}</td>
        <td>${r.correo}</td>
        <td>${r.telefono}</td>
        <td>${r.casa}</td>
        <td>${r.bloque}</td>
        <td>${estado}</td>
      `;
      tbody.appendChild(tr);
    });
  }
}
