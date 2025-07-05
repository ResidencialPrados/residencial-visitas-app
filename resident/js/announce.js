// js/announce.js

// ─── 1) Inicializar Firebase ─────────────────────────────
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

// ─── 2) Al cargar el DOM ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const form      = document.getElementById('announceForm');
  const qrSection = document.getElementById('qrResult');
  const qrCanvas  = document.getElementById('qrCanvas');
  const shareBtn  = document.getElementById('shareBtn');

  // Verificar sesión y rol
  auth.onAuthStateChanged(async user => {
    if (!user) {
      console.warn("🔒 No hay usuario autenticado → redirigiendo a login");
      window.location.href = "../index.html";
      return;
    }
    try {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      const userData = userDoc.data();

      console.log("✅ Usuario autenticado:", userData);

      if (!userData || userData.rol !== "resident") {
        console.warn(`⚠️ Acceso denegado, rol inválido (${userData?.rol}) → cerrando sesión`);
        await auth.signOut();
        window.location.href = "../index.html";
        return;
      }

      console.log("✅ Rol 'resident' confirmado, habilitando formulario de anuncio de visitas");

    } catch (err) {
      console.error("❌ Error verificando datos del usuario:", err);
      await auth.signOut();
      window.location.href = "../index.html";
    }
  });

  // ─── 3) Manejar envío del formulario ──────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const visitorName = document.getElementById('visitorNameInput').value.trim();
    const reference   = document.getElementById('referenceInput').value.trim();

    if (!visitorName) {
      alert("Por favor ingresa el nombre del visitante.");
      return;
    }

    try {
      const user = auth.currentUser;
      const uDoc = await db.collection('usuarios').doc(user.uid).get();

      if (!uDoc.exists) {
        alert("Error: No se encontró la información del residente.");
        return;
      }

      const uData = uDoc.data();

      // ─── 3.1) Crear visita con campos completos y consistentes ───────────
      const visitRef = await db.collection('visits').add({
        visitorName,
        reference: reference || '',
        residentName : uData.nombre || '',
        residentPhone: uData.telefono || '',
        house        : uData.casa || '',
        block        : uData.bloque || '',
        residentId   : user.uid,
        status       : 'pendiente',
        createdAt    : firebase.firestore.FieldValue.serverTimestamp()
      });

      // ─── 3.2) Mostrar el QR generado ───────────────────────────────
      new QRious({
        element: qrCanvas,
        value  : visitRef.id,
        size   : 250
      });

      qrSection.style.display = 'block';

      // ─── 3.3) Configurar el botón para compartir por WhatsApp ─────
      const baseUrl = window.location.origin + '/residencial-visitas-app';
      const visitorLink = `${baseUrl}/visitor.html?id=${visitRef.id}`;
      const whatsappText =
        `Favor mostrar este código al personal de seguridad de Residencial Los Prados al ingresar:\n\n${visitorLink}`;

      shareBtn.onclick = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
        window.open(url, '_blank');
      };

      // ─── 3.4) Limpiar el formulario para permitir más registros ───
      form.reset();

    } catch (err) {
      console.error("❌ Error al anunciar visita:", err);
      alert("Ocurrió un error al crear la visita. Verifica tu conexión o consulta con soporte.");
    }
  });
});
