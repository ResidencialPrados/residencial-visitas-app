// js/main-resident.js

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

// ─── Cerrar sesión ────────────────────────────────────────────────────────────
document.getElementById('logoutBtn')
  .addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = '../index.html');
  });

// ─── Al cargar la página ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }

    // Verificar estado de pago
    const uid   = user.uid;
    const uDoc  = await db.collection('usuarios').doc(uid).get();
    const uData = uDoc.data();
    if (uData.estado_pago !== 'Pagado') {
      document.getElementById('pagoPendiente').textContent =
        "⚠️ Su pago está vencido. Contacte administración.";
    }

    // Configurar botón de anunciar visita
    document.getElementById('anunciarVisitaBtn')
      .addEventListener('click', async () => {
        // Pedir datos al residente
        const visitorName = prompt("Nombre completo del visitante:");
        if (!visitorName) return;
        const reference = prompt("Referencia u observación para el guardia:") || "";

        // Registrar en Firestore
        const visitRef = await db.collection('visits').add({
          visitorName,
          reference,
          residentName: uData.nombre,
          residentPhone: uData.telefono,
          house: uData.casa,
          block: uData.bloque,
          residentId: uid,
          status: 'pendiente',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Genera el QR en pantalla
        const qrCanvas = document.getElementById('qr');
        new QRious({
          element: qrCanvas,
          value: visitRef.id,
          size: 250
        });
        document.getElementById('qrContainer').style.display = 'block';

        // Prepara el enlace para WhatsApp
        const link = `${window.location.origin}/residencial-visitas-app/visitor.html?id=${visitRef.id}`;
        const whatsappText =
          `Favor ingresar al siguiente enlace y mostrárselo al Personal de seguridad de Residencial Los Prados:\n\n${link}`;

        document.getElementById('compartirBtn').onclick = () => {
          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
          window.open(whatsappUrl, '_blank');
        };
      });

    // Carga inicial de visitas
    cargarVisitas(uid);
  });
});

// ─── Cargar visitas de las últimas 24 h ────────────────────────────────────────
function cargarVisitas(uid) {
  const tbody  = document.getElementById('visitasBody');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('residentId', '==', uid)
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML =
          '<tr><td colspan="4" style="text-align:center;">Sin visitas registradas en las últimas 24 horas</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v     = doc.data();
          const fecha = v.createdAt?.toDate().toLocaleString() || '';
          const obs   = v.reference || '';
          const tr    = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName}</td>
            <td>${v.status}</td>
            <td>${fecha}</td>
            <td>${obs}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}
