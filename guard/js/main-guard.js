// js/main-guard.js

// ─── Inicializar Firebase ─────────────────────────────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyAkKV3Vp0u9NGVRlWbx22XDvoMnVoFpItI",
  authDomain: "residencial-qr.firebaseapp.com",
  projectId: "residencial-qr",
  storageBucket: "residencial-qr.appspot.com",
  messagingSenderId: "21258599408",
  appId: "1:21258599408:web:81a0a5b062aac6e6bdfb35"
});
const auth = firebase.auth();
const db   = firebase.firestore();

console.log("📄 main-guard.js cargado");

// ─── Verificar sesión y perfil ────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  console.log("🔔 onAuthStateChanged →", user);
  if (!user) {
    console.warn("🔒 No hay usuario autenticado. Redirigiendo a login.");
    return window.location.href = "../index.html";
  }

  console.log("🔑 UID:", user.uid, "email:", user.email);
  const perfilRef = db.collection("usuarios").doc(user.uid);

  try {
    let perfilSnap = await perfilRef.get();
    console.log("👀 perfil.exists =", perfilSnap.exists);

    // Si no existe documento, lo creamos como guardia
    if (!perfilSnap.exists) {
      console.warn("⚠️ Perfil no encontrado. Creando documento de guardia...");
      await perfilRef.set({
        UID:            user.uid,
        correo:         user.email,
        rol:            "guard",
        nombre:         "",
        identidad:      "",
        telefono:       "",
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("✅ Documento de guardia creado.");
      perfilSnap = await perfilRef.get();
    }

    const perfil = perfilSnap.data();
    console.log("📑 Datos de perfil:", perfil);

    if (perfil.rol !== "guard") {
      console.error(`⛔️ Acceso denegado para rol "${perfil.rol}".`);
      return window.location.href = "../index.html";
    }

    console.log("✅ Rol guard confirmado. Iniciando dashboard...");
    iniciarDashboardGuardia();

  } catch (e) {
    console.error("❌ Error leyendo/creando perfil:", e);
    alert("Error al cargar tu perfil. Por favor recarga la página.");
    auth.signOut().then(() => window.location.href = "../index.html");
  }
});

// ─── Inicializar Dashboard Guardia ─────────────────────────────────────────────
function iniciarDashboardGuardia() {
  console.log("🚀 iniciarDashboardGuardia");

  // Cerrar sesión
  document.getElementById("logoutBtn").addEventListener("click", () => {
    console.log("🔐 Logout solicitado");
    auth.signOut().then(() => {
      console.log("🔑 Sesión cerrada");
      window.location.href = "../index.html";
    });
  });

  // Activar QR
  if (document.getElementById("activarQRBtn")) {
    manejarQR();
  }

  // Cargar visitas y pagos
  if (document.getElementById("visitas-body")) {
    cargarVisitasPendientes();
  }
  if (document.getElementById("residents-body")) {
    cargarPagosResidentes();
  }

  // Botón Pagos (redirección)
  document.getElementById("pagosBtn")?.addEventListener("click", () => {
    window.location.href = "pagos.html";
  });
}

// ─── QR Scanner ────────────────────────────────────────────────────────────────
function manejarQR() {
  console.log("📥 manejarQR");
  const btn   = document.getElementById("activarQRBtn");
  const qrDiv = document.getElementById("qr-reader");
  let scanner = null;

  btn.addEventListener("click", () => {
    console.log("📷 QRBtn clicked, scanner =", scanner);
    if (scanner) {
      scanner.stop().then(() => scanner.clear()).then(() => {
        console.log("📷 QR Scanner detenido");
        qrDiv.innerHTML = "";
        qrDiv.style.display = "none";
        scanner = null;
      });
    } else {
      qrDiv.innerHTML = "";
      qrDiv.style.display = "block";
      scanner = new Html5Qrcode("qr-reader");
      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        decoded => {
          console.log("🔍 QR decodeado:", decoded);
          scanner.stop().then(() => scanner.clear()).then(() => {
            qrDiv.innerHTML = "";
            qrDiv.style.display = "none";
            scanner = null;
            procesarVisita(decoded.trim());
          });
        },
        err => console.warn("❌ QR Scan error:", err)
      ).catch(err => {
        console.error("❌ Error iniciando lector QR:", err);
        alert("No se pudo activar el lector QR: " + err.message);
      });
    }
  });
}

// ─── Cargar Visitas Pendientes ─────────────────────────────────────────────────
function cargarVisitasPendientes() {
  console.log("📥 cargarVisitasPendientes");
  const tbody  = document.getElementById("visitas-body");
  const cutoff = new Date(Date.now() - 24*60*60*1000);

  db.collection("visits")
    .where("createdAt", ">=", firebase.firestore.Timestamp.fromDate(cutoff))
    .orderBy("createdAt", "asc")
    .onSnapshot(snapshot => {
      console.log("📊 Snapshot visitas:", snapshot.size);
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;color:gray;">
              No hay visitas en las últimas 24 horas
            </td>
          </tr>`;
        return;
      }

      snapshot.forEach(doc => {
        const v    = doc.data();
        const hora = v.createdAt?.toDate().toLocaleString() || "–";
        const tr   = document.createElement("tr");
        tr.innerHTML = `
          <td>${v.visitorName || "–"}</td>
          <td>${v.vehicle?.marca   || ""}</td>
          <td>${v.vehicle?.color   || ""}</td>
          <td>${v.vehicle?.placa   || ""}</td>
          <td>${v.house            || ""}</td>
          <td>${v.block            || ""}</td>
          <td>${v.residentPhone    || ""}</td>
          <td class="guard-cell">${v.guardName || ""}</td>
          <td>${hora}</td>
          <td>${
            v.status === "pendiente"
              ? `<button onclick="procesarVisita('${doc.id}')">Registrar</button>`
              : "Ingresado"
          }</td>`;
        tbody.appendChild(tr);

        // rellenar nombre real del guardia
        if (!v.guardName && v.guardId) {
          db.collection("usuarios").doc(v.guardId).get().then(uSnap => {
            console.log("👮‍♂️ Fetch guard:", v.guardId, uSnap.exists);
            if (uSnap.exists) {
              tr.querySelector(".guard-cell").textContent = uSnap.data().nombre;
            }
          });
        }
      });
    }, err => {
      console.error("❌ Error cargando visitas:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;color:red;">
            Error cargando visitas. Consulta consola.
          </td>
        </tr>`;
    });
}

// ─── Procesar Visita ──────────────────────────────────────────────────────────
async function procesarVisita(visitaId) {
  console.log("▶️ procesarVisita", visitaId);
  try {
    const ref  = db.collection("visits").doc(visitaId);
    const snap = await ref.get();
    console.log("   existe?", snap.exists);
    if (!snap.exists) return alert("Visita no encontrada.");
    const v = snap.data();
    if (v.status === "ingresado") return alert("Ya fue ingresada.");

    const marca = prompt("Marca (opcional):") || null;
    const color = prompt("Color (opcional):")  || null;
    const placa = prompt("Placa (opcional):")  || null;

    const uid       = auth.currentUser.uid;
    const guardSnap = await db.collection("usuarios").doc(uid).get();
    const guardName = guardSnap.exists ? guardSnap.data().nombre : "Desconocido";

    await ref.update({
      status:      "ingresado",
      checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
      guardId:     uid,
      guardName,
      vehicle:     { marca, color, placa }
    });
    console.log("✅ Visita ingresada");
    alert("Ingreso registrado.");
  } catch (e) {
    console.error("❌ Error procesando visita:", e);
    alert("Error al registrar visita.");
  }
}

// ─── Cargar Pagos de Residentes ───────────────────────────────────────────────
function cargarPagosResidentes() {
  console.log("📥 cargarPagosResidentes");
  const tbody    = document.getElementById("residents-body");
  const buscador = document.getElementById("buscarResidente");
  let cache = [];

  const nombres = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  db.collection("usuarios")
    .where("rol", "==", "resident")
    .onSnapshot(snapshot => {
      console.log("📊 Snapshot residentes:", snapshot.size);
      cache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      render(cache, buscador.value);
    });

  buscador.addEventListener("input", e => render(cache, e.target.value));

  function render(list, filter) {
    const txt = filter.trim().toLowerCase();
    const filtered = list.filter(r =>
      (r.nombre    || "").toLowerCase().includes(txt) ||
      (r.correo    || "").toLowerCase().includes(txt) ||
      String(r.casa)  .includes(txt) ||
      String(r.bloque).includes(txt) ||
      (r.telefono  || "").includes(txt)
    );
    console.log(`🔍 Filtrando residentes con "${filter}":`, filtered.length);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay residentes</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(r => {
      const estado = r.estado_pago === "Pagado" ? "Pagado" : "Pendiente";
      return `
        <tr ${estado === "Pendiente" ? 'class="pendiente"' : ""}>
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
