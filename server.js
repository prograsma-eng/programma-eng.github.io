const express = require('express');
const { Webhook } = require('svix');
const admin = require('firebase-admin');

// 1. Configuración de Firebase segura
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// 2. Ruta para recibir el aviso de Clerk
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const payload = req.body.toString();
  const headers = req.headers;
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

  let evt;
  try {
    evt = wh.verify(payload, headers);
  } catch (err) {
    return res.status(400).send("Fallo en la verificación");
  }

  // 3. Si el usuario se borra, lo eliminamos de Firebase
  if (evt.type === 'user.deleted') {
    const userId = evt.data.id; // ID de Clerk
    console.log(`Eliminando datos del usuario: ${userId}`);
    
    // Cambia 'usuarios' por el nombre de tu colección en Firebase
    await db.collection('usuarios').doc(userId).delete();
  }

  res.status(200).json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));