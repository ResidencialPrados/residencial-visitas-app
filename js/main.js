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
    // 1) Buscar usuario por identidad
    const snap = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .limit(1)
      .get();

    if (snap.empty) {
      throw { code: 'auth/user-not-found' };
    }

    const { correo: email } = snap.docs[0].data();
    if (!email) {
      throw { code: 'auth/user-not-found' };
    }

    // 2) Iniciar sesión con el email recuperado
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // 3) Obtener rol y redirigir
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      throw { code: 'auth/no-role' };
    }

    const rol = userDoc.data().rol;
    if (rol === 'guard') {
      location.href = "./guard/";
    } else if (rol === 'guard_admin') {
      location.href = "./guard-admin/";
    } else if (rol === 'resident') {
      location.href = "./resident/";
    } else {
      throw { code: 'auth/no-role' };
    }

  } catch (err) {
    // Errores de credenciales inválidas
    if (
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-login-credentials' ||
      err.code === 'auth/invalid-email' ||
      err.code === 'auth/user-not-found'
    ) {
      errorElem.textContent = 'Identidad o contraseña incorrectos.';
    }
    // Usuario sin rol
    else if (err.code === 'auth/no-role') {
      errorElem.textContent = 'Usuario sin rol asignado. Contactar administración.';
    }
    // Otros errores
    else {
      errorElem.textContent = err.message || 'Error inesperado.';
    }
  }
});
