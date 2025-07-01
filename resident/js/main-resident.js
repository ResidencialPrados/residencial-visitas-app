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

document.addEventListener('DOMContentLoaded', () => {
  auth.onAuthStateChanged(async user => {
    if (!user) {
      window.location.href = "../index.html";
    } else {
      const userDoc = await db.collection('usuarios').doc(user.uid).get();
      if (!userDoc.exists || userDoc.data().rol !== 'resident') {
        alert('Acceso denegado. Solo residentes pueden acceder aquí.');
        await auth.signOut();
        window.location.href = "../index.html";
        return;
      }
      iniciarDashboardResidente(user, userDoc.data());
    }
  });
});

// Cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => auth.signOut());

function iniciarDashboardResidente(user, residenteData) {
  const form = document.getElementById('crearVisitaForm');
  const msg = document.getElementById('mensajeVisita');
  const qrCanvas = document.getElementById('qrCanvas');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = "Generando QR y registrando visita...";

    const visitorName = document.getElementById('nombreVisitante').value.trim();
    const visitorPhone = document.getElementById('telefonoVisitante').value.trim();
    const scheduledTime = document.getElementById('fechaHoraVisita').value;

    if (!visitorName || !visitorPhone || !scheduledTime) {
      msg.textContent = "Todos los campos son obligatorios.";
      return;
    }

    try {
      // Crear documento de visita
      const visitRef = await db.collection('visits').add({
        visitorName,
        visitorPhone,
        residentName: residenteData.nombre || 'Sin nombre',
        residentPhone: residenteData.phone || 'Sin teléfono',
        house: residenteData.house || 'Sin casa',
        block: residenteData.block || 'Sin bloque',
        residentId: user.uid,
        scheduledTime: firebase.firestore.Timestamp.fromDate(new Date(scheduledTime)),
        status: 'pendiente',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Generar QR
      const qr = new QRious({
        element: qrCanvas,
        size: 250,
        value: visitRef.id
      });
      qrCanvas.style.display = 'block';
      msg.textContent = "Visita registrada y QR generado correctamente.";

      form.reset();
      cargarVisitas(user.uid);

    } catch (error) {
      console.error(error);
      msg.textContent = "Error al registrar visita: " + error.message;
    }
  });

  cargarVisitas(user.uid);
}

function cargarVisitas(residentUid) {
  const tbody = document.getElementById('visitasBody');
  db.collection('visits')
    .where('residentId', '==', residentUid)
    .orderBy('scheduledTime', 'desc')
    .onSnapshot(snapshot => {
      tbody.innerHTML = '';
      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay visitas registradas.</td></tr>';
      } else {
        snapshot.forEach(doc => {
          const v = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${v.visitorName}</td>
            <td>${v.visitorPhone}</td>
            <td>${v.scheduledTime ? v.scheduledTime.toDate().toLocaleString() : 'Sin hora'}</td>
