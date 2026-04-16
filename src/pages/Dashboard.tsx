import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Award, 
  TrendingUp,
  Calendar,
  UserPlus,
  GraduationCap,
  BookOpen,
  Bell,
  Clock,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

const StatCard = ({ icon: Icon, label, value, color, trend, trendType }: any) => (
  <motion.div 
    whileHover={{ y: -5, scale: 1.02 }}
    className="relative overflow-hidden bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-300 group"
  >
    <div className={cn("absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-2xl transition-all group-hover:scale-150", color)}></div>
    
    <div className="relative z-10">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-100 dark:shadow-none transition-transform group-hover:rotate-6", color)}>
        <Icon size={24} className="text-white" />
      </div>
      
      <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
      
      <div className="flex items-end justify-between">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter",
            trendType === 'up' ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-500 bg-rose-50 dark:bg-rose-900/20"
          )}>
            {trendType === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        )}
      </div>
    </div>
  </motion.div>
);

interface Activity {
  id: string;
  type: 'absensi' | 'nilai' | 'siswa' | 'perilaku';
  text: string;
  time: string;
  icon: any;
  color: string;
  timestamp: any;
}

export const Dashboard: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    totalClasses: 0,
    attendanceRate: '0%',
    behaviorPoints: 0,
    totalTeachers: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Basic Stats
        const [studentsSnap, classesSnap, teachersSnap, behaviorsSnap, attendanceSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'classes')),
          getDocs(query(collection(db, 'users'), where('role', 'in', ['guru', 'wali_kelas']))),
          getDocs(collection(db, 'behaviors')),
          getDocs(collection(db, 'attendances'))
        ]);

        const active = studentsSnap.docs.filter(d => d.data().isActive).length;
        const totalPoints = behaviorsSnap.docs.reduce((acc, d) => {
          const data = d.data();
          return acc + (data.type === 'reward' ? data.points : -data.points);
        }, 0);

        // 2. Calculate Attendance Rate
        const totalAttendance = attendanceSnap.size;
        const presentCount = attendanceSnap.docs.filter(d => d.data().status === 'hadir').length;
        const rate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

        setStats({
          totalStudents: studentsSnap.size,
          activeStudents: active,
          totalClasses: classesSnap.size,
          attendanceRate: `${rate}%`,
          behaviorPoints: totalPoints,
          totalTeachers: teachersSnap.size
        });

        // 3. Prepare Chart Data (Last 7 Days)
        const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), i)).reverse();
        const dailyData = last7Days.map(day => {
          const dayAttendance = attendanceSnap.docs.filter(d => {
            const date = d.data().date; // Assuming YYYY-MM-DD
            return date === format(day, 'yyyy-MM-dd');
          });
          return {
            name: format(day, 'EEE', { locale: id }),
            hadir: dayAttendance.filter(d => d.data().status === 'hadir').length,
            alpa: dayAttendance.filter(d => d.data().status === 'alpa').length
          };
        });
        setChartData(dailyData);

        // 4. Fetch Recent Activities
        const recentActivities: Activity[] = [];
        
        // Recent Students
        const recentStudents = await getDocs(query(collection(db, 'students'), orderBy('createdAt', 'desc'), limit(3)));
        recentStudents.forEach(d => {
          recentActivities.push({
            id: d.id,
            type: 'siswa',
            text: `Siswa baru: ${d.data().name}`,
            time: format(d.data().createdAt?.toDate() || new Date(), 'dd MMM'),
            icon: UserPlus,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
            timestamp: d.data().createdAt?.toDate() || new Date()
          });
        });

        // Recent Grades
        const recentGrades = await getDocs(query(collection(db, 'grades'), orderBy('createdAt', 'desc'), limit(3)));
        recentGrades.forEach(d => {
          recentActivities.push({
            id: d.id,
            type: 'nilai',
            text: `Nilai ${d.data().subjectId} ditambahkan`,
            time: format(d.data().createdAt?.toDate() || new Date(), 'dd MMM'),
            icon: GraduationCap,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
            timestamp: d.data().createdAt?.toDate() || new Date()
          });
        });

        // Recent Behaviors
        const recentBehaviors = await getDocs(query(collection(db, 'behaviors'), orderBy('date', 'desc'), limit(3)));
        recentBehaviors.forEach(d => {
          recentActivities.push({
            id: d.id,
            type: 'perilaku',
            text: `${d.data().type === 'reward' ? 'Penghargaan' : 'Pelanggaran'}: ${d.data().title}`,
            time: format(new Date(d.data().date), 'dd MMM'),
            icon: Award,
            color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
            timestamp: new Date(d.data().date)
          });
        });

        setActivities(recentActivities.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5));

        // 5. Fetch Upcoming Events
        const eventsSnap = await getDocs(query(collection(db, 'events'), where('startDate', '>=', startOfDay(new Date()).toISOString()), orderBy('startDate', 'asc'), limit(3)));
        setUpcomingEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Menyiapkan Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 lg:space-y-12 pb-10">
      {/* Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Halo, {profile?.fullName.split(' ')[0]}!
            </h2>
            <motion.span 
              animate={{ rotate: [0, 20, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-3xl lg:text-4xl"
            >
              👋
            </motion.span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Selamat datang kembali. Berikut adalah ringkasan aktivitas sekolah hari ini.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hari Ini</p>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {format(new Date(), 'EEEE, d MMMM', { locale: id })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={Users} 
          label="Total Siswa" 
          value={stats.totalStudents} 
          color="bg-indigo-600"
          trend="+2.5%"
          trendType="up"
        />
        <StatCard 
          icon={BookOpen} 
          label="Total Kelas" 
          value={stats.totalClasses} 
          color="bg-emerald-500"
        />
        <StatCard 
          icon={Calendar} 
          label="Kehadiran" 
          value={stats.attendanceRate} 
          color="bg-amber-500"
          trend="-1.2%"
          trendType="down"
        />
        <StatCard 
          icon={Award} 
          label="Poin Perilaku" 
          value={stats.behaviorPoints} 
          color="bg-purple-500"
          trend="+120"
          trendType="up"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-500 hover:shadow-xl hover:shadow-indigo-500/5">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Statistik Kehadiran</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">7 Hari Terakhir</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hadir</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Alpa</span>
                </div>
              </div>
            </div>
            
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f8fafc', radius: 10 }}
                    contentStyle={{ 
                      borderRadius: '24px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)', 
                      padding: '16px',
                      backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
                      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b'
                    }}
                  />
                  <Bar dataKey="hadir" fill="url(#colorHadir)" radius={[8, 8, 0, 0]} barSize={32} />
                  <Bar dataKey="alpa" fill="#f43f5e" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Events Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white relative overflow-hidden group">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl transition-all group-hover:scale-150"></div>
              <div className="relative z-10">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                  <Bell size={24} />
                  Acara Sekolah
                </h3>
                <div className="space-y-4">
                  {upcomingEvents.length > 0 ? upcomingEvents.map(event => (
                    <div key={event.id} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        {format(new Date(event.startDate), 'd MMM yyyy', { locale: id })}
                      </p>
                      <h4 className="font-bold text-sm mt-1">{event.title}</h4>
                    </div>
                  )) : (
                    <p className="text-sm font-bold opacity-60">Tidak ada acara mendatang.</p>
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab('calendar')}
                  className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-widest hover:gap-4 transition-all"
                >
                  Lihat Kalender <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Pusat Bantuan</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Butuh bantuan menggunakan e-Guruku? Hubungi admin sistem.</p>
              </div>
              <div className="mt-8">
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95"
                >
                  Kirim Pesan Admin
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">Aktivitas Terbaru</h3>
              <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                <Clock size={16} />
              </div>
            </div>
            
            <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
              {activities.length > 0 ? activities.map((item, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="flex gap-6 relative z-10"
                >
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", item.color)}>
                    <item.icon size={18} />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{item.text}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{item.time}</p>
                  </div>
                </motion.div>
              )) : (
                <p className="text-center py-10 text-sm font-bold text-slate-400">Belum ada aktivitas.</p>
              )}
            </div>
            
            <button 
              onClick={() => setActiveTab('attendance')} // Or a general activity log if we had one
              className="w-full mt-10 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 transition-all"
            >
              Lihat Semua
            </button>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6">Akses Cepat</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'attendance', label: 'Absensi', icon: Calendar, color: 'bg-indigo-50 text-indigo-600' },
                { id: 'grades', label: 'Input Nilai', icon: GraduationCap, color: 'bg-emerald-50 text-emerald-600' },
                { id: 'students', label: 'Siswa', icon: Users, color: 'bg-amber-50 text-amber-600' },
                { id: 'reports', label: 'Laporan', icon: Bell, color: 'bg-rose-50 text-rose-600' },
              ].map((action, i) => (
                <button 
                  key={i} 
                  onClick={() => setActiveTab(action.id)}
                  className="flex flex-col items-center gap-3 p-4 rounded-3xl border border-slate-50 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900/30 hover:bg-indigo-50/30 transition-all group"
                >
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", action.color)}>
                    <action.icon size={20} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

