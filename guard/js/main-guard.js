// js/main-guard.js

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

// ─── Verificar sesión y rol al cargar ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOMContentLoaded – inicializando listener de auth');
  auth.onAuthStateChanged(async user => {
    console.log('⚙️ onAuthStateChanged fired, user =', user);
    if (!user) {
      console.warn('🔒 No hay usuario autenticado → redirigiendo a login');
      window.location.href = "../index.html";
      return;
    }
    console.log(`🔑 Usuario autenticado: uid=${user.uid}, email=${user.email}`);
    let userDoc;
    try {
      userDoc = await db.collection('usuarios').doc(user.uid).get();
      console.log('✅ Documento de perfil obtenido, exists =', userDoc.exists);
    } catch (err) {
      console.error('❌ Error al obtener perfil de usuario:', err);
    }
    const data = userDoc?.data();
    console.log('   Datos de perfil:', data);

    if (!data || data.rol !== 'guard') {
      if (data?.rol === 'resident') {
        console.log('👤 Rol "resident" detectado → dash residente');
        window.location.href = "../resident/index.html";
      } else if (data?.rol === 'guard_admin') {
        console.log('👮‍♂️ Rol "guard_admin" detectado → dash admin');
        window.location.href = "../guard-admin/index.html";
      } else {
        console.warn('❓ Rol desconocido → redirigiendo a login');
        window.location.href = "../index.html";
      }
      return;
    }

    console.log('✅ Rol "guard" confirmado → iniciando dashboard guardia');
    iniciarDashboardGuardia();
  });
});

// ─── Inicialización del Dashboard ─────────────────────────────────────────────
function iniciarDashboardGuardia() {
  console.log('🚀 iniciarDashboardGuardia');
  document.getElementById('logoutBtn').addEventListener('click', () => {
    console.log('🔐 Cerrar sesión solicitado');
    auth.signOut().then(() => {
      console.log('🔑 Sesión cerrada, redirigiendo a login');
      window.location.href = "../index.html";
    });
  });

  // QR
  const btnQR = document.getElementById('activarQRBtn');
  const qrDiv = document.getElementById('qr-reader');
  let qrScanner = null;

  btnQR.addEventListener('click', () => {
    console.log('📷 Botón QR clickeado, estado scanner=', qrScanner);
    if (!qrScanner) {
      qrDiv.style.display = "block";
      qrScanner = new Html5Qrcode("qr-reader");
      qrScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async decodedText => {
          console.log('🔍 QR decodeado:', decodedText);
          await qrScanner.stop();
          qrDiv.innerHTML = "";
          qrDiv.style.display = "none";
          qrScanner = null;
          procesarVisita(decodedText.trim());
        },
        err => console.warn("QR Scan error:", err)
      ).catch(err => {
        console.error("❌ Error iniciando lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    } else {
      qrScanner.stop().then(() => {
        console.log('📷 Scanner detenido manualmente');
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
  console.log('📥 cargarVisitasPendientes');
  const tbody = document.getElementById('visitas-body');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      console.log('📊 Snapshot visitas:', snap.size, 'documentos');
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
          const v    = doc.data();
          const hora = v.createdAt?.toDate().toLocaleString() || '–';
          const tr   = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || '–'}</td>
            <td>${v.vehicle?.marca   || ''}</td>
            <td>${v.vehicle?.color   || ''}</td>
            <td>${v.vehicle?.placa   || ''}</td>
            <td>${v.house            || ''}</td>
            <td>${v.block            || ''}</td>
            <td>${v.residentPhone    || ''}</td>
            <td class="guard-cell">${v.guardName || ''}</td>
            <td>${hora}</td>
            <td>
              ${v.status === 'pendiente'
                ? `<button class="btn btn-primary" onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>`;
          tbody.appendChild(tr);

          if (!v.guardName && v.guardId) {
            db.collection('usuarios').doc(v.guardId).get().then(uSnap => {
              console.log('👮‍♂️ Fetch nombre guard por ID:', v.guardId, uSnap.exists);
              if (uSnap.exists) {
                tr.querySelector('.guard-cell').textContent = uSnap.data().nombre;
              }
            });
          }
        });
      }
    }, err => {
      console.error("❌ Error cargando visitas:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center; color:red;">
            Error al cargar visitas. Consulta la consola.
          </td>
        </tr>`;
    });
}

// ─── Procesar visita ──────────────────────────────────────────────────────────
async function procesarVisita(visitaId) {
  console.log('▶️ procesarVisita', visitaId);
  try {
    const ref  = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    console.log('   Visita snapshot:', snap.exists);
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Ya fue ingresada.");

    const marca = prompt("Marca (opcional):", "") || null;
    const color = prompt("Color (opcional):", "")  || null;
    const placa = prompt("Placa (opcional):", "")  || null;

    const uid       = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(uid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status:       'ingresado',
      checkInTime:  firebase.firestore.FieldValue.serverTimestamp(),
      guardId:      uid,
      guardName,
      vehicle:      { marca, color, placa }
    });

    console.log('✅ Visita marcada como ingresada');
    alert("Ingreso registrado.");
  } catch (e) {
    console.error("❌ Error procesando visita:", e);
    alert("Error al registrar visita.");
  }
}

// ─── Cargar pagos de residentes con filtro ────────────────────────────────────
function cargarPagosResidentes() {
  console.log('📥 cargarPagosResidentes');
  const tbody    = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snap => {
      console.log('📊 Snapshot residentes:', snap.size);
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener('input', e => render(cache, e.target.value));

  function render(list, filter) {
    const txt      = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre    || '').toLowerCase().includes(txt) ||
      (r.correo    || '').toLowerCase().includes(txt) ||
      String(r.casa)   .includes(txt) ||
      String(r.bloque) .includes(txt) ||
      (r.telefono  || '').includes(txt)
    );

    console.log('🔍 Filtrando residentes con "' + filter + '":', filtered.length);
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(r => {
      const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
      const tr     = document.createElement('tr');
      if (estado === 'Pendiente') tr.classList.add('pendiente');
      tr.innerHTML = `
        <td>${r.nombre}</td>
        <td>${r.correo}</td>
        <td>${r.telefono}</td>
        <td>${r.casa}</td>
        <td>${r.bloque}</td>
        <td>${estado}</td>`;
      tbody.appendChild(tr);
    });
  }
}
