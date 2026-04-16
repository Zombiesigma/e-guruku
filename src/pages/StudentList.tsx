import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, ClassInfo, Attendance, Grade, Behavior } from '../types';
import { Plus, Search, MoreVertical, Edit2, Trash2, UserPlus, FileDown, FileUp, X, BookOpen, User, Calendar, GraduationCap, Award, ChevronRight, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import * as XLSX from 'xlsx';

const MySwal = withReactContent(Swal);

export const StudentList: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [extraFilter, setExtraFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Partial<Student> | null>(null);
  const [studentDetails, setStudentDetails] = useState<{
    attendance: Attendance[];
    grades: Grade[];
    behaviors: Behavior[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const studentSnap = await getDocs(query(collection(db, 'students')));
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));

      const classSnap = await getDocs(query(collection(db, 'classes')));
      setClasses(classSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassInfo)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent?.name || !currentStudent?.nisn) return;

    try {
      if (currentStudent.id) {
        const docRef = doc(db, 'students', currentStudent.id);
        await updateDoc(docRef, { ...currentStudent });
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Data siswa telah diperbarui.',
          timer: 2000,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
      } else {
        await addDoc(collection(db, 'students'), {
          ...currentStudent,
          isActive: true,
          createdAt: serverTimestamp()
        });
        MySwal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: 'Siswa baru telah ditambahkan.',
          timer: 2000,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      handleFirestoreError(error, currentStudent.id ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const handleDelete = async (student: Student) => {
    const result = await MySwal.fire({
      title: 'Apakah Anda yakin?',
      text: `Data siswa ${student.name} akan dihapus permanen!`,
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
        await deleteDoc(doc(db, 'students', student.id));
        MySwal.fire({
          title: 'Terhapus!',
          text: 'Data siswa telah dihapus.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
        fetchData();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `students/${student.id}`);
      }
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const validData = data.filter(item => item.Nama && item.NISN);
        
        if (validData.length === 0) {
          throw new Error("Format file tidak sesuai atau data kosong. Pastikan ada kolom 'Nama' dan 'NISN'.");
        }

        const result = await MySwal.fire({
          title: 'Konfirmasi Impor',
          text: `Ditemukan ${validData.length} data siswa. Lanjutkan impor?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Ya, Impor!',
          cancelButtonText: 'Batal',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });

        if (result.isConfirmed) {
          const promises = validData.map(item => {
            return addDoc(collection(db, 'students'), {
              name: item.Nama,
              nisn: String(item.NISN),
              gender: item.Gender === 'P' ? 'P' : 'L',
              classId: selectedClassId === 'all' ? '' : selectedClassId,
              isActive: true,
              createdAt: serverTimestamp()
            });
          });

          await Promise.all(promises);
          
          MySwal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: `${validData.length} siswa telah diimpor.`,
            timer: 2000,
            showConfirmButton: false,
            background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
            color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
          });
          fetchData();
        }
      } catch (error: any) {
        MySwal.fire({
          icon: 'error',
          title: 'Gagal Impor',
          text: error.message || 'Terjadi kesalahan saat membaca file.',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
          color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
        });
      } finally {
        setImporting(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const getClassName = (id?: string) => {
    if (!id) return 'Belum ada kelas';
    return classes.find(c => c.id === id)?.name || 'Kelas tidak ditemukan';
  };

  const fetchStudentDetails = async (student: Student) => {
    setDetailLoading(true);
    setCurrentStudent(student);
    setIsDetailOpen(true);
    try {
      const attendanceQuery = query(
        collection(db, 'attendances'),
        where('studentId', '==', student.id),
        orderBy('date', 'desc'),
        limit(10)
      );
      const gradesQuery = query(
        collection(db, 'grades'),
        where('studentId', '==', student.id),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const behaviorsQuery = query(
        collection(db, 'behaviors'),
        where('studentId', '==', student.id),
        orderBy('date', 'desc'),
        limit(10)
      );

      const [attendanceSnap, gradesSnap, behaviorsSnap] = await Promise.all([
        getDocs(attendanceQuery),
        getDocs(gradesQuery),
        getDocs(behaviorsQuery)
      ]);

      setStudentDetails({
        attendance: attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)),
        grades: gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)),
        behaviors: behaviorsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Behavior))
      });
    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.nisn.includes(search);
    const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? s.isActive : !s.isActive);
    const matchesExtra = extraFilter === 'all' || s.extracurricular === extraFilter;
    return matchesSearch && matchesClass && matchesStatus && matchesExtra;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Data Siswa</h2>
          <p className="text-slate-500 dark:text-slate-400">Kelola informasi lengkap siswa di kelas Anda.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer">
            <FileUp size={18} />
            <span>{importing ? 'Memproses...' : 'Impor Excel'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleImportExcel}
              disabled={importing}
            />
          </label>
          <button 
            onClick={() => {
              setCurrentStudent({ gender: 'L', isActive: true });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
          >
            <Plus size={18} />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari nama atau NISN..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 w-full sm:w-auto">
              <BookOpen size={16} className="text-indigo-600 dark:text-indigo-400 ml-2" />
              <select 
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 dark:text-slate-300 pr-8"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                <option value="all">Semua Kelas</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 w-full sm:w-auto">
              <select 
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 dark:text-slate-300 pr-8"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Non-Aktif</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 w-full sm:w-auto">
              <select 
                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 dark:text-slate-300 pr-8"
                value={extraFilter}
                onChange={(e) => setExtraFilter(e.target.value)}
              >
                <option value="all">Semua Ekskul</option>
                <option value="Pramuka">Pramuka</option>
                <option value="PMR">PMR</option>
                <option value="Paskibra">Paskibra</option>
                <option value="Seni">Seni</option>
                <option value="Olahraga">Olahraga</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>{filteredStudents.length} Siswa ditemukan</span>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">NISN</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Memuat data...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Tidak ada data siswa.</td></tr>
              ) : filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all group">
                  <td className="px-6 py-4">
                    <div 
                      className="flex items-center gap-3 cursor-pointer group/name"
                      onClick={() => fetchStudentDetails(student)}
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm border-2 border-white dark:border-slate-800 shadow-sm group-hover/name:scale-110 transition-all">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white leading-tight group-hover/name:text-indigo-600 dark:group-hover/name:text-indigo-400 transition-all">{student.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <BookOpen size={10} className="text-indigo-500" />
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getClassName(student.classId)}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 font-mono">{student.nisn}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      student.gender === 'L' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400"
                    )}>
                      {student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      student.isActive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                    )}>
                      {student.isActive ? 'Aktif' : 'Non-aktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => { setCurrentStudent(student); setIsModalOpen(true); }}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(student)}
                        className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {loading ? (
            <div className="p-10 text-center text-slate-400">Memuat data...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Tidak ada data siswa.</div>
          ) : filteredStudents.map((student) => (
            <div key={student.id} className="p-6 flex items-center justify-between gap-4 active:bg-slate-50 dark:active:bg-slate-900 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-lg border-2 border-white dark:border-slate-800 shadow-sm">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white leading-tight">{student.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{student.nisn}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      student.gender === 'L' ? "text-blue-600 dark:text-blue-400" : "text-pink-600 dark:text-pink-400"
                    )}>{student.gender}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setCurrentStudent(student); setIsModalOpen(true); }}
                  className="w-10 h-10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(student)}
                  className="w-10 h-10 flex items-center justify-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none">
                    {currentStudent?.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{currentStudent?.name}</h3>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400">NISN: {currentStudent?.nisn} • {getClassName(currentStudent?.classId)}</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-3 text-slate-400 hover:bg-white dark:hover:bg-slate-700 rounded-2xl shadow-sm transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {detailLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Memuat Detail...</p>
                  </div>
                ) : (
                  <>
                    {/* Stats Overview */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <Calendar className="text-indigo-600 dark:text-indigo-400 mb-2" size={20} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kehadiran</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">98%</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <GraduationCap className="text-emerald-600 dark:text-emerald-400 mb-2" size={20} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rata-rata</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">85.5</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <Award className="text-amber-600 dark:text-amber-400 mb-2" size={20} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poin</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">120</p>
                      </div>
                    </div>

                    {/* Recent Activities */}
                    <div className="space-y-6">
                      <section>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Calendar size={14} /> Riwayat Absensi Terakhir
                        </h4>
                        <div className="space-y-2">
                          {studentDetails?.attendance.map(a => (
                            <div key={a.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm">
                              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{a.date}</span>
                              <span className={cn(
                                "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                a.status === 'hadir' ? "bg-emerald-50 text-emerald-600" : 
                                a.status === 'sakit' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                              )}>{a.status}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <GraduationCap size={14} /> Nilai Akademik
                        </h4>
                        <div className="space-y-2">
                          {studentDetails?.grades.map(g => (
                            <div key={g.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm">
                              <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{g.subjectId}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{g.type}</p>
                              </div>
                              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{g.score}</span>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                          <Award size={14} /> Catatan Perilaku
                        </h4>
                        <div className="space-y-2">
                          {studentDetails?.behaviors.map(b => (
                            <div key={b.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-sm">
                              <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{b.title}</p>
                                <p className="text-[10px] font-bold text-slate-400">{b.date}</p>
                              </div>
                              <span className={cn(
                                "text-sm font-black",
                                b.type === 'reward' ? "text-emerald-600" : "text-rose-600"
                              )}>{b.type === 'reward' ? '+' : '-'}{b.points}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentStudent?.id ? 'Edit Siswa' : 'Tambah Siswa Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={currentStudent?.name || ''}
                      onChange={e => setCurrentStudent({...currentStudent, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">NISN</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={currentStudent?.nisn || ''}
                      onChange={e => setCurrentStudent({...currentStudent, nisn: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Jenis Kelamin</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={currentStudent?.gender || 'L'}
                      onChange={e => setCurrentStudent({...currentStudent, gender: e.target.value as 'L' | 'P'})}
                    >
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Kelas</label>
                    <select 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={currentStudent?.classId || ''}
                      onChange={e => setCurrentStudent({...currentStudent, classId: e.target.value})}
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name} ({cls.academicYear})</option>
                      ))}
                    </select>
                  </div>
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
