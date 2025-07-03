// reset-password.js

// — Inicializar Firebase (mismas credenciales que tu app) —
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

const form    = document.getElementById('resetForm');
const msgElem = document.getElementById('resetMsg');

form.addEventListener('submit', async e => {
  e.preventDefault();
  msgElem.textContent = '';
  msgElem.style.color = 'red';

  const identidad = document.getElementById('identidad').value.trim();
  const email     = document.getElementById('email').value.trim();
  const telefono  = document.getElementById('telefono').value.trim();

  if (!identidad || !email || !telefono) {
    msgElem.textContent = 'Por favor completa todos los campos.';
    return;
  }

  try {
    // 1) Buscar usuario por identidad + correo + teléfono
    const query = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .where('correo',    '==', email)
      .where('telefono',  '==', telefono)
      .limit(1)
      .get();

    if (query.empty) {
      msgElem.textContent = 'No encontramos ningún usuario con esos datos.';
      return;
    }

    // 2) Enviar enlace de restablecimiento
    await auth.sendPasswordResetEmail(email);

    msgElem.style.color = 'green';
    msgElem.textContent = 'Te enviamos un enlace a tu correo para restablecer la contraseña.';
  } catch (err) {
    console.error(err);
    msgElem.textContent = err.message;
  }
});
