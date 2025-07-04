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

// Botón regresar al dashboard
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = "../guard-admin/index.html";
});

// Verificar sesión y rol
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  const snap = await db.collection('usuarios').doc(user.uid).get();
  const data = snap.data();
  if (!data || data.rol !== 'guard_admin') {
    alert("No tienes permisos para ver este historial.");
    window.location.href = "../index.html";
    return;
  }

  cargarHistorial();
});

// Cargar historial completo sin límite de fecha
function cargarHistorial() {
  const tbody = document.getElementById('historialBody');
  const buscador = document.getElementById('buscarInput');

  db.collection('visits')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      let visitas = [];
      snapshot.forEach(doc => {
        visitas.push({ id: doc.id, ...doc.data() });
      });
      renderTabla(visitas, buscador.value);
      buscador.addEventListener('input', e => renderTabla(visitas, e.target.value));
    });
}

function renderTabla(visitas, filtro) {
  const tbody = document.getElementById('historialBody');
  tbody.innerHTML = '';

  const txt = filtro.trim().toLowerCase();
  const filtradas = visitas.filter(v => {
    const fecha = v.createdAt ? v.createdAt.toDate().toLocaleString() : '';
    return (
      (v.visitorName || '').toLowerCase().includes(txt) ||
      (v.residentName || '').toLowerCase().includes(txt) ||
      (v.residentId || '').toLowerCase().includes(txt) ||
      String(v.house || '').toLowerCase().includes(txt) ||
      String(v.block || '').toLowerCase().includes(txt) ||
      (v.residentPhone || '').toLowerCase().includes(txt) ||
      fecha.includes(txt)
    );
  });

  if (!filtradas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;">No hay registros que coincidan con la búsqueda.</td>
      </tr>`;
    return;
  }

  filtradas.forEach(v => {
    const fecha = v.createdAt ? v.createdAt.toDate().toLocaleString() : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.visitorName || '-'}</td>
      <td>${v.residentName || '-'}</td>
      <td>${v.house || '-'}</td>
      <td>${v.block || '-'}</td>
      <td>${v.residentPhone || '-'}</td>
      <td>${fecha}</td>
      <td>${v.status || '-'}</td>
      <td>${v.guardName || '-'}</td>
      <td>${v.reference || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}
