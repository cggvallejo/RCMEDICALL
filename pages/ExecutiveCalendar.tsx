import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Doctor, Visit, User, TimeOffEvent } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  X, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  MapPin,
  CalendarDays
} from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { es } from 'date-fns/locale';

registerLocale('es', es);

interface ExecutiveCalendarProps {
  doctors: Doctor[];
  onUpdateDoctors: (doctors: Doctor[]) => void;
  onDeleteVisit: (doctorId: string, visitId: string) => void;
  user: User;
}

type ViewMode = 'month' | 'week' | 'day';

const ExecutiveCalendar: React.FC<ExecutiveCalendarProps> = ({ doctors, onUpdateDoctors, onDeleteVisit, user }) => {
  const location = useLocation();
  const [selectedExecutive, setSelectedExecutive] = useState(user.role === 'executive' ? user.name : '');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isDragging, setIsDragging] = useState(false);

  // Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAppointmentMode, setIsAppointmentMode] = useState(false); 
  const [planDate, setPlanDate] = useState<Date>(new Date());
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [searchDoctorTerm, setSearchDoctorTerm] = useState('');
  const [planObjective, setPlanObjective] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('09:00');

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedVisitToReport, setSelectedVisitToReport] = useState<{docId: string, visit: Visit} | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [reportOutcome, setReportOutcome] = useState('SEGUIMIENTO');
  const [reportDate, setReportDate] = useState('');
  const [reportTime, setReportTime] = useState(''); 
  const [reportFollowUp, setReportFollowUp] = useState('');

  const visitTimeSlots = useMemo(() => {
      const slots = [];
      for (let hour = 9; hour <= 20; hour++) {
          slots.push(`${hour.toString().padStart(2, '0')}:00`);
          slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
      return slots;
  }, []);
  
  const executives = useMemo(() => Array.from(new Set(doctors.map(d => d.executive))).sort(), [doctors]);

  useEffect(() => {
      if (user.role === 'executive') {
          setSelectedExecutive(user.name);
      } else {
          const params = new URLSearchParams(location.search);
          const execParam = params.get('exec');
          if (execParam) setSelectedExecutive(execParam);
          else if (!selectedExecutive && executives.length > 0) setSelectedExecutive(executives[0]);
      }
  }, [location, executives, selectedExecutive, user]);

  const toLocalDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  const myDoctors = useMemo(() => doctors.filter(d => d.executive === selectedExecutive), [doctors, selectedExecutive]);

  const eventsMap = useMemo(() => {
      const map = new Map<string, { docId: string, docName: string, visit: Visit }[]>();
      myDoctors.forEach(doc => {
          (doc.visits || []).forEach(visit => {
              if (visit.date) {
                  if (!map.has(visit.date)) map.set(visit.date, []);
                  map.get(visit.date)!.push({ docId: doc.id, docName: doc.name, visit });
              }
          });
      });
      return map;
  }, [myDoctors]);

  const calendarDays = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      if (viewMode === 'month') {
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const days: (Date | null)[] = [];
          for (let i = 0; i < firstDay; i++) days.push(null);
          for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
          while (days.length < 42) days.push(null);
          return days;
      } else if (viewMode === 'week') {
          const start = new Date(currentDate);
          start.setDate(currentDate.getDate() - currentDate.getDay());
          return Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(start);
              d.setDate(start.getDate() + i);
              return d;
          });
      }
      return [new Date(currentDate)];
  }, [currentDate, viewMode]);

  const savePlan = () => {
      if (!selectedDoctorId) return alert("Selecciona un contacto.");
      const dateStr = toLocalDateString(planDate);
      const updatedDoctors = doctors.map(doc => {
          if (doc.id === selectedDoctorId) {
              const newVisit: Visit = {
                  id: Date.now().toString(),
                  date: dateStr,
                  time: appointmentTime,
                  note: isAppointmentMode ? 'CITA PROGRAMADA' : 'VISITA PLANEADA',
                  objective: planObjective.toUpperCase() || 'VISITA',
                  outcome: isAppointmentMode ? 'CITA' : 'PLANEADA',
                  status: 'planned'
              };
              return { ...doc, visits: [...(doc.visits || []), newVisit] };
          }
          return doc;
      });
      onUpdateDoctors(updatedDoctors);
      setIsModalOpen(false);
      setSearchDoctorTerm('');
      setSelectedDoctorId('');
  };

  const openReportModal = (docId: string, visit: Visit) => {
      setSelectedVisitToReport({ docId, visit });
      setReportNote(visit.note === 'VISITA PLANEADA' || visit.note === 'CITA PROGRAMADA' ? '' : visit.note);
      setReportOutcome(visit.outcome === 'PLANEADA' || visit.outcome === 'CITA' ? 'SEGUIMIENTO' : visit.outcome);
      setReportDate(visit.date);
      setReportTime(visit.time || '09:00');
      setReportModalOpen(true);
  };

  const saveReport = () => {
      if (!selectedVisitToReport || !reportNote.trim()) return alert("Completa el reporte.");
      const updatedDoctors = doctors.map(doc => {
          if (doc.id === selectedVisitToReport.docId) {
              const updatedVisits = doc.visits.map(v => 
                  v.id === selectedVisitToReport.visit.id 
                  ? { ...v, note: reportNote.toUpperCase(), outcome: reportOutcome as any, status: 'completed' as const, date: reportDate, time: reportTime, followUp: reportFollowUp.toUpperCase() } 
                  : v
              );
              return { ...doc, visits: updatedVisits };
          }
          return doc;
      });
      onUpdateDoctors(updatedDoctors);
      setReportModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER ELITE */}
      <div className="bg-[#0a1120] p-8 rounded-[3rem] shadow-2xl border border-white/5 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                  <CalendarDays size={32} />
              </div>
              <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Planificación</h1>
                  <p className="text-blue-400 text-[10px] font-black tracking-widest uppercase mt-1">Gesti&oacute;n de Ruta: {selectedExecutive}</p>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
              <div className="bg-white/5 p-1 rounded-2xl flex border border-white/10">
                  {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                      <button key={mode} onClick={() => setViewMode(mode)} className={`px-6 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${viewMode === mode ? 'bg-[#0085ff] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                          {mode === 'month' ? 'Mes' : mode === 'week' ? 'Semana' : 'Día'}
                      </button>
                  ))}
              </div>
              
              <div 
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    if (data.docId && data.visitId && confirm("¿Eliminar visita?")) onDeleteVisit(data.docId, data.visitId);
                  }}
                  className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-slate-500 hover:text-rose-500 transition-all cursor-pointer group"
              >
                  <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
              </div>

              {user.role === 'admin' && (
                  <select value={selectedExecutive} onChange={e => setSelectedExecutive(e.target.value)} className="bg-white/10 text-white text-[10px] font-black uppercase px-6 py-4 rounded-2xl outline-none border border-white/10 focus:border-blue-500">
                      {executives.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
              )}
          </div>
      </div>

      {/* CALENDARIO BODY */}
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[700px]">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <button onClick={() => {
                  const d = new Date(currentDate);
                  if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
                  else if (viewMode === 'week') d.setDate(d.getDate() - 7);
                  else d.setDate(d.getDate() - 1);
                  setCurrentDate(d);
              }} className="p-4 bg-white rounded-2xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronLeft /></button>
              
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                  {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', ...(viewMode === 'day' && { day: 'numeric' }) })}
              </h2>

              <button onClick={() => {
                  const d = new Date(currentDate);
                  if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
                  else if (viewMode === 'week') d.setDate(d.getDate() + 7);
                  else d.setDate(d.getDate() + 1);
                  setCurrentDate(d);
              }} className="p-4 bg-white rounded-2xl shadow-sm text-slate-600 hover:text-blue-600 transition-all"><ChevronRight /></button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
              {viewMode !== 'day' ? (
                  <div className="flex flex-col h-full">
                      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                              <div key={d} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
                          ))}
                      </div>
                      <div className="grid grid-cols-7 auto-rows-fr flex-1">
                          {calendarDays.map((day, idx) => {
                              const dateStr = day ? toLocalDateString(day) : '';
                              const events = day ? (eventsMap.get(dateStr) || []) : [];
                              const isToday = day && new Date().toDateString() === day.toDateString();

                              return (
                                  <div key={idx} onClick={() => day && (setPlanDate(day), setIsModalOpen(true))} className={`min-h-[120px] p-3 border-b border-r border-slate-50 transition-colors cursor-pointer group hover:bg-blue-50/20 relative ${!day ? 'bg-slate-50/30' : ''} ${isToday ? 'bg-blue-50/10' : ''}`}>
                                      {day && (
                                          <>
                                              <div className="flex justify-between items-start mb-2">
                                                  <span className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl ${isToday ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 group-hover:text-blue-500'}`}>{day.getDate()}</span>
                                                  <Plus size={14} className="opacity-0 group-hover:opacity-100 text-blue-300 transition-opacity" />
                                              </div>
                                              <div className="space-y-1">
                                                  {events.map((evt, i) => (
                                                      <div 
                                                        key={i} 
                                                        draggable 
                                                        onDragStart={e => e.dataTransfer.setData("text/plain", JSON.stringify({ docId: evt.docId, visitId: evt.visit.id }))}
                                                        onClick={e => { e.stopPropagation(); openReportModal(evt.docId, evt.visit); }}
                                                        className={`px-2 py-1.5 rounded-lg text-[8px] font-black uppercase truncate shadow-sm border transition-all hover:scale-105 ${evt.visit.status === 'completed' ? 'bg-emerald-500 text-white border-transparent' : 'bg-blue-600 text-white border-transparent'}`}
                                                      >
                                                          {evt.visit.time && <span className="mr-1 opacity-70">{evt.visit.time}</span>}
                                                          {evt.docName}
                                                      </div>
                                                  ))}
                                              </div>
                                          </>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              ) : (
                  <div className="p-8 lg:p-12 space-y-4">
                      {visitTimeSlots.map(time => {
                          const dateStr = toLocalDateString(currentDate);
                          const events = (eventsMap.get(dateStr) || []).filter(e => e.visit.time === time);
                          return (
                              <div key={time} className="flex gap-8 group">
                                  <div className="w-20 pt-2 text-right"><span className="text-[10px] font-black text-slate-300 group-hover:text-blue-500 transition-colors uppercase">{time}</span></div>
                                  <div onClick={() => { setPlanDate(currentDate); setAppointmentTime(time); setIsModalOpen(true); }} className="flex-1 min-h-[90px] border-l-2 border-slate-100 pl-8 pb-8 relative hover:border-blue-400 cursor-pointer">
                                      {events.length > 0 ? (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {events.map((evt, i) => (
                                                  <div key={i} onClick={e => { e.stopPropagation(); openReportModal(evt.docId, evt.visit); }} className={`p-5 rounded-[2rem] shadow-lg border-2 transition-all hover:-translate-y-1 flex justify-between items-center ${evt.visit.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-[#0085ff] border-blue-400 text-white shadow-blue-500/20'}`}>
                                                      <div><p className="text-xs font-black uppercase tracking-tight">{evt.docName}</p><p className="text-[10px] font-bold opacity-70 uppercase mt-1 tracking-widest">{evt.visit.objective}</p></div>
                                                      {evt.visit.status === 'completed' && <CheckCircle2 size={20} className="text-emerald-500" />}
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <div className="h-full flex items-center opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black text-blue-400 uppercase tracking-widest gap-2"><Plus size={16} /> Planificar aquí</div>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>

      {/* MODAL PLANIFICACIÓN */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
                  <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Planificar Ruta</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"><X size={24}/></button>
                  </div>
                  <div className="p-10 space-y-6">
                      <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                          <button onClick={() => setIsAppointmentMode(false)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${!isAppointmentMode ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500'}`}>Visita Rutina</button>
                          <button onClick={() => setIsAppointmentMode(true)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${isAppointmentMode ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}>Cita Agenda</button>
                      </div>
                      <div className="space-y-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Buscar Médico</label>
                              <div className="relative">
                                  <Search className="absolute left-4 top-4.5 h-5 w-5 text-slate-300" />
                                  <input type="text" placeholder="NOMBRE..." value={searchDoctorTerm} onChange={e => setSearchDoctorTerm(e.target.value.toUpperCase())} className="w-full pl-12 pr-4 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              {searchDoctorTerm && !selectedDoctorId && (
                                  <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-2xl shadow-2xl divide-y divide-slate-50">
                                      {myDoctors.filter(d => d.name.includes(searchDoctorTerm)).map(doc => (
                                          <div key={doc.id} onClick={() => { setSelectedDoctorId(doc.id); setSearchDoctorTerm(doc.name); }} className="p-4 text-[10px] font-black hover:bg-blue-50 cursor-pointer uppercase text-slate-600">{doc.name}</div>
                                      ))}
                                  </div>
                              )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fecha</label><DatePicker selected={planDate} onChange={d => d && setPlanDate(d)} dateFormat="dd/MM/yyyy" locale="es" className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black" /></div>
                              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Hora</label><select value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none">{visitTimeSlots.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                          </div>
                          {!isAppointmentMode && (
                              <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Objetivo</label><textarea rows={2} value={planObjective} onChange={e => setPlanObjective(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium uppercase outline-none" placeholder="¿QUÉ BUSCAS LOGRAR?" /></div>
                          )}
                      </div>
                      <button onClick={savePlan} className="w-full py-6 bg-[#0085ff] hover:bg-blue-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 transition-all active:scale-95">Guardar en Agenda</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL REPORTE */}
      {reportModalOpen && selectedVisitToReport && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-fadeIn">
                  <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                      <div><h3 className="text-xl font-black uppercase tracking-tighter">Reportar Resultado</h3><p className="text-[10px] text-blue-400 font-black uppercase mt-1 tracking-widest">{selectedVisitToReport.visit.date} • {selectedVisitToReport.visit.objective}</p></div>
                      <button onClick={() => setReportModalOpen(false)} className="bg-white/10 p-3 rounded-xl"><X/></button>
                  </div>
                  <div className="p-10 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Estatus Final</label><select value={reportOutcome} onChange={e => setReportOutcome(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none"><option value="SEGUIMIENTO">SEGUIMIENTO</option><option value="COTIZACIÓN">COTIZACIÓN</option><option value="INTERESADO">INTERESADO</option><option value="AUSENTE">AUSENTE</option></select></div>
                          <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fecha de Cierre</label><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black" /></div>
                      </div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Resumen de Visita</label><textarea rows={3} value={reportNote} onChange={e => setReportNote(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium uppercase outline-none" placeholder="DESCRIBE LO SUCEDIDO..." /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Siguiente Compromiso</label><textarea rows={2} value={reportFollowUp} onChange={e => setReportFollowUp(e.target.value)} className="w-full p-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium uppercase outline-none" placeholder="ACUERDOS..." /></div>
                      <button onClick={saveReport} className="w-full py-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95">Finalizar Reporte</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ExecutiveCalendar;
