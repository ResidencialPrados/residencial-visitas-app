const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// ✅ Función para registrar nuevos residentes (solo guard_admin)
exports.registerResident = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    // Verificar rol en Firestore
    const uidSolicitante = context.auth.uid;
    const docSolicitante = await db.collection('usuarios').doc(uidSolicitante).get();
    if (!docSolicitante.exists || docSolicitante.data().rol !== 'guard_admin') {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permiso');
    }

    const { email, password, name, house, block, phone } = data;
    if (!email || !password || !name || !house || !block || !phone) {
        throw new functions.https.HttpsError('invalid-argument', 'Faltan datos');
    }

    try {
        // Crear usuario en Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name
        });

        // Crear documento en Firestore
        await db.collection('usuarios').doc(userRecord.uid).set({
            UID: userRecord.uid,
            role: 'resident',
            name,
            email,
            house,
            block,
            phone,
            servicePaidUntil: null,
            paymentHistory: [],
            fecha_creacion: admin.firestore.FieldValue.serverTimestamp()
        });

        return { uid: userRecord.uid, message: "Residente creado correctamente." };

    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('unknown', error.message);
    }
});

// ✅ Función para asignar rol de guard_admin a un guardia (solo guard_admin)
exports.setAdmin = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión');
    }

    const uidSolicitante = context.auth.uid;
    const docSolicitante = await db.collection('usuarios').doc(uidSolicitante).get();
    if (!docSolicitante.exists || docSolicitante.data().rol !== 'guard_admin') {
        throw new functions.https.HttpsError('permission-denied', 'No tienes permiso');
    }

    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta UID');
    }

    try {
        // Actualizar el rol en Firestore
        await db.collection('usuarios').doc(uid).update({
            rol: 'guard_admin'
        });

        return { result: `Usuario ${uid} ahora es guardia administrador.` };
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('unknown', error.message);
    }
});
