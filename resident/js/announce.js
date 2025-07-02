// js/announce.js

// ─── 1) Inicializar Firebase (igual en todos tus scripts) ──────────────────
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

// ─── 2) Esperar a que cargue el DOM ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('announceForm');
  const qrSection = document.getElementById('qrResult');
  const qrCanvas  = document.getElementById('qrCanvas');
  const shareBtn  = document.getElementById('shareBtn');

  // 2.1) Verificar sesión
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = "../index.html";
    }
  });

  // ─── 3) Manejar envío del formulario ────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // 3.1) Leer valores
    const visitorName = document.getElementById('visitorNameInput').value.trim();
    const reference   = document.getElementById('referenceInput').value.trim();
    if (!visitorName) {
      alert("Por favor ingresa el nombre del visitante.");
      return;
    }

    try {
      const user    = auth.currentUser;
      const uDoc    = await db.collection('usuarios').doc(user.uid).get();
      const uData   = uDoc.data();

      // 3.2) Crear visita en Firestore
      const visitRef = await db.collection('visits').add({
        visitorName,
        reference: reference || '',
        residentName : uData.nombre,
        residentPhone: uData.telefono,
        house        : uData.casa,
        block        : uData.bloque,
        residentId   : user.uid,
        status       : 'pendiente',
        createdAt    : firebase.firestore.FieldValue.serverTimestamp()
      });

      // ─── 4) Generar y mostrar el QR ───────────────────────────────────────
      new QRious({
        element: qrCanvas,
        value  : visitRef.id,
        size   : 250
      });
      qrSection.style.display = 'block';

      // ─── 5) Configurar el botón de WhatsApp ──────────────────────────────
      // Necesitamos apuntar a: https://residencialprados.github.io/residencial-visitas-app/visitor.html?id=...
      const baseUrl = window.location.origin + '/residencial-visitas-app';
      const visitorLink = `${baseUrl}/visitor.html?id=${visitRef.id}`;
      const whatsappText =
        `Favor ingresar al siguiente enlace y mostrárselo al Personal de seguridad de Residencial Los Prados:\n\n${visitorLink}`;

      shareBtn.onclick = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
        window.open(url, '_blank');
      };

      // 3.3) Limpiar formulario
      form.reset();

    } catch (err) {
      console.error("Error al anunciar visita:", err);
      alert("Error al crear la visita. Revisa la consola para más detalles.");
    }
  });
});
