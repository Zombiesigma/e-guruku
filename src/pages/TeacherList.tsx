import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserRole } from '../types';
import { Plus, Search, Edit2, Trash2, User as UserIcon, X, Mail, Shield, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const TeacherList: React.FC = () => {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTeacher, setCurrentTeacher] = useState<Partial<UserProfile & { password?: string }> | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all users with role other than admin (or all if admin wants to see everyone)
      const q = query(collection(db, 'users'), where('role', '!=', 'admin'));
      const querySnapshot = await getDocs(q);
      setTeachers(querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeacher?.fullName || !currentTeacher?.email || (!currentTeacher?.uid && !currentTeacher?.password)) {
      MySwal.fire('Error', 'Nama, Email, dan Password (untuk guru baru) wajib diisi!', 'error');
      return;
    }

    setSaving(true);
    try {
      if (currentTeacher.uid) {
        // Update existing profile
        const { password, ...updateData } = currentTeacher;
        await updateDoc(doc(db, 'users', currentTeacher.uid), updateData);
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Data guru telah diperbarui.',
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        // Create new user in Auth using a secondary app instance to avoid logging out admin
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          currentTeacher.email,
          currentTeacher.password!
        );
        
        const newUid = userCredential.user.uid;
        
        // Create profile in Firestore
        const { password, ...profileData } = currentTeacher;
        await addDoc(collection(db, 'users'), {
          ...profileData,
          uid: newUid,
          createdAt: serverTimestamp()
        });

        // Clean up secondary app
        await deleteApp(secondaryApp);

        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Guru baru telah didaftarkan.',
          timer: 2000,
          showConfirmButton: false,
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        MySwal.fire('Error', 'Email sudah terdaftar!', 'error');
      } else {
        handleFirestoreError(error, currentTeacher.uid ? OperationType.UPDATE : OperationType.CREATE, 'users');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teacher: UserProfile) => {
    const result = await MySwal.fire({
      title: 'Apakah Anda yakin?',
      text: `Data guru ${teacher.fullName} akan dihapus! (Catatan: Akun login tidak akan terhapus secara otomatis)`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#f43f5e',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
    });

    if (result.isConfirmed) {
      try {
        // Find the document by uid field or doc id
        const q = query(collection(db, 'users'), where('uid', '==', teacher.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await deleteDoc(doc(db, 'users', snap.docs[0].id));
        }
        
        MySwal.fire({
          title: 'Terhapus!',
          text: 'Data guru telah dihapus dari database.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
        });
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${teacher.uid}`);
      }
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.fullName.toLowerCase().includes(search.toLowerCase()) || 
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.nip?.includes(search)
  );

  const roles: { value: UserRole; label: string }[] = [
    { value: 'kepala_sekolah', label: 'Kepala Sekolah' },
    { value: 'guru', label: 'Guru Mata Pelajaran' },
    { value: 'wali_kelas', label: 'Wali Kelas' },
    { value: 'bp_bk', label: 'Guru BP/BK' },
    { value: 'tu', label: 'Tata Usaha' },
    { value: 'kurikulum', label: 'Kurikulum' },
    { value: 'humas', label: 'Humas' },
    { value: 'perpustakaan', label: 'Perpustakaan' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Guru & Staf</h2>
          <p className="text-slate-500 dark:text-slate-400">Kelola daftar pengajar dan staf sekolah.</p>
        </div>
        <button 
          onClick={() => {
            setCurrentTeacher({ role: 'guru' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
        >
          <Plus size={18} />
          <span>Tambah Guru</span>
        </button>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari nama, email, atau NIP..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {loading ? (
            <div className="col-span-full py-10 text-center text-slate-400">Memuat data...</div>
          ) : filteredTeachers.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400">Tidak ada data guru.</div>
          ) : filteredTeachers.map((teacher) => (
            <motion.div 
              key={teacher.uid}
              whileHover={{ y: -5 }}
              className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                  <UserIcon size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { setCurrentTeacher(teacher); setIsModalOpen(true); }}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(teacher)}
                    className="p-2 text-rose-600 dark:text-rose-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-sm"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">{teacher.fullName}</h3>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-4">
                {roles.find(r => r.value === teacher.role)?.label || teacher.role}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Mail size={14} />
                  <span className="truncate">{teacher.email}</span>
                </div>
                {teacher.nip && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Shield size={14} />
                    <span>NIP: {teacher.nip}</span>
                  </div>
                )}
                {teacher.workUnit && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Briefcase size={14} />
                    <span>{teacher.workUnit}</span>
                  </div>
                )}
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
                  {currentTeacher?.uid ? 'Edit Data Guru' : 'Daftarkan Guru Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentTeacher?.fullName || ''}
                    onChange={e => setCurrentTeacher({...currentTeacher, fullName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    disabled={!!currentTeacher?.uid}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-50"
                    value={currentTeacher?.email || ''}
                    onChange={e => setCurrentTeacher({...currentTeacher, email: e.target.value})}
                  />
                </div>
                {!currentTeacher?.uid && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={currentTeacher?.password || ''}
                      onChange={e => setCurrentTeacher({...currentTeacher, password: e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Jabatan / Peran</label>
                  <select 
                    required
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentTeacher?.role || ''}
                    onChange={e => setCurrentTeacher({...currentTeacher, role: e.target.value as UserRole})}
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">NIP (Opsional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentTeacher?.nip || ''}
                    onChange={e => setCurrentTeacher({...currentTeacher, nip: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Kerja (Opsional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={currentTeacher?.workUnit || ''}
                    onChange={e => setCurrentTeacher({...currentTeacher, workUnit: e.target.value})}
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
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                  >
                    {saving ? 'Proses...' : 'Simpan'}
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
