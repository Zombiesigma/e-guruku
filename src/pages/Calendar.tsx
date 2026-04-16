import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { sendNotification, broadcastNotification } from '../lib/notifications';
import { Calendar as CalendarIcon, Plus, X, Clock, MapPin, ChevronLeft, ChevronRight, Bell } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';

interface SchoolEvent {
  id: string;
  title: string;
  description?: string;
  startDate: any;
  endDate?: any;
  type: 'event' | 'deadline' | 'holiday';
  createdBy: string;
}

export const CalendarPage: React.FC = () => {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<SchoolEvent>>({
    type: 'event',
    startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm")
  });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolEvent)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !newEvent.title || !newEvent.startDate) return;

    try {
      const docRef = await addDoc(collection(db, 'events'), {
        ...newEvent,
        createdBy: profile.uid,
        createdAt: serverTimestamp()
      });

      // Notify all staff
      const usersSnap = await getDocs(collection(db, 'users'));
      const staffIds = usersSnap.docs.map(d => d.id);
      await broadcastNotification(
        staffIds,
        'Acara Baru Ditambahkan',
        `${newEvent.title} telah dijadwalkan pada ${format(new Date(newEvent.startDate!), 'dd MMMM yyyy', { locale: id })}`,
        'info'
      );

      setIsModalOpen(false);
      setNewEvent({ type: 'event', startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
      fetchEvents();
      Swal.fire({
        icon: 'success',
        title: 'Berhasil',
        text: 'Acara berhasil ditambahkan',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const result = await Swal.fire({
      title: 'Hapus Acara?',
      text: "Acara ini akan dihapus permanen.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'events', id));
        fetchEvents();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'events');
      }
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return isSameDay(eventDate, day);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kalender Akademik</h2>
          <p className="text-slate-500 dark:text-slate-400">Pantau jadwal, acara sekolah, dan tenggat waktu penting.</p>
        </div>
        {(profile?.role === 'admin' || profile?.role === 'kurikulum' || profile?.role === 'humas') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
          >
            <Plus size={18} />
            <span>Tambah Acara</span>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy', { locale: id })}
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg"
              >
                Hari Ini
              </button>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
              <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());

              return (
                <div 
                  key={idx} 
                  className={cn(
                    "min-h-[100px] p-2 border-r border-b border-slate-50 dark:border-slate-800/50 last:border-r-0",
                    !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-900/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-lg",
                      isToday ? "bg-indigo-600 text-white" : isCurrentMonth ? "text-slate-700 dark:text-slate-300" : "text-slate-300 dark:text-slate-600"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <div 
                        key={event.id}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold truncate",
                          event.type === 'holiday' ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" :
                          event.type === 'deadline' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" :
                          "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20"
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Events Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Bell size={20} className="text-indigo-600" />
              Acara Mendatang
            </h3>
            <div className="space-y-4">
              {events.length === 0 ? (
                <div className="text-center py-10">
                  <CalendarIcon size={40} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm font-bold text-slate-400">Belum ada acara</p>
                </div>
              ) : (
                events.slice(0, 5).map(event => (
                  <div key={event.id} className="group relative bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest mb-2 inline-block",
                          event.type === 'holiday' ? "bg-rose-100 text-rose-600" :
                          event.type === 'deadline' ? "bg-amber-100 text-amber-600" :
                          "bg-indigo-100 text-indigo-600"
                        )}>
                          {event.type}
                        </span>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{event.title}</h4>
                        <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-slate-400">
                          <Clock size={12} />
                          <span>{format(new Date(event.startDate), 'd MMM yyyy, HH:mm')}</span>
                        </div>
                      </div>
                      {(profile?.role === 'admin' || profile?.uid === event.createdBy) && (
                        <button 
                          onClick={() => handleDeleteEvent(event.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
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
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Tambah Acara Baru</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddEvent} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Judul Acara</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                    placeholder="Contoh: Rapat Pleno Guru"
                    value={newEvent.title || ''}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={newEvent.type}
                      onChange={e => setNewEvent({...newEvent, type: e.target.value as any})}
                    >
                      <option value="event">Acara Umum</option>
                      <option value="deadline">Tenggat Waktu</option>
                      <option value="holiday">Hari Libur</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Mulai</label>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white"
                      value={newEvent.startDate}
                      onChange={e => setNewEvent({...newEvent, startDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deskripsi (Opsional)</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-900 dark:text-white min-h-[100px]"
                    placeholder="Tambahkan detail acara..."
                    value={newEvent.description || ''}
                    onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all mt-4"
                >
                  Simpan Acara
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
