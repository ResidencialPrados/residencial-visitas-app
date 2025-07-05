// js/main-guard.js

// ─── Inicializar Firebase ────────────────────────────────────────────────
firebase.initializeApp({
  apiKey:         "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain:     "residencial-qr.firebaseapp.com",
  projectId:      "residencial-qr",
  storageBucket:  "residencial-qr.appspot.com",
  messagingSenderId:"21258599408",
  appId:          "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
const auth = firebase.auth();
const db   = firebase.firestore();

// ─── Verificar sesión y perfil ───────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  console.log('🛠️ onAuthStateChanged → user =', user);
  if (!user) {
    console.warn('🔒 No hay usuario autenticado → redirigiendo a login');
    return window.location.href = "../index.html";
  }

  // Leer perfil en Firestore
  const perfilRef  = db.collection("usuarios").doc(user.uid);
  let perfilSnap;
  try {
    perfilSnap = await perfilRef.get();
  } catch (err) {
    console.error('❌ Error leyendo perfil Firestore:', err);
    // opcional: forzamos logout
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  console.log('🔥 perfilSnap.exists =', perfilSnap.exists);
  console.log('🔥 perfilSnap.data() =', perfilSnap.data());

  if (!perfilSnap.exists) {
    console.warn('⚠️ Perfil no existe → cerrando sesión y redirigiendo');
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  const perfil = perfilSnap.data();
  if (perfil.rol !== "guard") {
    console.warn(`⚠️ Rol incorrecto (${perfil.rol}) → logout`);
    await auth.signOut();
    return window.location.href = "../index.html";
  }

  console.log('✅ Perfil válido y rol "guard" confirmado → iniciando dashboard');
  iniciarDashboardGuardia();
});

// ─── Inicializar Dashboard Guardia ────────────────────────────────────────
function iniciarDashboardGuardia() {
  console.log('🚀 iniciarDashboardGuardia');

  // Botón Cerrar sesión
  document.getElementById("logoutBtn")
    .addEventListener("click", () => {
      console.log('🔐 Cerrar sesión solicitado');
      auth.signOut().then(() => {
        console.log('🔑 Sesión cerrada, redirigiendo a login');
        window.location.href = "../index.html";
      });
    });

  // QR Scanner
  if (document.getElementById("activarQRBtn")) {
    manejarQR();
  }

  // Cargar vistas
  if (document.getElementById("visitas-body")) {
    cargarVisitasPendientes();
  }
  if (document.getElementById("residents-body")) {
    cargarPagosResidentes();
  }

  // Ir a pagos
  document.getElementById("pagosBtn")?.addEventListener("click", () => {
    window.location.href = "pagos.html";
  });
}

// ─── QR Scanner ───────────────────────────────────────────────────────────
function manejarQR() {
  const btn   = document.getElementById("activarQRBtn");
  const qrDiv = document.getElementById("qr-reader");
  let scanner = null;

  btn.addEventListener("click", () => {
    console.log('📷 manejarQR → scanner =', scanner);
    if (scanner) {
      scanner.stop().then(() => scanner.clear()).then(() => {
        qrDiv.style.display = "none";
        qrDiv.innerHTML    = "";
        scanner = null;
      });
    } else {
      qrDiv.style.display = "block";
      qrDiv.innerHTML     = "";
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decoded => {
          console.log('🔍 QR decodeado:', decoded);
          scanner.stop().then(() => scanner.clear()).then(() => {
            qrDiv.style.display = "none";
            qrDiv.innerHTML    = "";
            scanner = null;
            window.location.href = `../process.html?id=${decoded.trim()}`;
          });
        },
        err => console.warn("❌ QR Error:", err)
      ).catch(err => {
        console.error("❌ Error al iniciar lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    }
  });
}

// ─── Cargar Visitas Pendientes ────────────────────────────────────────────
function cargarVisitasPendientes() {
  console.log('📥 cargarVisitasPendientes');
  const tbody  = document.getElementById("visitas-body");
  const cutoff = new Date(Date.now() - 24*60*60*1000);

  db.collection("visits")
    .where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(cutoff))
    .orderBy("createdAt", "desc")
    .onSnapshot(snapshot => {
      console.log('📊 Snapshot visitas size =', snapshot.size);
      tbody.innerHTML = "";
      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr><td colspan="10" style="text-align:center;color:gray;">
            No hay visitas en las últimas 24 horas
          </td></tr>`;
        return;
      }
      snapshot.forEach(doc => {
        const v    = doc.data();
        const hora = v.createdAt?.toDate().toLocaleString() || "";
        const tr   = document.createElement("tr");
        tr.innerHTML = `
          <td>${v.visitorName||""}</td>
          <td>${v.vehicle?.marca||""}</td>
          <td>${v.vehicle?.color||""}</td>
          <td>${v.vehicle?.placa||""}</td>
          <td>${v.house||""}</td>
          <td>${v.block||""}</td>
          <td>${v.residentPhone||""}</td>
          <td class="guard-cell">${v.guardName||""}</td>
          <td>${hora}</td>
          <td>${
            v.status==="pendiente"
              ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
              : "Ingresado"
          }</td>`;
        tbody.appendChild(tr);

        // Si no vino guardName, lo rellenamos desde guardId
        if (v.guardId && !v.guardName) {
          db.collection("usuarios").doc(v.guardId).get()
            .then(s => {
              if (s.exists) {
                tr.querySelector(".guard-cell").textContent = s.data().nombre;
              }
            });
        }
      });
    }, err => {
      console.error("❌ Error cargando visitas:", err);
    });
}

// ─── Procesar Visita ────────────────────────────────────────────────────────
async function procesarVisita(id) {
  console.log('▶️ procesarVisita(', id, ')');
  const ref  = db.collection("visits").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().status==="ingresado") {
    return alert("Visita no válida o ya ingresada.");
  }
  const v = snap.data();
  const marca = prompt("Marca (opcional):") || null;
  const color = prompt("Color (opcional):") || null;
  const placa = prompt("Placa (opcional):") || null;
  const uid   = auth.currentUser.uid;
  const guardSnap = await db.collection("usuarios").doc(uid).get();
  const guardName = guardSnap.exists ? guardSnap.data().nombre : "Desconocido";

  await ref.update({
    status:      "ingresado",
    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
    guardId:     uid,
    guardName,
    vehicle:     { marca, color, placa }
  });
  console.log('✅ Visita marcada como ingresada');
  alert("Ingreso registrado con éxito.");
}

// ─── Cargar Pagos de Residentes ─────────────────────────────────────────────
function cargarPagosResidentes() {
  console.log('📥 cargarPagosResidentes');
  const tbody    = document.getElementById("residents-body");
  const buscador = document.getElementById("buscarResidente");
  let cache = [];
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  db.collection("usuarios")
    .where("rol","==","resident")
    .onSnapshot(snap => {
      console.log('📊 Snapshot residentes size =', snap.size);
      cache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener("input", e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const arr = list.filter(r =>
      (r.nombre    || "").toLowerCase().includes(txt) ||
      (r.correo    || "").toLowerCase().includes(txt) ||
      String(r.casa).includes(txt) ||
      String(r.bloque).includes(txt) ||
      (r.telefono  || "").includes(txt)
    );
    console.log('🔍 Filtrando residentes con "', filter, '":', arr.length);
    if (!arr.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }
    const hoy = new Date(), a = hoy.getFullYear(), m = hoy.getMonth()+1;
    tbody.innerHTML = arr.map(r => {
      const pagos = r.pagos||{};
      const key   = `${a}-${String(m).padStart(2,"0")}`;
      let estado = "Pendiente";
      if (key in pagos) {
        const last = Object.keys(pagos).sort().pop();
        const [yy, mm] = last.split("-");
        estado = `${meses[+mm-1]} ${yy}`;
      }
      return `
        <tr ${estado==="Pendiente"?'class="pendiente"':''}>
          <td>${r.nombre}</td>
          <td>${r.correo}</td>
          <td>${r.telefono}</td>
          <td>${r.casa}</td>
          <td>${r.bloque}</td>
          <td>${estado}</td>
        </tr>`;
    }).join("");
  }
}
