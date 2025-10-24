// functions/index.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializar la app de Admin de Firebase a nivel global
admin.initializeApp();
const db = admin.firestore();

// --- SOLUCIÓN: Declaramos la variable transporter aquí, pero no la inicializamos ---
let transporter;

// Esta función se dispara cada vez que se crea un nuevo documento en la colección 'reservations'
exports.sendReservationEmail = onDocumentCreated("reservations/{reservationId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.log("No data associated with the event");
    return;
  }
  const reservationData = snap.data();
  const reservationId = event.params.reservationId;

  // --- SOLUCIÓN: Inicializamos el transporter DENTRO de la función, solo si es necesario ---
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_PASSWORD,
      },
    });
  }

  // --- ¡IMPORTANTE! Reemplaza esto con la URL de tu aplicación en Vercel ---
  const appUrl = "https://ceutec-lab-manager.vercel.app";
  const reservationLink = `${appUrl}/reservas?eventId=${reservationId}`;

  // 1. OBTENER LA LISTA DE ADMINISTRADORES
  const admins = [];
  try {
    const adminQuery = await db.collection("users").where("role", "==", "admin").get();
    adminQuery.forEach((doc) => {
      admins.push(doc.data().email);
    });
  } catch (error) {
    logger.error("Error getting admin users:", error);
    return;
  }
  
  // 2. PREPARAR CORREO PARA EL DOCENTE
  const teacherMailOptions = {
    from: `Portal de Laboratorios Ceutec <${process.env.GMAIL_EMAIL}>`,
    to: reservationData.userEmail,
    subject: "Confirmación de Reserva de Laboratorio",
    html: `
      <h1>¡Tu reserva ha sido confirmada!</h1>
      <p>Has reservado exitosamente el siguiente espacio:</p>
      <ul>
        <li><strong>Laboratorio:</strong> ${reservationData.labName}</li>
        <li><strong>Motivo:</strong> ${reservationData.purpose}</li>
        <li><strong>Fecha:</strong> ${reservationData.startTime.toDate().toLocaleDateString("es-ES")}</li>
        <li><strong>Hora:</strong> ${reservationData.startTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})} - ${reservationData.endTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})}</li>
      </ul>
      <p>Puedes ver los detalles de tu reserva haciendo clic en el siguiente enlace:</p>
      <a href="${reservationLink}" style="padding: 10px 15px; background-color: #c8102e; color: white; text-decoration: none; border-radius: 5px;">Ver Detalles de la Reserva</a>
    `,
  };

  // 3. PREPARAR CORREO PARA LOS ADMINISTRADORES
  const adminMailOptions = {
    from: `Notificaciones del Portal <${process.env.GMAIL_EMAIL}>`,
    to: admins.join(", "),
    subject: `Nueva Reserva: ${reservationData.labName}`,
    html: `
      <h1>Nueva Reserva Realizada</h1>
      <p>El docente <strong>${reservationData.userEmail}</strong> ha realizado una nueva reserva.</p>
      <ul>
        <li><strong>Laboratorio:</strong> ${reservationData.labName}</li>
        <li><strong>Motivo:</strong> ${reservationData.purpose}</li>
      </ul>
      <p>Puedes ver los detalles de la reserva en la aplicación:</p>
      <a href="${reservationLink}" style="padding: 10px 15px; background-color: #c8102e; color: white; text-decoration: none; border-radius: 5px;">Ver Reserva</a>
    `,
  };

  // 4. ENVIAR LOS CORREOS
  try {
    await transporter.sendMail(teacherMailOptions);
    logger.log("Correo de confirmación enviado a:", reservationData.userEmail);
    if (admins.length > 0) {
      await transporter.sendMail(adminMailOptions);
      logger.log("Correo de notificación enviado a los administradores.");
    }
  } catch (error) {
    logger.error("Error al enviar correos:", error);
  }
});