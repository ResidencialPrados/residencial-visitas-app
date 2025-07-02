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
const storage = firebase.storage();

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// Al cargar
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

// Mostrar visitas del residente
function cargarVisitas(uid) {
  const tbody = document.getElementById('visitasBody');
  db.collection('visits')
    .where('residentId', '==', uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin visitas registradas</td></tr>';
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

// Anunciar nueva visita
document.getElementById('anunciarVisitaBtn').addEventListener('click', async () => {
  const visitorName = prompt("Nombre completo del visitante:");
  if (!visitorName) return;
  const reference = prompt("Referencia u observación:");

  const user = auth.currentUser;
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  const residente = userDoc.data();

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

  // Generar QR localmente
  const qrText = `Visitante: ${visitorName}\nAnunciante: ${residente.nombre}\nTel: ${residente.telefono}\nCasa: ${residente.casa} Bloque: ${residente.bloque}\nID: ${visitRef.id}`;
  const qr = new QRious({
    value: qrText,
    size: 300
  });

  // Convertir QR a Blob
  const dataUrl = qr.toDataURL();
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Subir imagen a Firebase Storage
  const storageRef = storage.ref(`qr/${visitRef.id}.png`);
  await storageRef.put(blob);
  const url = await storageRef.getDownloadURL();

  // Mostrar QR en pantalla
  const qrContainer = document.getElementById('qrContainer');
  const qrCanvas = document.getElementById('qr');
  const qrImg = new Image();
  qrImg.src = url;
  qrImg.style.maxWidth = '300px';
  qrImg.style.display = 'block';
  qrContainer.innerHTML = `
    <h3>QR generado para el visitante:</h3>
  `;
  qrContainer.appendChild(qrImg);

  // Botón compartir
  const compartirBtn = document.createElement('button');
  compartirBtn.textContent = "Compartir por WhatsApp";
  compartirBtn.onclick = () => {
    const whatsappText = `Te comparto tu QR de visita para mostrar en garita:\n\n${qrText}\n\nAbre y muestra esta imagen en la garita:\n${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
    window.open(whatsappUrl, '_blank');
  };
  qrContainer.appendChild(compartirBtn);
  qrContainer.style.display = 'block';
});
