// js/historial-guard-admin.js

// ─── Inicializar Firebase ────────────────────────────────────────
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

// ─── Botón regresar al Dashboard ─────────────────────────────────
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = "../guard-admin/index.html";
});

// ─── Verificar sesión y rol ─────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {
    const snap = await db.collection('usuarios').doc(user.uid).get();
    const data = snap.data();

    if (!data || data.rol !== 'guard_admin') {
      alert("No tienes permisos para ver este historial.");
      await auth.signOut();
      window.location.href = "../index.html";
      return;
    }

    console.log("✅ Usuario guard_admin confirmado, cargando historial completo.");
    cargarHistorial();

  } catch (error) {
    console.error("❌ Error verificando usuario:", error);
    await auth.signOut();
    window.location.href = "../index.html";
  }
});

// ─── Cargar historial completo sin límite de fecha ───────────────
function cargarHistorial() {
  const tbody    = document.getElementById('historialBody');
  const buscador = document.getElementById('buscarInput');

  db.collection('visits')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const visitas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      renderTabla(visitas, buscador.value);

      buscador.addEventListener('input', e => {
        renderTabla(visitas, e.target.value);
      });
    }, err => {
      console.error("❌ Error cargando historial:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center; color:red;">
            Error cargando historial. Revisa la consola.
          </td>
        </tr>`;
    });
}

// ─── Renderizar tabla filtrada ───────────────────────────────────
function renderTabla(visitas, filtro) {
  const tbody = document.getElementById('historialBody');
  tbody.innerHTML = '';

  const txt = filtro.trim().toLowerCase();

  const filtradas = visitas.filter(v => {
    const fechaStr = v.createdAt ? v.createdAt.toDate().toLocaleString() : '';
    return (
      (v.visitorName || '').toLowerCase().includes(txt) ||
      (v.residentName || '').toLowerCase().includes(txt) ||
      (v.residentId || '').toLowerCase().includes(txt) ||
      (v.house || '').toLowerCase().includes(txt) ||
      (v.block || '').toLowerCase().includes(txt) ||
      (v.residentPhone || '').toLowerCase().includes(txt) ||
      fechaStr.toLowerCase().includes(txt) ||
      (v.status || '').toLowerCase().includes(txt) ||
      (v.guardName || '').toLowerCase().includes(txt) ||
      (v.reference || '').toLowerCase().includes(txt)
    );
  });

  if (!filtradas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center;">
          No hay registros que coincidan con la búsqueda.
        </td>
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
      <td>${v.reference || '-'}</td>`;
    tbody.appendChild(tr);
  });
}
