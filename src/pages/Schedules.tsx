import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, serverTimestamp, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { sendNotification } from '../lib/notifications';
import { ClassInfo, UserProfile } from '../types';
import { Clock, Plus, X, BookOpen, User, Calendar, Edit2, Trash2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';

interface Schedule {
  id: string;
  teacherId: string;
  subject: string;
  classId: string;
  day: string;
  startTime: string;
  endTime: string;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const SchedulesPage: React.FC = () => {
  const { profile } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<Partial<Schedule>>({
    day: 'Senin'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schedulesSnap, teachersSnap, classesSnap] = await Promise.all([
        getDocs(collection(db, 'schedules')),
        getDocs(query(collection(db, 'users'), where('role', 'in', ['guru', 'wali_kelas']))),
        getDocs(collection(db, 'classes'))
      ]);

      setSchedules(schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Schedule)));
      setTeachers(teachersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any as UserProfile)));
      setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClassInfo)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSchedule.teacherId || !currentSchedule.subject || !currentSchedule.classId) return;

    try {
      if (currentSchedule.id) {
        await updateDoc(doc(db, 'schedules', currentSchedule.id), {
          ...currentSchedule,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...currentSchedule,
          createdAt: serverTimestamp()
        });

        // Notify teacher
        const className = classes.find(c => c.id === currentSchedule.classId)?.name;
        await sendNotification(
          currentSchedule.teacherId,
          'Jadwal Mengajar Baru',
          `Anda telah ditugaskan mengajar ${currentSchedule.subject} di kelas ${className} pada hari ${currentSchedule.day} jam ${currentSchedule.startTime}`,
          'info'
        );
      }
      setIsModalOpen(false);
      setCurrentSchedule({ day: 'Senin' });
      fetchData();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Jadwal berhasil disimpan',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'schedules');
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Jadwal?',
      text: "Jadwal ini akan dihapus permanen.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'schedules', id));
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'schedules');
      }
    }
  };

  const getTeacherName = (id: string) => teachers.find(t => t.uid === id)?.fullName || 'Guru tidak ditemukan';
  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || 'Kelas tidak ditemukan';

  const schedulesByDay = DAYS.reduce((acc, day) => {
    acc[day] = schedules.filter(s => s.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, Schedule[]>);

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Jadwal Mengajar</h2>
          <p className="text-slate-500 dark:text-slate-400">Kelola jadwal pelajaran guru dan pembagian kelas.</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'kurikulum') && (
          <button 
            onClick={() => {
              setCurrentSchedule({ day: 'Senin' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
          >
            <Plus size={18} />
            <span>Tambah Jadwal</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {DAYS.map(day => (
          <div key={day} className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest">{day}</h3>
              <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-xl text-[10px] font-black text-indigo-600 border border-indigo-100 dark:border-indigo-900/30">
                {schedulesByDay[day].length} Sesi
              </span>
            </div>
            <div className="p-4 space-y-3 flex-1">
              {schedulesByDay[day].length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-20">
                  <Clock size={40} />
                  <p className="text-xs font-bold mt-2">Belum ada jadwal</p>
                </div>
              ) : (
                schedulesByDay[day].map(s => (
                  <div key={s.id} className="group relative bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 transition-all shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <BookOpen size={16} />
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.subject}</h4>
                        </div>
                        <div className="space-y-1 ml-10">
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <User size={12} />
                            <span>{getTeacherName(s.teacherId)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <Calendar size={12} />
                            <span>Kelas {getClassName(s.classId)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                            <Clock size={12} />
                            <span>{s.startTime} - {s.endTime}</span>
                          </div>
                        </div>
                      </div>
                      {(profile?.role === 'admin' || profile?.role === 'kurikulum') && (
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => {
                              setCurrentSchedule(s);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {currentSchedule.id ? 'Edit Jadwal' : 'Tambah Jadwal'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guru Pengajar</label>
                  <select 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                    value={currentSchedule.teacherId || ''}
                    onChange={e => setCurrentSchedule({...currentSchedule, teacherId: e.target.value})}
                  >
                    <option value="">Pilih Guru</option>
                    {teachers.map(t => (
                      <option key={t.uid} value={t.uid}>{t.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                    placeholder="Contoh: Matematika"
                    value={currentSchedule.subject || ''}
                    onChange={e => setCurrentSchedule({...currentSchedule, subject: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={currentSchedule.classId || ''}
                      onChange={e => setCurrentSchedule({...currentSchedule, classId: e.target.value})}
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hari</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={currentSchedule.day || 'Senin'}
                      onChange={e => setCurrentSchedule({...currentSchedule, day: e.target.value})}
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jam Mulai</label>
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={currentSchedule.startTime || ''}
                      onChange={e => setCurrentSchedule({...currentSchedule, startTime: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jam Selesai</label>
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={currentSchedule.endTime || ''}
                      onChange={e => setCurrentSchedule({...currentSchedule, endTime: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all mt-4"
                >
                  Simpan Jadwal
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
