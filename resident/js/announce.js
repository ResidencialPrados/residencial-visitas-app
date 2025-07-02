// js/announce.js

// 1) Inicializar Firebase (idéntica a tus otros archivos)
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

// 2) Asegurar que el residente esté logueado
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  }
});

// 3) Manejar envío del formulario
document.getElementById('announceForm').addEventListener('submit', async e => {
  e.preventDefault();
  const visitorName = document.getElementById('visitorNameInput').value.trim();
  const reference   = document.getElementById('referenceInput').value.trim();
  const user        = auth.currentUser;

  // Obtener datos del residente
  const userDoc = await db.collection('usuarios').doc(user.uid).get();
  const r = userDoc.data();

  // 4) Crear la visita
  const visitRef = await db.collection('visits').add({
    visitorName,
    reference: reference || '',
    residentName: r.nombre,
    residentPhone: r.telefono,
    house: r.casa,
    block: r.bloque,
    residentId: user.uid,
    status: 'pendiente',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 5) Generar y mostrar el QR
  const qrCanvas = document.getElementById('qrCanvas');
  new QRious({
    element: qrCanvas,
    value: visitRef.id,
    size: 300
  });
  document.getElementById('qrResult').style.display = 'block';

  // 6) Configurar botón de WhatsApp
  document.getElementById('shareBtn').onclick = () => {
    const link = `${window.location.origin}/visitor.html?id=${visitRef.id}`;
    const text = encodeURIComponent(
      `Favor ingresar al siguiente enlace y mostrarlo al Personal de seguridad de Residencial Los Prados:\n\n${link}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
});
