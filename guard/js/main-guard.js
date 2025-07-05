// js/main-guard.js

// ─── Inicializar Firebase ────────────────────────────────────────────────
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

// ─── Verificar sesión con identidad ──────────────────────────────────────
auth.onAuthStateChanged(async user => {
  console.log('🛠️ onAuthStateChanged → user =', user);

  if (!user) {
    console.warn('🔒 No hay usuario autenticado → redirigiendo a login');
    return window.location.href = "../index.html";
  }

  const identidad = prompt("Ingrese su número de identidad para validar acceso:");
  if (!identidad) {
    alert("⚠️ Debe ingresar su número de identidad para continuar.");
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  console.log(`🔍 Buscando usuario con identidad: "${identidad}" en Firestore...`);

  try {
    const query = await db.collection("usuarios").where("identidad", "==", identidad).get();

    if (query.empty) {
      console.warn("❌ Identidad no encontrada en Firestore → cerrando sesión");
      alert("⚠️ Identidad no encontrada en el sistema. Contacte a administración.");
      await auth.signOut();
      return window.location.href = "../index.html";
    }

    const perfilDoc = query.docs[0];
    const perfilData = perfilDoc.data();

    console.log("✅ Usuario encontrado:", perfilData);

    if (perfilData.UID !== user.uid) {
      console.warn("❌ UID no coincide con el del usuario autenticado → cerrando sesión");
      alert("⚠️ El UID no coincide con el usuario autenticado. Contacte a administración.");
      await auth.signOut();
      return window.location.href = "../index.html";
    }

    if (!perfilData.rol || perfilData.rol.trim() !== "guard") {
      console.warn(`❌ Acceso denegado, rol inválido: "${perfilData.rol}" → cerrando sesión`);
      alert(`⚠️ Acceso denegado. Se requiere rol "guard" para acceder.`);
      await auth.signOut();
      return window.location.href = "../index.html";
    }

    console.log('✅ Validación de identidad y rol exitosa → iniciando dashboard');
    iniciarDashboardGuardia();

  } catch (err) {
    console.error("❌ Error consultando Firestore:", err);
    alert("Error consultando Firestore: " + err.message);
    await auth.signOut();
    window.location.href = "../index.html";
  }
});

// ─── Inicializar Dashboard Guardia ────────────────────────────────────────
function iniciarDashboardGuardia() {
  console.log('🚀 Iniciando Dashboard de Guardia');

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    console.log('🔐 Cerrar sesión solicitado');
    auth.signOut().then(() => {
      console.log('🔑 Sesión cerrada, redirigiendo a login');
      window.location.href = "../index.html";
    });
  });

  if (document.getElementById("activarQRBtn")) {
    console.log('🛠️ Activando QR Scanner');
    manejarQR();
  }
  if (document.getElementById("visitas-body")) {
    console.log('🛠️ Cargando visitas pendientes');
    cargarVisitasPendientes();
  }
  if (document.getElementById("residents-body")) {
    console.log('🛠️ Cargando pagos de residentes');
    cargarPagosResidentes();
  }

  document.getElementById("pagosBtn")?.addEventListener("click", () => {
    console.log('🛠️ Botón de pagos presionado, redirigiendo a pagos.html');
    window.location.href = "pagos.html";
  });
}

// ─── El resto de funciones quedan igual ───────────────────────────────────
// manejarQR, cargarVisitasPendientes, procesarVisita, cargarPagosResidentes
// No necesitan modificación y seguirán funcionando correctamente.

