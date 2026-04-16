import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ClassInfo, UserProfile } from '../types';
import { Plus, Search, Edit2, Trash2, BookOpen, X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const ClassList: React.FC = () => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentClass, setCurrentClass] = useState<Partial<ClassInfo> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const classSnap = await getDocs(query(collection(db, 'classes')));
      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo)));

      const teacherSnap = await getDocs(query(collection(db, 'users')));
      setTeachers(teacherSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass?.name || !currentClass?.academicYear || !currentClass?.homeroomTeacherId) {
      MySwal.fire('Error', 'Semua field wajib diisi!', 'error');
      return;
    }

    try {
      if (currentClass.id) {
        await updateDoc(doc(db, 'classes', currentClass.id), { ...currentClass });
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Data kelas telah diperbarui.',
          timer: 2000,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
      } else {
        await addDoc(collection(db, 'classes'), {
          ...currentClass,
          createdAt: serverTimestamp()
        });
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Kelas baru telah ditambahkan.',
          timer: 2000,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, currentClass.id ? OperationType.UPDATE : OperationType.CREATE, 'classes');
    }
  };

  const handleDelete = async (cls: ClassInfo) => {
    const result = await MySwal.fire({
      title: 'Apakah Anda yakin?',
      text: `Data kelas ${cls.name} akan dihapus!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'classes', cls.id));
        MySwal.fire({
          title: 'Terhapus!',
          text: 'Data kelas telah dihapus.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `classes/${cls.id}`);
      }
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.academicYear.includes(search)
  );

  const getTeacherName = (id: string) => {
    return teachers.find(t => t.uid === id)?.fullName || 'Guru tidak ditemukan';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Kelas</h2>
          <p className="text-slate-500 dark:text-slate-400">Kelola daftar kelas dan wali kelas.</p>
        </div>
        <button 
          onClick={() => {
            setCurrentClass({ academicYear: '2023/2024' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
        >
          <Plus size={18} />
          <span>Tambah Kelas</span>
        </button>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama kelas atau tahun..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {loading ? (
            <div className="col-span-full py-10 text-center text-slate-400">Memuat data...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400">Tidak ada data kelas.</div>
          ) : filteredClasses.map((cls) => (
            <motion.div 
              key={cls.id}
              whileHover={{ y: -5 }}
              className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <BookOpen size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { setCurrentClass(cls); setIsModalOpen(true); }}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(cls)}
                    className="p-2 text-rose-600 dark:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">{cls.name}</h3>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">{cls.academicYear}</p>
              
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wali Kelas</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{getTeacherName(cls.homeroomTeacherId)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

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
              className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentClass?.id ? 'Edit Kelas' : 'Tambah Kelas Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Kelas</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: VII-A, X-IPA-1"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentClass?.name || ''}
                    onChange={e => setCurrentClass({...currentClass, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tahun Ajaran</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: 2023/2024"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentClass?.academicYear || ''}
                    onChange={e => setCurrentClass({...currentClass, academicYear: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Wali Kelas</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentClass?.homeroomTeacherId || ''}
                    onChange={e => setCurrentClass({...currentClass, homeroomTeacherId: e.target.value})}
                  >
                    <option value="">Pilih Wali Kelas</option>
                    {teachers.map(teacher => (
                      <option key={teacher.uid} value={teacher.uid}>{teacher.fullName}</option>
                    ))}
                  </select>
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
