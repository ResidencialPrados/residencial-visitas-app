const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

// Función para registrar nuevos residentes (solo admin)
exports.registerResident = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated','Debes iniciar sesión');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied','No tienes permiso');
  }
  const { email, password, name, house, block, phone } = data;
  if (!email||!password||!name||!house||!block||!phone) {
    throw new functions.https.HttpsError('invalid-argument','Faltan datos');
  }
  const userRecord = await admin.auth().createUser({ email, password, displayName: name });
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'resident' });
  await admin.firestore().collection('users').doc(userRecord.uid).set({
    role:'resident', name, email, house, block, phone,
    servicePaidUntil: null, paymentHistory: []
  });
  return { uid: userRecord.uid };
});

// Función para asignar admin a un guardia (solo otro admin)
exports.setAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated','Debes iniciar sesión');
  }
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied','No tienes permiso');
  }
  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument','Falta UID');
  }
  await admin.auth().setCustomUserClaims(uid, { role: 'guard', admin: true });
  return { result: `Usuario ${uid} es ahora guardia administrador` };
});
