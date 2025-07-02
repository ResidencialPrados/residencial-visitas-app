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

// 📌 Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// 📌 Escuchar autenticación y cargar datos
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    const uid = user.uid;
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const data = userDoc.data();

    if (!data || data.estado_pago !== 'Pagado') {
      document.getElementById('pagoPendiente').textContent = "⚠️ Su pago está vencido. Contacte administración.";
      document.getElementById('pagoPendiente').style.color = 'red';
      document.getElementById('pagoPendiente').style.fontWeight = 'bold';
    }

    cargarVisitas(uid);
  });
});

// 📌 Cargar visitas (últimas 24h)
function cargarVisitas(uid) {
  const tbody = document.getElementById('visitasBody');
  const ahora = new Date();
  const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('residentId', '==', uid)
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin visitas registradas en las últimas 24 horas</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName || 'Sin nombre'}</td>
            <td>${v.status || 'Sin estado'}</td>
            <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : 'Sin fecha'}</td>
            <td>${v.reference || ''}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}

// 📌 Anunciar visita y generar QR
document.getElementById('anunciarVisitaBtn').addEventListener('click', async () => {
  const visitorName = prompt("Nombre completo del visitante:");
  if (!visitorName) {
    alert("Debe ingresar un nombre para el visitante.");
    return;
  }
  const reference = prompt("Referencia u observación para el guardia:");

  try {
    const user = auth.currentUser;
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const residente = userDoc.data();

    if (!residente.nombre || !residente.telefono || !residente.casa || !residente.bloque) {
      alert("Complete sus datos de residente antes de anunciar visitas.");
      return;
    }

    const visitRef = await db.collection('visits').add({
      visitorName,
      reference: reference || '',
      residentName: residente.nombre,
      residentPhone: residente.telefono,
      house: residente.casa,
      block: residente.bloque,
      residentId: user.uid,
      status: 'pendiente',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Generar QR
    const qrText = `Visitante: ${visitorName}\nAnunciante: ${residente.nombre}\nTel: ${residente.telefono}\nCasa: ${residente.casa} Bloque: ${residente.bloque}\nID: ${visitRef.id}`;
    const qrCanvas = document.getElementById('qr');
    new QRious({
      element: qrCanvas,
      value: qrText,
      size: 250
    });

    document.getElementById('qrContainer').style.display = 'block';

    // Compartir QR por WhatsApp
    document.getElementById('compartirBtn').onclick = () => {
      const whatsappText = `Te comparto el QR de visita para mostrar en garita:\n\n${qrText}\n\nMuestra esta imagen al guardia al ingresar.`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, '_blank');
    };

  } catch (error) {
    console.error("Error al anunciar visita:", error);
    alert("Error al anunciar visita, inténtalo nuevamente.");
  }
});
