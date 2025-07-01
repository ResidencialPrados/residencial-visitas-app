const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

// 1) Función para registrar nuevos residentes (solo admin)
exports.registerResident = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated',
      'Debes iniciar sesión para usar esta función');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied',
      'No tienes permiso de administrador');
  }
  const { email, password, name, house, block, phone } = data;
  if (!email || !password || !name || !house || !block || !phone) {
    throw new functions.https.HttpsError('invalid-argument',
      'Faltan datos obligatorios');
  }
  // 1. Crea la cuenta en Auth
  const userRecord = await admin.auth().createUser({ email, password, displayName: name });
  // 2. Asigna custom claims para rol “resident”
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'resident' });
  // 3. Crea el documento en Firestore /users
  await admin.firestore().collection('users').doc(userRecord.uid).set({
    role: 'resident',
    name,
    email,
    house,
    block,
    phone,
    servicePaidUntil: null,
    paymentHistory: []
  });
  return { uid: userRecord.uid };
});

// 2) Función para asignar el claim “admin” a un guardia (solo otro admin)
exports.setAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'No eres administrador');
  }
  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta el UID del guardia');
  }
  await admin.auth().setCustomUserClaims(uid, { role: 'guard', admin: true });
  return { result: `El usuario ${uid} ahora es guardia administrador` };
});
