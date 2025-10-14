// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializar la app de Admin de Firebase
admin.initializeApp();
const db = admin.firestore();

// Configurar el transportador de correo usando las variables de entorno de Firebase
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: functions.config().gmail.email,
    pass: functions.config().gmail.password,
  },
});

// --- LA FUNCIÓN PRINCIPAL ---
// Se dispara cada vez que se crea un nuevo documento en la colección 'reservations'
exports.sendReservationEmail = functions.firestore
    .document("reservations/{reservationId}")
    .onCreate(async (snap, context) => {
      const reservationData = snap.data();

      // Construir la URL base de tu aplicación
      const appUrl = "https://ceutec-lab-manager.web.app/reservas"; // <-- IMPORTANTE: Cambia esto por la URL de tu app
      const reservationLink = `${appUrl}?labId=${reservationData.labId}`;

      // 1. OBTENER LA LISTA DE ADMINISTRADORES
      const admins = [];
      const adminQuery = await db.collection("users")
          .where("role", "==", "admin").get();
      adminQuery.forEach((doc) => {
        admins.push(doc.data().email);
      });

      // 2. PREPARAR CORREO PARA EL DOCENTE
      const teacherMailOptions = {
        from: `Portal de Laboratorios Ceutec <${functions.config().gmail.email}>`,
        to: reservationData.userEmail,
        subject: "Confirmación de Reserva de Laboratorio",
        html: `
          <h1>¡Tu reserva ha sido confirmada!</h1>
          <p>Hola,</p>
          <p>Has reservado exitosamente el siguiente espacio:</p>
          <ul>
            <li><strong>Laboratorio:</strong> ${reservationData.labName}</li>
            <li><strong>Motivo:</strong> ${reservationData.purpose}</li>
            <li><strong>Fecha:</strong> ${reservationData.startTime.toDate().toLocaleDateString("es-ES")}</li>
            <li><strong>Hora:</strong> ${reservationData.startTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})} - ${reservationData.endTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})}</li>
          </ul>
          <p>Puedes ver todas las reservas para este laboratorio aquí:</p>
          <a href="${reservationLink}">Ver Calendario del Laboratorio</a>
        `,
      };

      // 3. PREPARAR CORREO PARA LOS ADMINISTRADORES
      const adminMailOptions = {
        from: `Notificaciones del Portal <${functions.config().gmail.email}>`,
        to: admins.join(", "), // Enviar a todos los admins
        subject: `Nueva Reserva: ${reservationData.labName}`,
        html: `
          <h1>Nueva Reserva Realizada</h1>
          <p>El docente <strong>${reservationData.userEmail}</strong> ha realizado una nueva reserva.</p>
          <ul>
            <li><strong>Laboratorio:</strong> ${reservationData.labName}</li>
            <li><strong>Motivo:</strong> ${reservationData.purpose}</li>
            <li><strong>Fecha:</strong> ${reservationData.startTime.toDate().toLocaleDateString("es-ES")}</li>
            <li><strong>Hora:</strong> ${reservationData.startTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})} - ${reservationData.endTime.toDate().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"})}</li>
          </ul>
          <p>Puedes ver la reserva en el calendario general aquí:</p>
          <a href="${reservationLink}">Ver Calendario del Laboratorio</a>
        `,
      };

      // 4. ENVIAR LOS CORREOS
      try {
        await transporter.sendMail(teacherMailOptions);
        console.log("Correo de confirmación enviado a:", reservationData.userEmail);
        
        if (admins.length > 0) {
          await transporter.sendMail(adminMailOptions);
          console.log("Correo de notificación enviado a los administradores.");
        }
        
        return null;
      } catch (error) {
        console.error("Error al enviar correos:", error);
        return null;
      }
    });