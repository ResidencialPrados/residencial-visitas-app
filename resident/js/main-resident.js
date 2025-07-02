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

document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    const uid = user.uid;
    const userDoc = await db.collection('usuarios').doc(uid).get();
    const data = userDoc.data();

    if (data.estado_pago !== 'Pagado') {
      document.getElementById('pagoPendiente').textContent = "⚠️ Su pago está vencido. Contacte administración.";
    }

    cargarVisitas(uid);
  });
});

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
            <td>${v.visitorName}</td>
            <td>${v.status}</td>
            <td>${v.createdAt?.toDate().toLocaleString() || ''}</td>
            <td>${v.reference || ''}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    });
}

document.getElementById('anunciarVisitaBtn').addEventListener('click', async () => {
  const visitorName = prompt("Nombre completo del visitante:");
  if (!visitorName) return;
  const reference = prompt("Referencia u observación para el guardia:");

  const user = auth.currentUser;
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  const residente = userDoc.data();

  if (!residente.nombre || !residente.telefono || !residente.casa || !residente.bloque) {
    alert("Complete sus datos de residente antes de anunciar visitas.");
    return;
  }

  // Creamos la visita y obtenemos su ID
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

  // Generamos el enlace para el visitante
  const visitLink = `${window.location.origin}/visitor.html?id=${visitRef.id}`;
  const whatsappText =
    `Favor ingresar al siguiente enlace y mostrarlo al Personal de seguridad de Residencial Los Prados:\n\n` +
    `${visitLink}`;

  // Abrimos WhatsApp con el mensaje
  window.open(
    `https://wa.me/?text=${encodeURIComponent(whatsappText)}`,
    '_blank'
  );
});
