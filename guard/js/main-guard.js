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

// ─── Verificar sesión y perfil ───────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  console.log('🛠️ onAuthStateChanged → user =', user);

  if (!user) {
    console.warn('🔒 No hay usuario autenticado → redirigiendo a login');
    return window.location.href = "../index.html";
  }

  console.log(`🔍 Verificando perfil en Firestore para UID: ${user.uid}`);

  const perfilRef = db.collection("usuarios").doc(user.uid);
  let perfilSnap;
  try {
    perfilSnap = await perfilRef.get();
    console.log('✅ Perfil obtenido de Firestore correctamente');
  } catch (err) {
    console.error('❌ Error leyendo perfil Firestore:', err);
    alert('Error leyendo perfil Firestore: ' + err.message);
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  console.log('🔥 perfilSnap.exists =', perfilSnap.exists);
  console.log('🔥 perfilSnap.data() =', perfilSnap.data());

  if (!perfilSnap.exists) {
    console.warn('⚠️ Perfil no existe en Firestore → cerrando sesión y redirigiendo');
    alert('⚠️ Perfil no existe en Firestore');
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  const perfilData = perfilSnap.data();
  console.log(`🛡️ Rol recuperado del perfil: "${perfilData.rol}"`);

  if (!perfilData || perfilData.rol.trim() !== "guard") {
    console.warn(`⚠️ Acceso denegado, rol inválido ("${perfilData.rol}") → cerrando sesión`);
    alert(`Acceso denegado: rol detectado = "${perfilData.rol}". Debe ser "guard" exacto.`);
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  console.log('✅ Rol "guard" confirmado → iniciando dashboard');
  iniciarDashboardGuardia();
});

// ─── Inicializar Dashboard Guardia ────────────────────────────────────────
function iniciarDashboardGuardia() {
  console.log('🚀 Iniciando Dashboard de Guardia');

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    console.log('🔐 Cerrar sesión solicitado por usuario');
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

// El resto de tus funciones (manejarQR, cargarVisitasPendientes, procesarVisita, cargarPagosResidentes) se mantienen iguales.
