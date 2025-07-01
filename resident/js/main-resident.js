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

// Botón cerrar sesión
document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = '../index.html');
});

// Al cargar
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = "../index.html";
            return;
        }
        const uid = user.uid;
        const userDoc = await db.collection('usuarios').doc(uid).get();
        const data = userDoc.data();

        if (data.estado_pago !== 'Pagado') {
            document.getElementById('pagoPendiente').textContent = "⚠️ Su pago está vencido. Contacte administración.";
        }

        cargarVisitas(uid);
    });
});

// Cargar visitas del residente
function cargarVisitas(uid) {
    const tbody = document.getElementById('visitasBody');
    db.collection('visits')
        .where('residentId', '==', uid)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            tbody.innerHTML = '';
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin visitas registradas</td></tr>';
            } else {
                snapshot.forEach(doc => {
                    const v = doc.data();
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${v.visitorName}</td>
                        <td>${v.status}</td>
                        <td>${v.createdAt ? v.createdAt.toDate().toLocaleString() : ''}</td>
                        <td>${v.reference || ''}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        });
}

// Anunciar visita
document.getElementById('anunciarVisitaBtn').addEventListener('click', async () => {
    const visitorName = prompt("Nombre completo del visitante:");
    if (!visitorName) return;
    const reference = prompt("Referencia u observación:");

    const user = auth.currentUser;
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const residente = userDoc.data();

    try {
        const visitRef = await db.collection('visits').add({
            visitorName,
            reference: reference || '',
            residentName: residente.nombre,         // corregido
            residentPhone: residente.telefono,      // corregido
            house: residente.casa,                  // corregido
            block: residente.bloque,                // corregido
            residentId: user.uid,
            status: 'pendiente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const qrText = `Visitante: ${visitorName}\nAnunciante: ${residente.nombre}\nTel: ${residente.telefono}\nCasa: ${residente.casa} Bloque: ${residente.bloque}\nID: ${visitRef.id}`;

        const qr = new QRious({
            element: document.getElementById('qr'),
            value: qrText,
            size: 250
        });

        document.getElementById('qrContainer').style.display = 'block';
        document.getElementById('compartirBtn').onclick = () => {
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent("Te comparto tu QR de visita:\n\n" + qrText)}`;
            window.open(whatsappUrl, '_blank');
        };

    } catch (error) {
        console.error("Error al anunciar visita:", error);
        alert("Error al anunciar visita, contacte administración.");
    }
});
