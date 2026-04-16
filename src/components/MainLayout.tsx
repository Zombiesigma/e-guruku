import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  GraduationCap, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  BookOpen,
  Moon,
  Sun,
  Calendar,
  Bell,
  Clock
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none" 
        : "text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const MainLayout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || 
             localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const menuItems = [
    { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
    { id: 'classes', label: 'Kelas', icon: BookOpen },
    { id: 'teachers', label: 'Guru', icon: Users },
    { id: 'students', label: 'Siswa', icon: Users },
    { id: 'attendance', label: 'Absensi', icon: CalendarCheck },
    { id: 'grades', label: 'Nilai', icon: GraduationCap },
    { id: 'behavior', label: 'Perilaku', icon: BookOpen },
    { id: 'schedules', label: 'Jadwal', icon: Clock },
    { id: 'calendar', label: 'Kalender', icon: Calendar },
    { id: 'notifications', label: 'Notifikasi', icon: Bell },
    { id: 'reports', label: 'Laporan', icon: FileText },
    { id: 'settings', label: 'Profil', icon: Settings },
  ];

  const handleLogout = async () => {
    const result = await MySwal.fire({
      title: 'Keluar Akun?',
      text: 'Anda akan diarahkan kembali ke halaman login.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f8fafc' : '#1e293b',
    });

    if (result.isConfirmed) {
      signOut(auth);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row transition-colors duration-300">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 sticky top-0 h-screen z-30 transition-colors duration-300">
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none transform -rotate-3">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">e-Guruku</h1>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Premium Edition</p>
            </div>
          </div>
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-all"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
            />
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold border-2 border-white dark:border-slate-700 shadow-sm">
                {profile?.fullName.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{profile?.fullName}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{profile?.role.replace('_', ' ')}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-rose-600 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 transition-all duration-200 text-sm font-bold"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 z-40 px-6 h-16 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none">
            <GraduationCap size={18} />
          </div>
          <span className="font-black text-slate-900 dark:text-white tracking-tight">e-Guruku</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold text-xs"
          >
            {profile?.fullName.charAt(0)}
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 z-40 px-4 h-20 flex items-center justify-around pb-safe transition-colors duration-300">
        {menuItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200",
              activeTab === item.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-all",
              activeTab === item.id ? "bg-indigo-50 dark:bg-indigo-900/20" : "bg-transparent"
            )}>
              <item.icon size={22} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsMenuOpen(true)}
          className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 dark:text-slate-500"
        >
          <div className="p-1.5 rounded-lg">
            <Menu size={22} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Menu</span>
        </button>
      </nav>

      {/* Mobile Menu Sheet */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[3rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-8" />
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Menu Utama</h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">e-Guruku Navigation</p>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-10">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-3 p-4 rounded-3xl transition-all border-2",
                      activeTab === item.id 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none" 
                        : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <item.icon size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-black">
                    {profile?.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{profile?.fullName}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{profile?.role.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-100 dark:shadow-none"
                >
                  Keluar Akun
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 pt-20 lg:pt-10 pb-24 lg:pb-10 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

