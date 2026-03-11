// src/components/RoomQRGenerator.js
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';

export default function RoomQRGenerator({ space }) {
  // Desestructuramos todos los datos que añadimos en la V2.3 y V2.4
  const { id, name, building, floor, capacity, type } = space;

  const generatePremiumPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = 216;
    const pageHeight = 279;

    // 1. MARCO EXTERIOR (Doble línea tecnológica)
    doc.setDrawColor(200, 16, 46); // Rojo Ceutec
    doc.setLineWidth(1.5);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10);
    doc.setLineWidth(0.5);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    // 2. ENCABEZADO DE IMPACTO
    doc.setFillColor(200, 16, 46);
    doc.rect(7, 7, pageWidth - 14, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("CEUTEC | UNITEC", pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("SISTEMA DE GESTIÓN DE ESPACIOS ACADÉMICOS", pageWidth / 2, 30, { align: "center" });
    doc.setFontSize(16);
    doc.text("FICHA OFICIAL DE ACCESO FÍSICO", pageWidth / 2, 42, { align: "center" });

    // 3. IDENTIFICACIÓN DEL SALÓN (El "BOOM" visual)
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.text("RECURSO ACADÉMICO:", pageWidth / 2, 65, { align: "center" });
    doc.setFontSize(45);
    doc.setFont("helvetica", "bold");
    doc.text(name.toUpperCase(), pageWidth / 2, 85, { align: "center" });

    // 4. CUADRÍCULA DE DATOS TÉCNICOS (Building, Floor, etc.)
    doc.setFillColor(248, 250, 252); // Gris muy claro
    doc.rect(15, 100, pageWidth - 30, 40, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, 100, pageWidth - 30, 40);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    
    // Etiquetas
    doc.text("UBICACIÓN / EDIFICIO", 25, 112);
    doc.text("NIVEL / PISO", 85, 112);
    doc.text("TIPO DE RECURSO", 135, 112);
    doc.text("CAPACIDAD MAX.", 175, 112);

    // Valores
    doc.setTextColor(200, 16, 46);
    doc.setFontSize(14);
    doc.text(building || "N/A", 25, 122);
    doc.text(floor || "0", 85, 122);
    doc.text(type || "AULA", 135, 122);
    doc.text(`${capacity || "0"} PERS.`, 175, 122);

    // 5. SECCIÓN DEL QR (El sensor principal)
    const canvas = document.getElementById(id);
    const qrImage = canvas.toDataURL("image/png");
    
    // Sombra decorativa para el QR
    doc.setFillColor(241, 245, 249);
    doc.circle(pageWidth / 2, 195, 55, 'F');
    
    // Imagen del QR
    doc.addImage(qrImage, 'PNG', (pageWidth / 2) - 45, 150, 90, 90);

    // 6. INSTRUCCIONES OPERATIVAS
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("INSTRUCCIONES DE ACCESO", pageWidth / 2, 245, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("1. Abra el portal CeuSpaces en su móvil.", pageWidth / 2, 252, { align: "center" });
    doc.text("2. Escanee este código QR para validar su presencia.", pageWidth / 2, 258, { align: "center" });
    doc.text("3. El sistema registrará su asistencia y activará los recursos.", pageWidth / 2, 264, { align: "center" });

    // 7. PIE DE PÁGINA (Seguridad)
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const dateGen = new Date().toLocaleString();
    doc.text(`CÓDIGO DE SENSOR ÚNICO: ${id}  |  GENERADO: ${dateGen}  |  VERSION 2.4 BLINDADA`, pageWidth / 2, 275, { align: "center" });

    // Descargar
    doc.save(`FICHA_QR_${name.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '20px', display: 'inline-block' }}>
        <QRCodeCanvas id={id} value={id} size={180} level={"H"} includeMargin={true} />
      </div>
      <div style={{ marginTop: '25px' }}>
        <button onClick={generatePremiumPDF} className="btn-save-pro" style={{ background: '#c8102e', padding: '15px 30px', fontSize: '1.1rem' }}>
          🚀 DESCARGAR FICHA TÉCNICA (PDF)
        </button>
      </div>
    </div>
  );
}