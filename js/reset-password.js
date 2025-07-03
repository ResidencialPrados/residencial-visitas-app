// reset-password.js

// Inicializa Firebase (mismas credenciales)
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
    const q = await db
      .collection('usuarios')
      .where('identidad','==',identidad)
      .where('correo',   '==',email)
      .where('telefono', '==',telefono)
      .limit(1)
      .get();

    if (q.empty) {
      msgElem.textContent = 'Datos no coinciden con ningún usuario.';
      return;
    }

    await auth.sendPasswordResetEmail(email);
    msgElem.style.color = 'green';
    msgElem.textContent = 'Enlace enviado a tu correo.';
  } catch (err) {
    msgElem.textContent = err.message;
  }
});
