import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DoctorList from './pages/DoctorList';
import DoctorProfile from './pages/DoctorProfile';
import ExecutiveCalendar from './pages/ExecutiveCalendar';
import ProceduresManager from './pages/ProceduresManager';
import Login from './components/Login';
import { parseData } from './constants';
import { Doctor, User, Procedure, TimeOffEvent } from './types';
import { Menu } from 'lucide-react';

const STORAGE_KEYS = {
    DOCTORS: 'rc_medicall_doctors_v5',
    PROCEDURES: 'rc_medicall_procedures_v5',
    TIMEOFF: 'rc_medicall_timeoff_v5',
    USER: 'rc_medicall_user_v5',
    SIDEBAR: 'rc_medicall_sidebar_collapsed'
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
      const savedState = localStorage.getItem(STORAGE_KEYS.SIDEBAR);
      return savedState === 'true';
  });

  const toggleSidebar = () => {
      const newState = !isSidebarCollapsed;
      setIsSidebarCollapsed(newState);
      localStorage.setItem(STORAGE_KEYS.SIDEBAR, String(newState));
  };

  // --- CARGA INICIAL SEGURA ---
  useEffect(() => {
    const initApp = () => {
        // 1. Cargar Usuario
        const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (savedUser) setUser(JSON.parse(savedUser));

        // 2. Cargar Médicos (Prioridad al Storage)
        const storedDocs = localStorage.getItem(STORAGE_KEYS.DOCTORS);
        if (storedDocs && JSON.parse(storedDocs).length > 0) {
            setDoctors(JSON.parse(storedDocs));
        } else {
            // Solo si está vacío, cargamos los datos por defecto
            const initial = parseData();
            setDoctors(initial);
            localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(initial));
        }

        // 3. Cargar Procedimientos
        const storedProcs = localStorage.getItem(STORAGE_KEYS.PROCEDURES);
        if (storedProcs) setProcedures(JSON.parse(storedProcs));

        setLoading(false);
    };

    initApp();
  }, []);

  // --- PERSISTENCIA ATÓMICA ---
  // Solo guardamos si hay datos, para evitar borrar por error al recargar
  useEffect(() => {
      if (!loading && doctors.length > 0) {
          localStorage.setItem(STORAGE_KEYS.DOCTORS, JSON.stringify(doctors));
      }
  }, [doctors, loading]);

  useEffect(() => {
      if (!loading) {
          localStorage.setItem(STORAGE_KEYS.PROCEDURES, JSON.stringify(procedures));
      }
  }, [procedures, loading]);

  const handleLogin = (loggedInUser: User) => {
      setUser(loggedInUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem(STORAGE_KEYS.USER);
  };

  // --- FUNCIONES DE RESPALDO GLOBAL ---
  const importFullBackup = (data: { doctors: Doctor[], procedures: Procedure[], timeOff?: TimeOffEvent[] }) => {
      if (data.doctors) setDoctors(data.doctors);
      if (data.procedures) setProcedures(data.procedures);
      if (data.timeOff) localStorage.setItem(STORAGE_KEYS.TIMEOFF, JSON.stringify(data.timeOff));
      alert("Base de datos restaurada correctamente.");
  };

  // --- CRUD HANDLERS ---
  const updateDoctor = (updatedDoctor: Doctor) => {
    setDoctors(prev => prev.map(d => d.id === updatedDoctor.id ? updatedDoctor : d));
  };

  const updateDoctorsList = (newDoctors: Doctor[]) => {
      setDoctors(newDoctors);
  };

  const addDoctor = (newDoctor: Doctor) => {
      setDoctors(prev => [newDoctor, ...prev]);
  };

  const deleteDoctor = (id: string) => {
      setDoctors(prev => prev.filter(d => d.id !== id));
  };

  const handleDeleteVisit = (doctorId: string, visitId: string) => {
      setDoctors(prev => prev.map(doc => {
          if (doc.id === doctorId) {
              return { ...doc, visits: doc.visits.filter(v => v.id !== visitId) };
          }
          return doc;
      }));
  };

  const addProcedure = (newProc: Procedure) => {
      setProcedures(prev => [...prev, newProc]);
  };

  const updateProcedure = (updatedProc: Procedure) => {
      setProcedures(prev => prev.map(p => p.id === updatedProc.id ? updatedProc : p));
  };

  const deleteProcedure = (id: string) => {
      setProcedures(prev => prev.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-bold animate-pulse">Protegiendo datos locales...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <Router>
      <div className="flex h-screen bg-[#f8fafc]">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 w-full bg-slate-900 text-white z-50 p-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
                <span className="font-black text-cyan-400">RC</span>
                <span className="font-bold">MediCall</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-800 rounded-lg">
                <Menu className="w-6 h-6 text-white" />
            </button>
        </div>

        <Sidebar 
            user={user} 
            onLogout={handleLogout} 
            isMobileOpen={isMobileMenuOpen} 
            closeMobileMenu={() => setIsMobileMenuOpen(false)} 
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={toggleSidebar}
        />
        
        <div className={`flex-1 flex flex-col h-full relative pt-16 md:pt-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
          <main className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 relative z-10 w-full">
            <div className="max-w-7xl mx-auto min-w-[320px]">
                <Routes>
                <Route path="/" element={<Dashboard doctors={doctors} user={user} procedures={procedures} onImportBackup={importFullBackup} />} />
                <Route path="/doctors" element={<DoctorList doctors={doctors} onAddDoctor={addDoctor} onDeleteDoctor={deleteDoctor} user={user} />} />
                <Route path="/doctors/:id" element={<DoctorProfile doctors={doctors} onUpdate={updateDoctor} onDeleteVisit={handleDeleteVisit} user={user} />} />
                <Route path="/calendar" element={<ExecutiveCalendar doctors={doctors} onUpdateDoctors={updateDoctorsList} onDeleteVisit={handleDeleteVisit} user={user} />} />
                <Route path="/procedures" element={<ProceduresManager procedures={procedures} doctors={doctors} onAddProcedure={addProcedure} onUpdateProcedure={updateProcedure} onDeleteProcedure={deleteProcedure} user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;