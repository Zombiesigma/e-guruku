import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, serverTimestamp, deleteDoc, doc, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Behavior, ClassInfo } from '../types';
import { Plus, Trash2, Award, AlertTriangle, Search, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const BehaviorModule: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBehavior, setNewBehavior] = useState<Partial<Behavior>>({ type: 'reward', points: 0 });
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch classes
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classesData = classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClassInfo));
      setClasses(classesData);
      
      if (classesData.length > 0 && !selectedClassId) {
        setSelectedClassId(classesData[0].id);
      }

      const studentsSnap = await getDocs(collection(db, 'students'));
      setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));

      const behaviorSnap = await getDocs(collection(db, 'behaviors'));
      setBehaviors(behaviorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Behavior)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'behaviors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBehavior.studentId || !newBehavior.title) return;

    try {
      await addDoc(collection(db, 'behaviors'), {
        ...newBehavior,
        date: new Date().toISOString().split('T')[0],
        createdBy: profile?.uid,
        createdAt: serverTimestamp()
      });
      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Catatan perilaku telah disimpan.',
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
      });
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'behaviors');
    }
  };

  const handleDelete = async (behavior: Behavior) => {
    const result = await MySwal.fire({
      title: 'Hapus Catatan?',
      text: 'Catatan perilaku ini akan dihapus permanen.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'behaviors', behavior.id));
        MySwal.fire({
          title: 'Terhapus!',
          text: 'Catatan telah dihapus.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `behaviors/${behavior.id}`);
      }
    }
  };

  const getStudentName = (id: string) => students.find(s => s.id === id)?.name || 'Siswa tidak ditemukan';

  const filteredStudents = students.filter(s => s.classId === selectedClassId);
  const filteredBehaviors = behaviors.filter(b => {
    const student = students.find(s => s.id === b.studentId);
    return student?.classId === selectedClassId && (
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      student?.name.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Poin Perilaku</h2>
          <p className="text-slate-500 dark:text-slate-400">Pantau prestasi dan pelanggaran siswa secara real-time.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm w-full sm:w-auto">
            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400 ml-2" />
            <select 
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-300 pr-8"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>Tambah Catatan</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari catatan perilaku atau nama siswa..." 
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[1.5rem] shadow-sm focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-slate-900 dark:text-white"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Memuat data...</div>
            ) : filteredBehaviors.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Belum ada catatan perilaku di kelas ini.</div>
            ) : filteredBehaviors.map((b) => (
              <div key={b.id} className="bg-white dark:bg-slate-800 p-5 lg:p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm flex items-start justify-between gap-4 group">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-lg",
                    b.type === 'reward' ? "bg-emerald-500 text-white shadow-emerald-100 dark:shadow-none" : "bg-rose-500 text-white shadow-rose-100 dark:shadow-none"
                  )}>
                    {b.type === 'reward' ? <Award size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white leading-tight">{b.title}</h4>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">{getStudentName(b.studentId)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{b.date}</span>
                    </div>
                    {b.description && <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-3 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-700">{b.description}</p>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm",
                    b.type === 'reward' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                  )}>
                    {b.type === 'reward' ? '+' : '-'}{b.points} Pts
                  </span>
                  <button 
                    onClick={() => handleDelete(b)}
                    className="p-2 text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 lg:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm h-fit lg:sticky lg:top-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Top Prestasi</h3>
            <Award className="text-amber-500" size={24} />
          </div>
          <div className="space-y-6">
            {filteredStudents.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs border-2 border-white dark:border-slate-800 shadow-sm",
                    i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-slate-300 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-600"
                  )}>
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm border-2 border-white dark:border-slate-800 shadow-sm">
                      {s.name.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all">{s.name}</span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">120 Pts</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
            Lihat Papan Skor Lengkap
          </button>
        </div>
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Tambah Catatan Perilaku</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Pilih Siswa</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={newBehavior.studentId || ''}
                    onChange={e => setNewBehavior({...newBehavior, studentId: e.target.value})}
                  >
                    <option value="">Pilih Siswa...</option>
                    {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tipe</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={newBehavior.type}
                      onChange={e => setNewBehavior({...newBehavior, type: e.target.value as 'reward' | 'violation'})}
                    >
                      <option value="reward">Prestasi (Reward)</option>
                      <option value="violation">Pelanggaran (Violation)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Poin</label>
                    <input 
                      type="number" 
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={newBehavior.points || ''}
                      onChange={e => setNewBehavior({...newBehavior, points: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Judul / Alasan</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Menang Lomba Matematika"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={newBehavior.title || ''}
                    onChange={e => setNewBehavior({...newBehavior, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Keterangan Tambahan</label>
                  <textarea 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 h-24 text-slate-900 dark:text-white"
                    value={newBehavior.description || ''}
                    onChange={e => setNewBehavior({...newBehavior, description: e.target.value})}
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
