// src/utils/academicMapping.js

export const ACADEMIC_CONFIG = {
  sedes: ['Sede Norte', 'Prado', 'Centroamérica', 'La Ceiba'],
  tipos: ['Aula', 'Laboratorio'],
};

export const academicSpaceMap = {
  // --- TGU (Jacaleapa / Edificios 01-07) ---
  '01/105': { name: 'Aula 105', sede: 'Sede Norte', tipo: 'Aula' },
  '06/301': { name: 'Lab de Redes 301', sede: 'Sede Norte', tipo: 'Laboratorio' },
  '07/EF1': { name: 'Lab Estructura y Función 01', sede: 'Sede Norte', tipo: 'Laboratorio' },
  
  // --- PRADO (PR) ---
  'PR/101': { name: 'Aula 101', sede: 'Prado', tipo: 'Aula' },
  'PR/L01': { name: 'Laboratorio 01', sede: 'Prado', tipo: 'Laboratorio' },
  
  // --- CENTROAMÉRICA (CA) ---
  'CA/201': { name: 'Aula 201', sede: 'Centroamérica', tipo: 'Aula' },
  'CA/203': { name: 'Lab de Redes', sede: 'Centroamérica', tipo: 'Laboratorio' },
};

// src/utils/academicMapping.js

export const FACULTIES_DATA = {
  "Facultad de Ingeniería": [
    "Ingeniería en Gestión Logística",
    "Ingeniería en Informática",
    "Técnico en Redes",
    "Ingeniería en Electrónica",
    "Ingeniería en Gestión de Ambiente y Des.",
    "Ingeniería Civil",
    "Ingeniería Industrial y de Sistemas"
  ],
  "Facultad de Ciencias Sociales": [
    "Licenciatura en Derecho",
    "Licenciatura en Psicología",
    "Licenciatura en Periodismo",
    "Ciencias Exactas",
    "Humanidades"
  ],
  "Facultad de Ciencias de la Salud": [
    "Licenciatura en Enfermería",
    "Licenciatura en Terapia Física y Ocupacional",
    "Técnico en Urgencias Médicas",
    "Técnico en Enfermería",
    "Nutrición"
  ],
  "Escuela de Arte y Diseño": [
    "Licenciatura en Diseño Grafico",
    "Técnico en Diseño Grafico",
    "Licenciatura en Animación Digital y Diseño Interactivo",
    "Técnico en Diseño y Desarrollo Web",
    "Diseño de Interiores"
  ],
  "Negocios": [
      "Licenciatura en Mercadotecnia",
      "Licenciatura en Administración de Empresas",
      "Licenciatura en Contaduría Publica",
      "Licenciatura en Recursos Humanos",
      "Ingeniería en Gestión Logística"
  ],
  "Gastronomía": ["Licenciatura en Gastronomía", "Técnico en Gastronomía"],
  "Otros": ["Innovación Educativa", "Vida Estudiantil", "Área de Acompañamiento", "Operaciones", "Admisiones"]
};

export const RESERVATION_TYPES = [
  "Taller Práctico",
  "Componente presencial",
  "Exámenes presenciales",
  "Teledocencia",
  "Reserva de alumno",
  "Reserva de personal administrativo (Reuniones)",
  "Terna para graduación",
  "Clase 100% presencial"
];