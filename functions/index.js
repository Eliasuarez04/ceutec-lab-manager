// functions/index.js
const { 
  onDocumentCreated, 
  onDocumentUpdated, 
  onDocumentDeleted 
} = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

let transporter;

const initializeTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_PASSWORD,
      },
    });
  }
};

// --- FUNCIÓN 1: CORREO DE NUEVA RESERVA ---
exports.sendReservationEmail = onDocumentCreated(
  { document: "reservations/{reservationId}", region: "us-central1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const res = snap.data();

    initializeTransporter();

    const appUrl = "https://ceutec-lab-manager.vercel.app";
    const sedeEncoded = encodeURIComponent(res.sede || "");
    const reservationLink = `${appUrl}/mis-reservas?sede=${sedeEncoded}`;

    const formatHN = (date) => {
      const hnDate = new Date(date.getTime() - (6 * 60 * 60 * 1000));
      const dia = hnDate.getUTCDate().toString().padStart(2, '0');
      const mes = (hnDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const anio = hnDate.getUTCFullYear();
      const hora = hnDate.getUTCHours().toString().padStart(2, '0');
      const min = hnDate.getUTCMinutes().toString().padStart(2, '0');
      return { fecha: `${dia}/${mes}/${anio}`, hora: `${hora}:${min}` };
    };

    const start = formatHN(res.startTime.toDate());
    const end = formatHN(res.endTime.toDate());

    if (res.userEmail && res.userEmail !== 'Carga Académica') {
      const teacherMailOptions = {
        from: `Portal Ceutec SpaceOne <${process.env.GMAIL_EMAIL}>`,
        to: res.userEmail,
        subject: "Confirmación de Reserva - Ceutec SpaceOne",
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; border: 1px solid #ddd; border-radius: 12px; padding: 25px;">
            <h2 style="color: #c8102e; border-bottom: 2px solid #c8102e; padding-bottom: 10px;">¡Reserva Confirmada!</h2>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Espacio:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${res.labName}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Materia:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${res.className || res.purpose}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Docente:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${res.userName}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Sección / TH:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">Sec: ${res.section || 'N/A'} | TH: ${res.th || 'N/A'}</td></tr>
              <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Estudiantes:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${res.attendees || '0'}</td></tr>
              <tr style="background-color: #fff5f5;">
                <td style="padding: 10px; font-weight: bold; color: #c8102e;">Fecha:</td><td style="padding: 10px; font-weight: bold;">${start.fecha}</td>
              </tr>
              <tr style="background-color: #fff5f5;">
                <td style="padding: 10px; font-weight: bold; color: #c8102e;">Horario:</td><td style="padding: 10px; font-weight: bold;">${start.hora} - ${end.hora}</td>
              </tr>
            </table>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${reservationLink}" style="background-color: #c8102e; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Mis Reservas</a>
            </div>
          </div>
        `,
      };
      await transporter.sendMail(teacherMailOptions);
    }
  }
);

// --- FUNCIÓN 2: CORREO CUANDO SE EDITA/MODIFICA ---
exports.onReservationUpdated = onDocumentUpdated(
  { document: "reservations/{reservationId}", region: "us-central1" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    initializeTransporter();

    const formatHNTime = (ts) => {
      const date = ts.toDate();
      const hnDate = new Date(date.getTime() - (6 * 60 * 60 * 1000));
      return hnDate.getUTCHours().toString().padStart(2, '0') + ":" + hnDate.getUTCMinutes().toString().padStart(2, '0');
    };

    // Buscamos coordinadores de laboratorios
    const coords = [];
    const coordSnap = await db.collection("users").where("role", "==", "coord_labs").get();
    coordSnap.forEach(doc => coords.push(doc.data().email));

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 25px; border-radius: 12px;">
        <h2 style="color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px;">Reserva Modificada</h2>
        <p>Se han actualizado los detalles de la reserva en: <b>${after.labName}</b></p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8f9fa;">
            <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Campo</th>
            <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left;">Antes</th>
            <th style="padding: 10px; border: 1px solid #dee2e6; text-align: left; color: #d9534f;">Ahora</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><b>Materia/Clase</b></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${before.className || before.purpose}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${after.className || after.purpose}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><b>Horario</b></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${formatHNTime(before.startTime)} - ${formatHNTime(before.endTime)}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${formatHNTime(after.startTime)} - ${formatHNTime(after.endTime)}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #dee2e6;"><b>Alumnos</b></td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${before.attendees || 0}</td>
            <td style="padding: 10px; border: 1px solid #dee2e6;">${after.attendees || 0}</td>
          </tr>
        </table>
        <p style="font-size: 0.9rem; color: #666;">Docente: ${after.userName} (${after.userEmail})</p>
      </div>
    `;

    const mailOptions = {
      from: `Portal SpaceOne <${process.env.GMAIL_EMAIL}>`,
      to: [after.userEmail, ...coords].join(", "),
      subject: `🔄 Reserva Modificada: ${after.labName}`,
      html: htmlContent
    };
    await transporter.sendMail(mailOptions);
  }
);

// --- FUNCIÓN 3: CORREO CUANDO SE CANCELA/ELIMINA ---
exports.onReservationDeleted = onDocumentDeleted(
  { document: "reservations/{reservationId}", region: "us-central1" },
  async (event) => {
    const deletedData = event.data.data();
    initializeTransporter();

    const coords = [];
    const coordSnap = await db.collection("users").where("role", "==", "coord_labs").get();
    coordSnap.forEach(doc => coords.push(doc.data().email));

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; border: 2px solid #c8102e; padding: 25px; border-radius: 12px;">
        <h2 style="color: #c8102e; border-bottom: 2px solid #c8102e; padding-bottom: 10px;">Reserva Cancelada</h2>
        <p>Se ha eliminado la reserva para el espacio académico:</p>
        <ul style="line-height: 2;">
          <li><b>Espacio:</b> ${deletedData.labName}</li>
          <li><b>Materia/Clase:</b> ${deletedData.className || deletedData.purpose}</li>
          <li><b>Docente:</b> ${deletedData.userName} (${deletedData.userEmail})</li>
        </ul>
        <p style="color: #d9534f; font-weight: bold; margin-top: 20px;">El espacio ha sido liberado en el calendario.</p>
      </div>
    `;

    const mailOptions = {
      from: `Portal SpaceOne <${process.env.GMAIL_EMAIL}>`,
      to: [deletedData.userEmail, ...coords].join(", "),
      subject: `❌ Reserva Cancelada: ${deletedData.labName}`,
      html: htmlContent
    };
    await transporter.sendMail(mailOptions);
  }
);

// --- FUNCIÓN 4: STOCK DE INVENTARIO ---
exports.checkStockLevels = onDocumentUpdated(
  { document: "spaces/{labId}/equipment/{equipmentId}", region: "us-central1" },
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const stockThreshold = afterData.stockThreshold;
    if (!stockThreshold || stockThreshold <= 0) return;

    if (beforeData.quantity > stockThreshold && afterData.quantity <= stockThreshold) {
      initializeTransporter();
      const admins = [];
      const adminQuery = await db.collection("users").where("role", "==", "superadmin").get();
      adminQuery.forEach(doc => admins.push(doc.data().email));

      if (admins.length > 0) {
        const mailOptions = {
          from: `Alertas SpaceOne <${process.env.GMAIL_EMAIL}>`,
          to: admins.join(", "),
          subject: `⚠️ Stock Bajo: ${afterData.name}`,
          html: `<h3>Alerta de Inventario</h3><p>El ítem <b>${afterData.name}</b> está bajo el umbral en ${afterData.labName}.</p>`
        };
        await transporter.sendMail(mailOptions);
      }
    }
  }
);