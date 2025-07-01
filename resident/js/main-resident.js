// Inicializar Firebase como antes
firebase.initializeApp({ /* tu config */ });
const auth = firebase.auth(), db = firebase.firestore();

// Al cargar pestaña
window.addEventListener('load', () => auth.onAuthStateChanged(u => {
  if (u) loadResidentUI(u);
  else showResidentLogin();
}));

function showResidentLogin() {
  document.getElementById('app').innerHTML = `
    <h2>Login Residente</h2>
    <form id="loginR">
      <input id="email" type="email" required placeholder="Email"/><br>
      <input id="pass" type="password" required placeholder="Contraseña"/><br>
      <button>Entrar</button>
    </form>
  `;
  document.getElementById('loginR').addEventListener('submit', e => {
    e.preventDefault();
    auth.signInWithEmailAndPassword(email.value, pass.value)
      .catch(err => alert(err.message));
  });
}

function loadResidentUI(user) {
  document.getElementById('app').innerHTML = `
    <h2>Bienvenido, ${user.email}</h2>
    <button id="logoutR">Cerrar Sesión</button>
    <div id="visit-form"></div>
  `;
  document.getElementById('logoutR').onclick = () => auth.signOut();
  // Aquí armamos el formulario de nueva visita + QR
}
