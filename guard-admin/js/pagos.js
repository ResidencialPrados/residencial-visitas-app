// js/pagos.js

// — Inicializar Firebase —
firebase.initializeApp({
  apiKey:    "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:"residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId:     "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
const auth = firebase.auth();
const db   = firebase.firestore();

// — Botón Volver al Dashboard —
document.getElementById('backBtn').addEventListener('click', () => {
  window.location.href = 'index.html';
});

// — Verificar sesión —
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = 'index.html';
  } else {
    cargarPanelPagos();
  }
});

// — Cargar y renderizar tabla de pagos —
function cargarPanelPagos() {
  const tbody    = document.getElementById('residents-body');
  const buscador = document.getElementById('buscarResidente');
  let cache = [];

  const nombres = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  db.collection('usuarios')
    .where('rol', '==', 'resident')
    .onSnapshot(snapshot => {
      cache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderTabla(cache, buscador.value);
    });

  buscador.addEventListener('input', e => {
    renderTabla(cache, e.target.value);
  });

  function renderTabla(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      r.identidad?.toLowerCase().includes(txt) ||
      r.nombre?.toLowerCase().includes(txt) ||
      String(r.casa).includes(txt)
    );

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    const hoy   = new Date();
    const year  = hoy.getFullYear();
    const mAct  = hoy.getMonth(); // 0 = enero

    filtered.forEach(r => {
      const pagos = r.pagos || {}; // { "2025-01": Timestamp, ... }

      // Último pago
      const keys = Object.keys(pagos).sort();
      const ultimoPago = keys.length
        ? (() => {
            const [y, m] = keys.at(-1).split('-');
            return `${nombres[Number(m)-1]} ${y}`;
          })()
        : '—';

      // Meses pendientes
      const pendientes = [];
      for (let m = 0; m <= mAct; m++) {
        const key = `${year}-${String(m+1).padStart(2,'0')}`;
        if (!(key in pagos)) pendientes.push(nombres[m]);
      }
      const txtPend = pendientes.length ? pendientes.join(', ') : 'Al día';

      tbody.innerHTML += `
        <tr>
          <td>${r.identidad||''}</td>
          <td>${r.nombre||''}</td>
          <td>${ultimoPago}</td>
          <td>${txtPend}</td>
          <td>
            <button class="btn-aplicar" data-id="${r.id}"
              ${pendientes.length===0?'disabled':''}>
              Aplicar Pago
            </button>
          </td>
        </tr>`;
    });

    // Attach handlers
    document.querySelectorAll('.btn-aplicar').forEach(btn => {
      btn.onclick = () => openPagoModal(btn.dataset.id);
    });
  }
}

// — Modal de selección de meses y registro de pagos —
async function openPagoModal(userId) {
  const ref   = db.collection('usuarios').doc(userId);
  const snap  = await ref.get();
  if (!snap.exists) return alert('Residente no encontrado.');
  const datos = snap.data();
  const pagos = datos.pagos || {};

  const hoy   = new Date();
  const year  = hoy.getFullYear();
  const mAct  = hoy.getMonth();
  const nombres = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
  ];

  const disponibles = [];
  for (let m = 0; m <= mAct; m++) {
    const key = `${year}-${String(m+1).padStart(2,'0')}`;
    if (!(key in pagos)) disponibles.push({ key, label: nombres[m] });
  }
  if (!disponibles.length) {
    return alert('No hay meses pendientes.');
  }

  // Construir modal
  const overlay = document.createElement('div');
  overlay.id = 'mesesOverlay';
  overlay.innerHTML = `
    <div id="mesesModal">
      <h3>Meses pendientes</h3>
      <form id="mesesForm">
        ${disponibles.map(m => `
          <div>
            <label>
              <input type="checkbox" name="mes" value="${m.key}">
              ${m.label}
            </label>
          </div>
        `).join('')}
      </form>
      <div class="actions">
        <button id="cancelMeses" type="button">Cancelar</button>
        <button id="okMeses" type="button">Registrar Pago</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  document.getElementById('cancelMeses').onclick = () => overlay.remove();
  document.getElementById('okMeses').onclick = async () => {
    const sel = Array.from(document.getElementsByName('mes'))
                   .filter(i=>i.checked).map(i=>i.value);
    if (!sel.length) return alert('Selecciona al menos un mes.');

    const upd = {};
    sel.forEach(key => {
      if (!(key in pagos)) {
        upd[`pagos.${key}`] = firebase.firestore.FieldValue.serverTimestamp();
      }
    });

    if (!Object.keys(upd).length) {
      overlay.remove();
      return alert('Esos meses ya estaban pagados.');
    }

    try {
      await ref.update(upd);
      alert('¡Gracias! Su pago fortalece la seguridad.');
    } catch (e) {
      console.error(e);
      alert('Error al registrar pago.');
    }
    overlay.remove();
  };
}
