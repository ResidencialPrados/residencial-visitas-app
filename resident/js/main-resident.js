// Configurar persistencia local para mantener sesión al cerrar app
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(error => console.error("Error configurando persistencia:", error));

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

// Verificar sesión, rol y estado de pago
document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
      return;
    }

    try {
      const uid = user.uid;
      const userDoc = await db.collection('usuarios').doc(uid).get();

      if (!userDoc.exists) {
        alert("Usuario no encontrado.");
        await auth.signOut();
        window.location.href = "../index.html";
        return;
      }

      const data = userDoc.data();
      const rol = data.rol || '';

      // Impedir accesos cruzados
      if (rol !== 'resident') {
        alert("No tienes permiso para acceder al Dashboard de Residente.");
        if (rol === 'guard_admin') {
          window.location.href = "../guard-admin/index.html";
        } else if (rol === 'guard') {
          window.location.href = "../guard/index.html";
        } else {
          window.location.href = "../index.html";
        }
        return;
      }

      // Mostrar alerta de pago pendiente
      if (data.estado_pago !== 'Pagado') {
        document.getElementById('pagoPendiente').textContent =
          "⚠️ Su pago está vencido. Contacte administración.";
      }

      // Cargar visitas
      cargarVisitas(uid);

    } catch (err) {
      console.error("Error al verificar rol y estado de pago:", err);
      window.location.href = "../index.html";
    }
  });
});

// Cargar visitas de las últimas 24h
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
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin visitas registradas en las últimas 24 horas</td></tr>';
      } else {
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
      }
    });
}
