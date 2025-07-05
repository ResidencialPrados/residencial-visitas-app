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

// ─── Verificar sesión y depurar perfil ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOMContentLoaded – arrancando auth listener');
  auth.onAuthStateChanged(user => {
    console.log('🛠️ DEBUG – onAuthStateChanged → user =', user);
    if (!user) {
      console.warn('🔒 DEBUG – user es null, no hay sesión (no redirigimos en debug)');
      return;
    }
    // Hay user, ahora leemos su perfil en Firestore
    db.collection('usuarios').doc(user.uid).get()
      .then(doc => {
        console.log('🛠️ DEBUG – perfil Firestore:', doc.data());
        // En esta fase NO redirigimos por rol: arrancamos siempre
        console.log('✅ DEBUG – arrancamos dashboard SIN comprobar rol');
        iniciarDashboardGuardia();
      })
      .catch(err => {
        console.error('❌ DEBUG – error leyendo perfil Firestore:', err);
      });
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

  // QR Scanner
  const btnQR   = document.getElementById('activarQRBtn');
  const qrDiv   = document.getElementById('qr-reader');
  let scanner   = null;

  btnQR.addEventListener('click', () => {
    console.log('📷 Botón QR clickeado, estado scanner =', scanner);
    if (!scanner) {
      qrDiv.style.display = "block";
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decoded => {
          console.log('🔍 QR decodeado:', decoded);
          scanner.stop().then(() => scanner.clear()).then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = "none";
            scanner = null;
            procesarVisita(decoded.trim());
          });
        },
        err => console.warn("❌ QR Scan error:", err)
      ).catch(err => {
        console.error("❌ Error iniciando lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    } else {
      scanner.stop().then(() => {
        console.log('📷 Scanner detenido manualmente');
        qrDiv.innerHTML = "";
        qrDiv.style.display = "none";
        scanner = null;
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
      console.log('📊 Snapshot visitas:', snap.size);
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
                ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
                : 'Ingresado'}
            </td>`;
          tbody.appendChild(tr);
          if (!v.guardName && v.guardId) {
            db.collection('usuarios').doc(v.guardId).get().then(uSnap => {
              console.log('👮‍♂️ Nombre guard fetch:', v.guardId, uSnap.exists);
              if (uSnap.exists) {
                tr.querySelector('.guard-cell').textContent = uSnap.data().nombre;
              }
            });
          }
        });
      }
    }, err => {
      console.error("❌ Error cargando visitas:", err);
    });
}

// ─── Procesar visita ──────────────────────────────────────────────────────────
async function procesarVisita(visitaId) {
  console.log('▶️ procesarVisita', visitaId);
  try {
    const ref  = db.collection('visits').doc(visitaId);
    const snap = await ref.get();
    console.log('   Visita existe =', snap.exists);
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === 'ingresado') return alert("Ya fue ingresada.");

    const marca = prompt("Marca (opcional):") || null;
    const color = prompt("Color (opcional):") || null;
    const placa = prompt("Placa (opcional):") || null;

    const uid       = auth.currentUser.uid;
    const guardSnap = await db.collection('usuarios').doc(uid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : 'Desconocido';

    await ref.update({
      status:      'ingresado',
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId:     uid,
      guardName,
      vehicle:     { marca, color, placa }
    });
    console.log('✅ Visita registrada');
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
    console.log('🔍 Filtrando residentes con "'+filter+'":', filtered.length);
    tbody.innerHTML = filtered.length
      ? filtered.map(r => {
          const estado = r.estado_pago === 'Pagado' ? 'Pagado' : 'Pendiente';
          return `
            <tr ${estado==='Pendiente'? 'class="pendiente"' : ''}>
              <td>${r.nombre}</td>
              <td>${r.correo}</td>
              <td>${r.telefono}</td>
              <td>${r.casa}</td>
              <td>${r.bloque}</td>
              <td>${estado}</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
  }
}
