// js/main.js

// — Inicializar Firebase —
firebase.initializeApp({
  apiKey:    "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:"residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId:     "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
const auth = firebase.auth();
const db   = firebase.firestore();

// — Manejo de login por Identidad + Contraseña —
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const identidad = document.getElementById('identidad').value.trim();
  const password  = document.getElementById('password').value;
  const errorElem = document.getElementById('error');
  errorElem.textContent = '';
  errorElem.style.color = 'red';

  console.log('🔑 Intento de login con identidad:', identidad);

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

    console.log('📄 Resultados de consulta por identidad:', snap.size);
    if (snap.empty) {
      throw { code: 'auth/user-not-found' };
    }

    // 2) Extraer email del perfil encontrado
    const perfilDoc = snap.docs[0];
    const perfil    = perfilDoc.data();
    console.log('👤 Perfil encontrado:', perfil);

    const email = perfil.correo;
    if (!email) {
      throw { code: 'auth/user-not-found' };
    }

    // 3) Hacer login en Auth con el email recuperado
    await auth.signInWithEmailAndPassword(email, password);
    console.log('✅ Autenticación exitosa en Firebase Auth con email:', email);

    // 4) REMOVIDO: Redirección según rol para reinicio de lógica Ledin
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error('❌ Error en el proceso de login:', err);
    // Errores de credenciales
    if (
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/wrong-password'
    ) {
      errorElem.textContent = 'Identidad o contraseña incorrectos.';
    }
    // Usuario sin rol válido
    else if (err.code === 'auth/no-role') {
      errorElem.textContent = 'Usuario sin rol asignado. Contacta a soporte.';
    }
    // Otros errores
    else {
      errorElem.textContent = err.message || 'Error inesperado.';
    }
  }
});
