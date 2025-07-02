// js/visitor.js

// 1) Inicializar Firebase con tu configuración exacta
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});

const db = firebase.firestore();

// 2) Referencias a elementos del DOM
const welcomeEl = document.getElementById('welcome');
const qrSection = document.getElementById('qr-section');
const qrCanvas  = document.getElementById('qr');

// 3) Leer parámetro ?id= de la URL
const params  = new URLSearchParams(window.location.search);
const visitId = params.get('id');

if (!visitId) {
  welcomeEl.textContent = "Error: falta el identificador de la visita.";
  throw new Error("visitor.js: parámetro id no proporcionado");
}

// 4) Consultar Firestore para obtener datos de la visita
db.collection('visits').doc(visitId).get()
  .then(doc => {
    if (!doc.exists) {
      welcomeEl.textContent = "Visita no encontrada.";
      return;
    }
    const data = doc.data();
    // 5) Mostrar nombre del visitante
    welcomeEl.textContent = `Bienvenido, ${data.visitorName || 'Invitado'}`;

    // 6) Generar el QR con el ID de la visita
    new QRious({
      element: qrCanvas,
      value: visitId,
      size: 300
    });

    // 7) Mostrar la sección del QR
    qrSection.style.display = 'block';
  })
  .catch(err => {
    console.error("Error cargando visita:", err);
    welcomeEl.textContent = "Error cargando la visita.";
  });
