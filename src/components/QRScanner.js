// src/components/QRScanner.js
import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import './styles/QRScanner.css';

export default function QRScanner({ onScanSuccess, onScanError, targetRoomName }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    }, false);

    scanner.render(onScanSuccess, onScanError);

    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner", error));
    };
  }, [onScanSuccess, onScanError]);

  return (
    <div className="qr-scanner-wrapper">
      <div className="scanner-instruction">
        <p>Escanea el código QR ubicado en la entrada de:</p>
        <h2 className="target-room-highlight">{targetRoomName}</h2>
      </div>
      <div id="reader"></div>
    </div>
  );
}