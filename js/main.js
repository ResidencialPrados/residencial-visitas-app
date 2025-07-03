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
    // 1) Buscamos al usuario por su número de identidad
    const snapshot = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .limit(1)
      .get();

    if (snapshot.empty) {
      errorElem.textContent = 'Usuario no encontrado.';
      return;
    }

    const userData = snapshot.docs[0].data();
    const email    = userData.correo;
    if (!email) {
      errorElem.textContent = 'No se encontró correo asociado.';
      return;
    }

    // 2) Hacemos login con el email recuperado
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // 3) Obtenemos rol y redirigimos
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      errorElem.textContent = 'Usuario sin rol asignado. Contacta al admin.';
      await auth.signOut();
      return;
    }

    const rol = userDoc.data().rol;
    switch (rol) {
      case 'guard':
        window.location.href = "./guard/";
        break;
      case 'guard_admin':
        window.location.href = "./guard-admin/";
        break;
      case 'resident':
        window.location.href = "./resident/";
        break;
      default:
        errorElem.textContent = 'Rol desconocido. Contacta al admin.';
        await auth.signOut();
    }

  } catch (err) {
    // Muestra un mensaje amable en caso de credenciales inválidas
    if (err.code === 'auth/invalid-email' || err.code === 'auth/wrong-password') {
      errorElem.textContent = 'Identidad o contraseña incorrectos.';
    } else {
      errorElem.textContent = err.message;
    }
  }
});

// — Enlace a “Olvidé mi contraseña” —
// Asume que en tu HTML <a id="resetPasswordLink" href="reset-password.html">…
document.getElementById('resetPasswordLink')
  .addEventListener('click', e => {
    // Dejamos que el <a> normal haga la navegación
  });
