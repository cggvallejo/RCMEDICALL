import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Doctor, User, Procedure, TimeOffEvent } from '../types';
import { Users, ShieldCheck, Download, Calendar, ArrowRight, CheckCircle2, TrendingUp, Filter, Award, Activity, DollarSign, Coins, X, MapPin, Target, Briefcase, PieChart, Database, Upload, AlertTriangle, Save, FileSpreadsheet, Clock, ChevronDown } from 'lucide-react';

interface DashboardProps {
  doctors: Doctor[];
  user: User;
  procedures: Procedure[];
  onImportBackup?: (data: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ doctors, user, procedures, onImportBackup }) => {
  // Estado de Filtros
  const [filterExecutive, setFilterExecutive] = useState<string | null>(user.role === 'executive' ? user.name : null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'ALL'>(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | ''>('');

  const [activeModal, setActiveModal] = useState<'planned' | 'completed' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Asegurar que si es ejecutivo, siempre vea solo lo suyo
  useEffect(() => {
      if (user.role === 'executive') {
          setFilterExecutive(user.name);
      }
  }, [user]);

  const executives = [
      { name: 'LUIS', color: 'bg-blue-500', gradient: 'from-blue-500 to-blue-700', text: 'text-blue-600', bgLight: 'bg-blue-50' },
      { name: 'ORALIA', color: 'bg-pink-500', gradient: 'from-pink-500 to-rose-600', text: 'text-pink-600', bgLight: 'bg-pink-50' },
      { name: 'ANGEL', color: 'bg-purple-500', gradient: 'from-purple-500 to-indigo-600', text: 'text-purple-600', bgLight: 'bg-purple-50' },
      { name: 'TALINA', color: 'bg-teal-500', gradient: 'from-emerald-500 to-teal-600', text: 'text-teal-600', bgLight: 'bg-teal-50' }
  ];

  // 1. Filtrar Médicos por Ejecutivo seleccionado
  const filteredDoctors = useMemo(() => {
      return filterExecutive ? doctors.filter(d => d.executive === filterExecutive) : doctors;
  }, [doctors, filterExecutive]);

  // 2. Lógica de Fechas
  const isDateInFilter = (dateString: string) => {
      if (!dateString) return false;
      const [y, m, d] = dateString.split('-').map(Number);
      
      const matchYear = y === selectedYear;
      const matchMonth = selectedMonth === 'ALL' || (m - 1) === selectedMonth; // Mes en data es 1-12, js es 0-11
      const matchDay = selectedDay === '' || d === Number(selectedDay);

      return matchYear && matchMonth && matchDay;
  };

  const stats = useMemo(() => {
    let plannedVisits = 0;
    let completedVisits = 0;
    let otherVisits = 0; // Canceladas, Ausentes, etc.
    const classifications = { A: 0, B: 0, C: 0, None: 0 };

    // Calcular KPIs de Visitas sobre los doctores filtrados
    filteredDoctors.forEach(doc => {
        doc.visits.forEach(v => {
            if (isDateInFilter(v.date)) {
                if (v.status === 'completed') completedVisits++;
                else if (v.status === 'planned') {
                     if (v.outcome === 'CITA') {
                         // Citas futuras cuentan como planeadas especiales
                         plannedVisits++; 
                     } else if (v.outcome === 'AUSENTE' || v.outcome === 'CANCELADA') {
                         otherVisits++;
                     } else {
                         plannedVisits++;
                     }
                }
            }
        });
        
        // Clasificación (Global, no depende de la fecha)
        if (doc.classification === 'A') classifications.A++;
        else if (doc.classification === 'B') classifications.B++;
        else if (doc.classification === 'C') classifications.C++;
        else classifications.None++;
    });

    // Calcular Desglose por Equipo (Solo para Admin)
    const teamBreakdown = executives.map(exec => {
        const execDocs = doctors.filter(d => d.executive === exec.name);
        let execPlanned = 0;
        let execCompleted = 0;
        
        execDocs.forEach(d => {
            d.visits.forEach(v => {
                if (isDateInFilter(v.date)) {
                    if (v.status === 'completed') execCompleted++;
                    if (v.status === 'planned' && v.outcome !== 'CITA' && v.outcome !== 'AUSENTE') execPlanned++;
                }
            });
        });

        const execProcs = procedures.filter(p => {
            return p.status === 'performed' && 
                   isDateInFilter(p.date) &&
                   execDocs.some(d => d.id === p.doctorId);
        });

        return {
            ...exec,
            doctors: execDocs.length,
            planned: execPlanned,
            completed: execCompleted,
            revenue: execProcs.reduce((acc, curr) => acc + (curr.cost || 0), 0),
            commission: execProcs.reduce((acc, curr) => acc + (curr.commission || 0), 0),
            performance: (execPlanned + execCompleted) > 0 ? Math.round((execCompleted / (execPlanned + execCompleted)) * 100) : 0
        };
    });

    // Calcular Procedimientos y Dinero sobre el rango de fecha seleccionado
    const relevantProcedures = procedures.filter(p => {
        const belongs = filterExecutive ? filteredDoctors.some(d => d.id === p.doctorId) : true;
        return isDateInFilter(p.date) && belongs;
    });

    const performedProcedures = relevantProcedures.filter(p => p.status === 'performed');

    const totalRevenue = performedProcedures.reduce((a, c) => a + (c.cost || 0), 0);
    const totalCommission = performedProcedures.reduce((a, c) => a + (c.commission || 0), 0);
    
    // Performance Calculation for the period
    const totalInteractions = plannedVisits + completedVisits + otherVisits;
    const performance = totalInteractions > 0 ? Math.round((completedVisits / totalInteractions) * 100) : 0;

    return { 
        totalDoctors: filteredDoctors.length, 
        plannedVisits,
        completedVisits, 
        otherVisits,
        totalRevenue,
        totalCommission,
        performance,
        classifications, 
        teamBreakdown,
        recentProcedures: relevantProcedures.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
    };
  }, [filteredDoctors, doctors, procedures, filterExecutive, selectedYear, selectedMonth, selectedDay]);

  // --- EXPORT LOGIC ---
  const downloadCSV = (content: string, fileName: string) => {
      const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const exportVisits = () => {
      const headers = ['FECHA', 'HORA', 'EJECUTIVO', 'MÉDICO/HOSPITAL', 'ESPECIALIDAD', 'OBJETIVO', 'RESULTADO', 'NOTA', 'SEGUIMIENTO', 'ESTADO'];
      
      const rows = doctors.flatMap(doc => {
          return doc.visits.map(v => {
              if (filterExecutive && doc.executive !== filterExecutive) return null;
              // Export also respects date filter? Usually exports are bulk, but let's filter if needed.
              // For export, usually users want everything, but let's stick to filters to be consistent.
              if (!isDateInFilter(v.date)) return null;

              return [
                  v.date,
                  v.time || '',
                  doc.executive,
                  `"${doc.name}"`,
                  doc.specialty || doc.category,
                  `"${v.objective || ''}"`,
                  v.outcome,
                  `"${v.note || ''}"`,
                  `"${v.followUp || ''}"`,
                  v.status === 'completed' ? 'REALIZADA' : 'PLANEADA'
              ].join(',');
          }).filter(Boolean);
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      downloadCSV(csvContent, `REPORTE_VISITAS_${selectedYear}_${selectedMonth}.csv`);
  };

  const exportProcedures = () => {
      const headers = ['FECHA', 'HORA', 'HOSPITAL', 'MÉDICO', 'EJECUTIVO', 'PROCEDIMIENTO', 'TÉCNICO', 'PAGO', 'COSTO', 'COMISIÓN', 'ESTADO', 'NOTAS'];
      
      const rows = procedures.map(proc => {
          const doc = doctors.find(d => d.id === proc.doctorId);
          const executive = doc ? doc.executive : 'DESCONOCIDO';
          if (filterExecutive && executive !== filterExecutive) return null;
          if (!isDateInFilter(proc.date)) return null;

          return [
              proc.date,
              proc.time || '',
              `"${proc.hospital || ''}"`,
              `"${proc.doctorName}"`,
              executive,
              `"${proc.procedureType}"`,
              `"${proc.technician || ''}"`,
              proc.paymentType,
              proc.cost || 0,
              proc.commission || 0,
              proc.status === 'performed' ? 'REALIZADO' : 'PROGRAMADO',
              `"${proc.notes || ''}"`
          ].join(',');
      }).filter(Boolean);

      const csvContent = [headers.join(','), ...rows].join('\n');
      downloadCSV(csvContent, `REPORTE_PROCEDIMIENTOS_${selectedYear}_${selectedMonth}.csv`);
  };

  const exportTimeOff = () => {
      const storedTimeOff = localStorage.getItem('rc_medicall_timeoff_v5');
      const timeOffData: TimeOffEvent[] = storedTimeOff ? JSON.parse(storedTimeOff) : [];
      
      const headers = ['EJECUTIVO', 'INICIO', 'FIN', 'DURACIÓN', 'MOTIVO', 'NOTAS'];
      const rows = timeOffData.map(t => {
          if (filterExecutive && t.executive !== filterExecutive) return null;
          return [
              t.executive,
              t.startDate,
              t.endDate,
              t.duration,
              t.reason,
              `"${t.notes || ''}"`
          ].join(',');
      }).filter(Boolean);

      const csvContent = [headers.join(','), ...rows].join('\n');
      downloadCSV(csvContent, `REPORTE_AUSENCIAS.csv`);
  };

  const handleExportBackup = () => {
      const backup = {
          doctors,
          procedures,
          timeOff: JSON.parse(localStorage.getItem('rc_medicall_timeoff_v5') || '[]'),
          exportedAt: new Date().toISOString(),
          version: '5.0'
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RESPALDO_CRM_RC_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const data = JSON.parse(event.target?.result as string);
              if (data.doctors && Array.isArray(data.doctors)) {
                  if (window.confirm("¿Seguro que deseas restaurar este respaldo? Se sobreescribirá la información actual.")) {
                      onImportBackup?.(data);
                  }
              } else {
                  alert("Formato de archivo no válido.");
              }
          } catch (error) {
              alert("Error al procesar el archivo JSON.");
          }
      };
      reader.readAsText(file);
  };

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const years = [2023, 2024, 2025, 2026];

  const getPeriodLabel = () => {
      if (selectedMonth === 'ALL') return `Año ${selectedYear}`;
      if (selectedDay !== '') return `${selectedDay} de ${months[selectedMonth]} ${selectedYear}`;
      return `${months[selectedMonth]} ${selectedYear}`;
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Filters */}
      <div className="flex flex-col gap-6 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-white/50 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-4">
            <div>
                <h1 className="text-4xl font-black text-slate-800 tracking-tighter mb-2">
                    Hola, <span className="text-blue-600">{user.name}</span>
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    {user.role === 'admin' ? 'PANEL DE CONTROL GLOBAL' : 'MI RENDIMIENTO PERSONAL'}
                </p>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center bg-slate-100/50 p-2 rounded-2xl border border-slate-200">
                {/* Year Filter */}
                <div className="relative">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Month Filter */}
                <div className="relative">
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer uppercase"
                    >
                        <option value="ALL">TODO EL AÑO</option>
                        {months.map((m, idx) => <option key={m} value={idx}>{m.toUpperCase()}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Day Filter */}
                <div className="relative flex items-center">
                    <input 
                        type="number" 
                        min="1" 
                        max="31"
                        placeholder="DÍA" 
                        value={selectedDay}
                        onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : '')}
                        className="w-16 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
                    />
                </div>

                {/* Executive Filter (Admin Only) */}
                {user.role === 'admin' && (
                    <>
                        <div className="w-px h-6 bg-slate-300 mx-1"></div>
                        <div className="relative">
                            <select 
                                value={filterExecutive || ''} 
                                onChange={(e) => setFilterExecutive(e.target.value || null)}
                                className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer uppercase"
                            >
                                <option value="">TODO EL EQUIPO</option>
                                {executives.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
                            </select>
                            <ChevronDown className="w-3 h-3 text-blue-400 absolute right-3 top-3 pointer-events-none" />
                        </div>
                    </>
                )}
            </div>
          </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Directorio (Estático) */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Asignada</p>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-4xl font-black text-slate-800">{stats.totalDoctors}</p>
          <p className="text-[10px] font-bold text-emerald-500 mt-2 flex items-center"><TrendingUp className="w-3 h-3 mr-1" /> Médicos Activos</p>
        </div>
        
        {/* Card 2: Rendimiento del Periodo (Dinámico) */}
        <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl text-white group hover:-translate-y-1 transition-all relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Rendimiento {getPeriodLabel()}</p>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2 relative z-10">
              <p className="text-4xl font-black">{stats.completedVisits}</p>
              <span className="text-xs font-medium text-indigo-200">realizadas</span>
          </div>
          
          <div className="mt-4 grid grid-cols-3 gap-2 text-center relative z-10">
              <div className="bg-white/10 rounded-lg p-1.5">
                  <span className="block text-lg font-bold">{stats.plannedVisits}</span>
                  <span className="text-[8px] uppercase text-indigo-200">Planeadas</span>
              </div>
              <div className="bg-white/10 rounded-lg p-1.5">
                  <span className="block text-lg font-bold">{stats.otherVisits}</span>
                  <span className="text-[8px] uppercase text-indigo-200">Cancel/Otro</span>
              </div>
              <div className="bg-white text-indigo-600 rounded-lg p-1.5 shadow-sm">
                  <span className="block text-lg font-black">{stats.performance}%</span>
                  <span className="text-[8px] uppercase font-bold">Eficacia</span>
              </div>
          </div>
        </div>

        {/* Card 3: Ventas (Dinámico) */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ventas {selectedMonth === 'ALL' ? 'Anuales' : 'Mensuales'}</p>
            <DollarSign className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">${stats.totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Periodo Seleccionado</p>
        </div>

        {/* Card 4: Comisiones (Dinámico) */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 group hover:-translate-y-1 transition-all">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comisiones</p>
            <Coins className="w-5 h-5 text-cyan-500" />
          </div>
          <p className="text-3xl font-black text-slate-800">${stats.totalCommission.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Estimadas (3%)</p>
        </div>
      </div>

      {/* REPORTING & BACKUP CENTER (ONLY ADMIN) */}
      {user.role === 'admin' && (
          <div className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -mr-32 -mt-32"></div>
              
              <div className="relative z-10 space-y-8">
                  <div className="flex items-center gap-5">
                      <div className="p-4 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 text-blue-400">
                          <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <div>
                          <h3 className="text-xl font-black text-white">Centro de Reportes y Datos</h3>
                          <p className="text-sm text-blue-200 font-medium">Exportación compatible con Excel basada en los filtros activos.</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <button 
                        onClick={exportVisits}
                        className="flex items-center justify-center px-4 py-3 bg-white/10 hover:bg-emerald-600 hover:border-emerald-500 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/20 transition-all active:scale-95"
                      >
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Reporte Visitas
                      </button>
                      <button 
                        onClick={exportProcedures}
                        className="flex items-center justify-center px-4 py-3 bg-white/10 hover:bg-emerald-600 hover:border-emerald-500 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/20 transition-all active:scale-95"
                      >
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Reporte Proc.
                      </button>
                      <button 
                        onClick={exportTimeOff}
                        className="flex items-center justify-center px-4 py-3 bg-white/10 hover:bg-orange-500 hover:border-orange-400 backdrop-blur-md text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/20 transition-all active:scale-95"
                      >
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Reporte Ausencias
                      </button>

                      <button 
                        onClick={handleExportBackup}
                        className="flex items-center justify-center px-4 py-3 bg-white/5 hover:bg-white/20 backdrop-blur-md text-slate-300 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all active:scale-95"
                      >
                          <Download className="w-4 h-4 mr-2" /> Respaldo Completo
                      </button>
                      
                      <div className="relative">
                        <button 
                            onClick={handleImportClick}
                            className="w-full h-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                        >
                            <Upload className="w-4 h-4 mr-2" /> Restaurar
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileImport} 
                            accept=".json" 
                            className="hidden" 
                        />
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* ADMIN CONTROL TABLE (ONLY ADMIN - HIDDEN FOR EXECUTIVES) */}
      {user.role === 'admin' && !filterExecutive && (
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl"><Target className="w-6 h-6" /></div>
                  <div>
                      <h3 className="text-xl font-black text-slate-800">Auditoría de Rendimiento</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resultados filtrados por: {getPeriodLabel()}</p>
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <tr>
                              <th className="px-8 py-4">Ejecutivo</th>
                              <th className="px-6 py-4">Total Cartera</th>
                              <th className="px-6 py-4">Visitas Planeadas</th>
                              <th className="px-6 py-4">Visitas Realizadas</th>
                              <th className="px-6 py-4">Efectividad</th>
                              <th className="px-6 py-4">Venta Periodo</th>
                              <th className="px-8 py-4 text-right">Detalle</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {stats.teamBreakdown.map(exec => (
                              <tr key={exec.name} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-8 py-5">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${exec.gradient} flex items-center justify-center text-white font-black text-[10px]`}>{exec.name.substring(0,2)}</div>
                                          <span className="font-bold text-slate-800">{exec.name}</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-5 font-medium text-slate-600">{exec.doctors}</td>
                                  <td className="px-6 py-5 font-bold text-indigo-600">{exec.planned}</td>
                                  <td className="px-6 py-5 font-bold text-emerald-600">{exec.completed}</td>
                                  <td className="px-6 py-5">
                                      <div className="flex items-center gap-2">
                                          <div className="w-12 bg-slate-100 h-1 rounded-full overflow-hidden">
                                              <div className="bg-indigo-500 h-full" style={{ width: `${exec.performance}%` }}></div>
                                          </div>
                                          <span className="text-[10px] font-black text-slate-500">{exec.performance}%</span>
                                      </div>
                                  </td>
                                  <td className="px-6 py-5 font-black text-slate-800">${exec.revenue.toLocaleString()}</td>
                                  <td className="px-8 py-5 text-right">
                                      <button onClick={() => setFilterExecutive(exec.name)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                          <ArrowRight className="w-4 h-4" />
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* FEED DE ACTIVIDAD & PROCEDIMIENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[600px]">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-800">Bitácora de Actividad</h3>
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase">Filtrado por fecha</span>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-0">
                  <div className="divide-y divide-slate-50">
                    {filteredDoctors
                        .flatMap(d => d.visits.map(v => ({...v, doctorName: d.name, executive: d.executive})))
                        .filter(v => v.status === 'completed' && isDateInFilter(v.date)) // Apply Date Filter Here too
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .slice(0, 50)
                        .map((visit, idx) => (
                            <div key={idx} className="p-6 hover:bg-slate-50/50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-800 uppercase line-clamp-1">{visit.doctorName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black text-blue-500 uppercase">Ejecutivo: {visit.executive}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{visit.date}</span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${visit.outcome === 'INTERESADO' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{visit.outcome}</span>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl text-xs text-slate-600 italic border border-slate-100 uppercase">"{visit.note}"</div>
                            </div>
                        ))}
                    {stats.completedVisits === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                            <p className="text-sm font-medium">No hay actividad registrada en este periodo.</p>
                        </div>
                    )}
                  </div>
              </div>
          </div>

          <div className="lg:col-span-1 space-y-8">
              {/* PROCEDIMIENTOS PANEL */}
              <div className="bg-white p-0 rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-[400px]">
                  <div className="p-6 bg-gradient-to-r from-slate-800 to-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-lg font-black flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> Procedimientos</h3>
                      <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded uppercase">Periodo Actual</span>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                      {stats.recentProcedures.length > 0 ? (
                          <div className="divide-y divide-slate-50">
                              {stats.recentProcedures.map((proc, idx) => (
                                  <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                                      <div className="flex justify-between items-start mb-1">
                                          <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${proc.status === 'performed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                              {proc.status === 'performed' ? 'REALIZADO' : 'AGENDADO'}
                                          </span>
                                          <span className="text-[9px] font-bold text-slate-400">{proc.date}</span>
                                      </div>
                                      <p className="text-xs font-black text-slate-800 uppercase mt-1 line-clamp-1">{proc.procedureType}</p>
                                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{proc.doctorName}</p>
                                      {proc.hospital && <p className="text-[9px] text-slate-400 mt-1 flex items-center"><MapPin className="w-3 h-3 mr-1" /> {proc.hospital}</p>}
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400">
                              <Activity className="w-8 h-8 mb-2 opacity-20" />
                              <p className="text-xs font-bold">Sin procedimientos en fecha.</p>
                          </div>
                      )}
                  </div>
              </div>

              {/* CLASIFICACIÓN PANEL */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                  <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Award className="w-5 h-5 text-purple-500" /> Clasificación Cartera</h3>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                          <span className="text-xs font-black text-emerald-700 uppercase">VIP (A)</span>
                          <span className="text-2xl font-black text-emerald-800">{stats.classifications.A}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                          <span className="text-xs font-black text-blue-700 uppercase">REGULAR (B)</span>
                          <span className="text-2xl font-black text-blue-800">{stats.classifications.B}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                          <span className="text-xs font-black text-slate-500 uppercase">BÁSICO (C)</span>
                          <span className="text-2xl font-black text-slate-800">{stats.classifications.C}</span>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;