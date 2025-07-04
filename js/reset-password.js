// js/reset-password.js

// — Inicializar Firebase (incluyendo measurementId, sin problema) —
firebase.initializeApp({
  apiKey:             "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:         "residencial-qr.firebaseapp.com",
  projectId:          "residencial-qr",
  storageBucket:      "residencial-qr.appspot.com",
  messagingSenderId:  "21258599408",
  appId:              "1:21258599408:web:81a0a5b062aac6e6bdfb35",
  measurementId:      "G-TFYENFPEKX"
});
const auth = firebase.auth();
const db   = firebase.firestore();

const form    = document.getElementById('resetForm');
const msgElem = document.getElementById('resetMsg');

form.addEventListener('submit', async e => {
  e.preventDefault();
  msgElem.style.color = 'red';
  msgElem.textContent = '';

  const identidad = document.getElementById('identidad').value.trim();
  const email     = document.getElementById('email').value.trim();
  const telefono  = document.getElementById('telefono').value.trim();

  if (!identidad || !email || !telefono) {
    msgElem.textContent = 'Completa todos los campos.';
    return;
  }

  try {
    // Verifica que exista un usuario con esos datos
    const q = await db
      .collection('usuarios')
      .where('identidad', '==', identidad)
      .where('correo',    '==', email)
      .where('telefono',  '==', telefono)
      .limit(1)
      .get();

    if (q.empty) {
      msgElem.textContent = 'Datos no coinciden con ningún usuario.';
      return;
    }

    // Envía el correo de restablecimiento
    await auth.sendPasswordResetEmail(email);
    msgElem.style.color = 'green';
    msgElem.textContent = 'Enlace enviado a tu correo.';

    // Redirige al index después de 3 segundos
    setTimeout(() => {
      window.location.href = '../index.html';
    }, 3000);

  } catch (err) {
    console.error(err);
    msgElem.textContent = 'Error: ' + err.message;
  }
});
