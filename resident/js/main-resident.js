// js/main-resident.js

// Inicializar Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});

const auth = firebase.auth();
const db = firebase.firestore();

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = '../index.html');
});

// Verificar sesión y cargar visitas
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }
    try {
      const uid = user.uid;
      const userDoc = await db.collection('usuarios').doc(uid).get();
      const data = userDoc.data();

      // REMOVIDO: Lógica de restricción por rol y estado_pago

      cargarVisitas(uid);

    } catch (err) {
      console.error("Error al verificar datos del usuario:", err);
      window.location.href = "../index.html";
    }
  });
});

// Cargar visitas de las últimas 24 horas del residente
function cargarVisitas(uid) {
  const tbody = document.getElementById('visitasBody');
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  db.collection('visits')
    .where('residentId', '==', uid)
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(hace24h))
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center;">
              Sin visitas registradas en las últimas 24 horas
            </td>
          </tr>`;
        return;
      }
      snapshot.forEach(doc => {
        const v = doc.data();
        const fecha = v.createdAt?.toDate().toLocaleString() || '';
        const obs = v.reference || '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${v.visitorName || 'Sin nombre'}</td>
          <td>${v.status || ''}</td>
          <td>${fecha}</td>
          <td>${obs}</td>
        `;
        tbody.appendChild(tr);
      });
    }, err => {
      console.error("Error cargando visitas:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:red;">
            Error al cargar visitas. Revisa la consola.
          </td>
        </tr>`;
    });
}
