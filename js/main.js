// login.js

// — Inicializar Firebase —
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35",
  measurementId: "G-TFYENFPEKX"
});

const auth = firebase.auth();
const db   = firebase.firestore();

// — Manejo de login por Identidad + Contraseña —
document.getElementById('loginForm').addEventListener('submit', async (e) => {
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
    // 1) Buscar usuario en Firestore por identidad
    const query = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .limit(1)
      .get();

    if (query.empty) {
      errorElem.textContent = 'Usuario no encontrado.';
      return;
    }

    const userData = query.docs[0].data();
    const email    = userData.correo;

    // 2) Iniciar sesión con el email obtenido
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // 3) Obtener rol y redirigir
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      errorElem.textContent = 'Usuario sin rol asignado. Contactar administración.';
      await auth.signOut();
      return;
    }

    const rol = userDoc.data().rol;
    if (rol === 'guard') {
      window.location.href = "./guard/";
    } else if (rol === 'guard_admin') {
      window.location.href = "./guard-admin/";
    } else if (rol === 'resident') {
      window.location.href = "./resident/";
    } else {
      errorElem.textContent = 'Rol desconocido. Contactar administración.';
      await auth.signOut();
    }

  } catch (err) {
    errorElem.textContent = err.message;
  }
});

// — Acción: “Olvidé mi contraseña” por Identidad —
document.getElementById('resetPasswordLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const identidad = prompt('Para recuperar tu contraseña, ingresa tu número de identidad:').trim();
  const errorElem = document.getElementById('error');
  errorElem.textContent = '';
  errorElem.style.color = 'red';

  if (!identidad) {
    errorElem.textContent = 'Identidad requerida.';
    return;
  }

  try {
    // Buscar usuario por identidad
    const query = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .limit(1)
      .get();

    if (query.empty) {
      errorElem.textContent = 'No se encontró usuario con esa identidad.';
      return;
    }

    const email = query.docs[0].data().correo;

    // Enviar email de restablecimiento
    await auth.sendPasswordResetEmail(email);

    errorElem.style.color = 'green';
    errorElem.textContent = 'Te hemos enviado un enlace a tu correo para restablecer la contraseña.';
  } catch (err) {
    errorElem.textContent = err.message;
  }
});
