// js/main.js

// — Inicializar Firebase —
firebase.initializeApp({
  apiKey:    "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:"residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId:     "1:21258599408:web:81a0a5b062aac6e6bdfb35",
  measurementId: "G-TFYENFPEKX"
});

const auth = firebase.auth();
const db   = firebase.firestore();

// — Manejo de login por Identidad + Contraseña —
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const identidad = document.getElementById('identidad').value.trim();
  const password  = document.getElementById('password').value.trim();
  const errorElem = document.getElementById('error');
  errorElem.textContent = '';
  errorElem.style.color = 'red';

  if (!identidad) {
    errorElem.textContent = 'Ingresa tu número de identidad.';
    return;
  }
  if (!password) {
    errorElem.textContent = 'Ingresa tu contraseña.';
    return;
  }

  try {
    // 1) Traer perfil por identidad
    const snap = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .limit(1)
      .get();

    if (snap.empty) {
      throw { code: 'auth/user-not-found' };
    }

    // 2) Extraer email y rol del perfil encontrado
    const perfil = snap.docs[0].data();
    const email  = perfil.correo;
    const rol    = perfil.rol;

    if (!email || !rol) {
      throw { code: 'auth/user-not-found' };
    }

    // 3) Hacer login en Auth con el email recuperado
    await auth.signInWithEmailAndPassword(email, password);

    // 4) Redirigir según rol
    if (rol === 'guard') {
      window.location.href = "guard/";
    } else if (rol === 'guard_admin') {
      window.location.href = "guard-admin/";
    } else if (rol === 'resident') {
      window.location.href = "resident/";
    } else {
      throw { code: 'auth/no-role' };
    }

  } catch (err) {
    // Credenciales inválidas
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-email' ||
      err.code === 'auth/invalid-login-credentials'
    ) {
      errorElem.textContent = 'Identidad o contraseña incorrectos.';
    }
    // Perfil sin rol válido
    else if (err.code === 'auth/no-role') {
      errorElem.textContent = 'Usuario sin rol asignado. Contactar administración.';
    }
    // Otros errores
    else {
      errorElem.textContent = err.message || 'Error inesperado.';
    }
  }
});
