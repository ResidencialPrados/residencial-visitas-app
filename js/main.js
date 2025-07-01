// Inicializar Firebase
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
const db = firebase.firestore();

// Manejo de login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  document.getElementById('error').textContent = '';

  try {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Obtener rol del usuario
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (!userDoc.exists) {
      document.getElementById('error').textContent = 'Usuario sin rol asignado. Contactar administración.';
      await auth.signOut();
      return;
    }

    const rol = userDoc.data().rol;
    if (rol === 'guard') {
      window.location.href = "/guard/";
    } else if (rol === 'guard_admin') {
      window.location.href = "/guard-admin/";
    } else if (rol === 'resident') {
      window.location.href = "/resident/";
    } else {
      document.getElementById('error').textContent = 'Rol desconocido. Contactar administración.';
      await auth.signOut();
    }

  } catch (error) {
    document.getElementById('error').textContent = error.message;
  }
});
