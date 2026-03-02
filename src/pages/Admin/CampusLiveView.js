// src/pages/Admin/CampusLiveView.js
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useSearchParams, Link } from 'react-router-dom';
import { format, isWithinInterval, isAfter, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import '../styles/CampusLiveView.css';

export default function CampusLiveView() {
  const [searchParams] = useSearchParams();
  const currentSede = searchParams.get('sede') || "";
  const [spaces, setSpaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentSede) return;
    const searchTarget = currentSede.toLowerCase().replace('ceutec', '').replace(/[()]/g, '').trim();

    const unsubSpaces = onSnapshot(collection(db, 'spaces'), (snap) => {
      setSpaces(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(s => {
          const sSede = (s.sede || s.campus || "").toLowerCase();
          return sSede.includes(searchTarget) || searchTarget.includes(sSede);
        }));
    });

    const unsubRes = onSnapshot(collection(db, 'reservations'), (snap) => {
      const hoyI = startOfDay(new Date());
      const hoyF = endOfDay(new Date());
      setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
          const rSede = (r.sede || "").toLowerCase();
          const rFecha = r.startTime.toDate();
          return (rSede.includes(searchTarget) || searchTarget.includes(rSede)) && (rFecha >= hoyI && rFecha <= hoyF);
        }));
    });
    return () => { unsubSpaces(); unsubRes(); };
  }, [currentSede]);

  const liveStatus = useMemo(() => {
    return spaces.map(space => {
      const todayRes = reservations.filter(res => res.labId === space.id && !res.fulfillmentStatus.includes('Completada')).sort((a, b) => a.startTime - b.startTime);
      const currentRes = todayRes.find(res => isWithinInterval(now, { start: res.startTime.toDate(), end: res.endTime.toDate() }));
      const nextRes = todayRes.filter(res => isAfter(res.startTime.toDate(), now) && res.id !== currentRes?.id);

      let visualState = 'free';
      if (space.status === 'En Mantenimiento') visualState = 'maint';
      else if (currentRes) {
        if (currentRes.checkInTime) visualState = 'active';
        else visualState = ((now - currentRes.startTime.toDate()) / 60000) > 15 ? 'late' : 'waiting';
      }
      return { ...space, currentRes, nextRes, visualState };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
  }, [spaces, reservations, now]);

  return (
    <div className="dashboard-wrapper">
      <div className="radar-container-glass fade-in">
        <header className="radar-header-pro">
          <div className="radar-title-area">
            <Link to={`/dashboard?sede=${currentSede}`} className="back-link-radar">← Dashboard</Link>
            <h1>Radar de Operaciones: <span className="red-text">{currentSede}</span></h1>
          </div>
          <div className="radar-clock-box">
             <div className="digital-time">{format(now, "HH:mm:ss")}</div>
             <div className="digital-date">{format(now, "dd MMM yyyy")}</div>
          </div>
        </header>

        <div className="radar-grid-layout">
          {liveStatus.map(item => (
            <div key={item.id} className={`radar-card-pro ${item.visualState}`}>
              <div className="card-top-pro">
                <span className="tag-type">{item.type}</span>
                <span className="tag-cap">👥 {item.capacity}</span>
              </div>
              <h2 className="room-name-pro">{item.name}</h2>
              <div className="card-status-info">
                {item.visualState === 'free' && <div className="msg-free">✅ DISPONIBLE</div>}
                {item.currentRes && (
                  <div className="active-res-box">
                    <div className={`type-badge-mini ${item.currentRes.reservationType}`}>
                      {item.currentRes.reservationType === 'academic_load' ? '📚 CARGA ACADÉMICA' : '👤 MANUAL'}
                    </div>
                    <p className="c-name">{item.currentRes.className}</p>
                    <p className="d-name">Docente: {item.currentRes.userName}</p>
                    <p className="t-range">{format(item.currentRes.startTime.toDate(), 'HH:mm')} - {format(item.currentRes.endTime.toDate(), 'HH:mm')}</p>
                    {item.visualState === 'late' && <div className="late-warning">⚠️ DOCENTE TARDE</div>}
                  </div>
                )}
              </div>
              <div className="upcoming-list-pro">
                <p className="upcoming-label">SIGUIENTES HOY:</p>
                {item.nextRes.slice(0, 2).map((res, i) => (
                  <div key={i} className="next-item">
                    <span className="n-time">{format(res.startTime.toDate(), 'HH:mm')}</span>
                    <span className="n-title">{res.className}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}