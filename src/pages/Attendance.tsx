import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, where, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Attendance, ClassInfo } from '../types';
import { Check, X, Clock, Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, FileDown, BookOpen } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const AttendanceModule: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const dateStr = format(currentDate, 'yyyy-MM-dd');

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

      // Fetch students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(studentsData);

      // Fetch attendances for current date
      const q = query(collection(db, 'attendances'), where('date', '==', dateStr));
      const attendanceSnap = await getDocs(q);
      const attendanceData: Record<string, Attendance> = {};
      attendanceSnap.docs.forEach(d => {
        const data = d.data() as Attendance;
        attendanceData[data.studentId] = { id: d.id, ...data };
      });
      setAttendances(attendanceData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'attendances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateStr]);

  const handleStatusChange = (studentId: string, status: Attendance['status']) => {
    setAttendances(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        studentId,
        date: dateStr,
        status,
        classId: students.find(s => s.id === studentId)?.classId || 'default'
      } as Attendance
    }));
  };

  const handleMarkAllPresent = () => {
    const newAttendances = { ...attendances };
    filteredStudents.forEach(student => {
      newAttendances[student.id] = {
        ...(newAttendances[student.id] || {}),
        studentId: student.id,
        date: dateStr,
        status: 'hadir',
        classId: selectedClassId
      } as Attendance;
    });
    setAttendances(newAttendances);
    
    MySwal.fire({
      icon: 'success',
      title: 'Hadir Semua!',
      text: `Semua siswa di kelas ini telah ditandai Hadir.`,
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
    });
  };

  const handleMarkAllAbsent = () => {
    const newAttendances = { ...attendances };
    let count = 0;
    filteredStudents.forEach(student => {
      if (!newAttendances[student.id]?.status) {
        newAttendances[student.id] = {
          ...(newAttendances[student.id] || {}),
          studentId: student.id,
          date: dateStr,
          status: 'alpa',
          classId: selectedClassId
        } as Attendance;
        count++;
      }
    });
    setAttendances(newAttendances);
    
    MySwal.fire({
      icon: 'info',
      title: 'Alpa Semua!',
      text: `${count} siswa yang belum absen telah ditandai Alpa.`,
      timer: 1500,
      showConfirmButton: false,
      toast: true,
      position: 'top-end',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
      color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
    });
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const promises = Object.values(attendances).map(async (att: Attendance) => {
        if (att.id) {
          return setDoc(doc(db, 'attendances', att.id), {
            ...att,
            updatedAt: serverTimestamp()
          });
        } else {
          const { id: _, ...attData } = att as any;
          return addDoc(collection(db, 'attendances'), {
            ...attData,
            createdBy: profile?.uid,
            createdAt: serverTimestamp()
          });
        }
      });
      await Promise.all(promises);
      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Data absensi telah disimpan.',
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendances');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => s.classId === selectedClassId);
  const displayedStudents = filteredStudents.filter(s => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'none') return !attendances[s.id]?.status;
    return attendances[s.id]?.status === statusFilter;
  });

  const exportToPDF = () => {
    const doc = new jsPDF();
    const className = classes.find(c => c.id === selectedClassId)?.name || 'Kelas';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('E-GURUKU', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('LAPORAN REKAP ABSENSI SISWA', 105, 30, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(14, 35, 196, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Kelas: ${className}`, 14, 45);
    doc.text(`Tanggal: ${format(currentDate, 'dd MMMM yyyy', { locale: id })}`, 14, 50);
    doc.text(`Tanggal Cetak: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 196, 45, { align: 'right' });
    
    const tableData = filteredStudents.map((s, idx) => [
      idx + 1,
      s.name,
      s.nisn,
      attendances[s.id]?.status?.toUpperCase() || 'BELUM ABSEN'
    ]);

    autoTable(doc, {
      head: [['No', 'Nama Siswa', 'NISN', 'Status Kehadiran']],
      body: tableData,
      startY: 60,
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;
    doc.setFontSize(10);
    doc.text('Mengetahui,', 150, finalY + 20);
    doc.text('Wali Kelas', 150, finalY + 40);
    doc.text('____________________', 150, finalY + 45);

    doc.save(`Rekap_Absensi_${className}_${dateStr}.pdf`);
  };

  const exportToExcel = () => {
    const className = classes.find(c => c.id === selectedClassId)?.name || 'Kelas';
    const data = filteredStudents.map(s => ({
      'Nama Siswa': s.name,
      'NISN': s.nisn,
      'Status': attendances[s.id]?.status || 'Belum Absen'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Absensi_${className}_${dateStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Absensi Harian</h2>
          <p className="text-slate-500 dark:text-slate-400">Catat kehadiran siswa setiap hari dengan mudah.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToPDF}
              className="p-2 text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl hover:bg-rose-100 transition-all"
              title="Export PDF"
            >
              <FileDown size={20} />
            </button>
            <button 
              onClick={exportToExcel}
              className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:bg-emerald-100 transition-all"
              title="Export Excel"
            >
              <FileDown size={20} />
            </button>
          </div>
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
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm w-full sm:w-auto">
            <Check size={18} className="text-indigo-600 dark:text-indigo-400 ml-2" />
            <select 
              className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-300 pr-8"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Semua Status</option>
              <option value="none">Belum Absen</option>
              <option value="hadir">Hadir</option>
              <option value="sakit">Sakit</option>
              <option value="izin">Izin</option>
              <option value="alpa">Alpa</option>
            </select>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm w-full sm:w-auto justify-between">
            <button 
              onClick={() => setCurrentDate(subDays(currentDate, 1))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 px-2 font-bold text-slate-700 dark:text-slate-200">
              <CalendarIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs sm:text-sm">{format(currentDate, 'EEEE, d MMMM yyyy', { locale: id })}</span>
            </div>
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, 1))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-600 dark:text-slate-400"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Hadir</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sakit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Izin</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Alpa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Memuat data siswa...</td></tr>
              ) : displayedStudents.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">Tidak ada data siswa yang sesuai filter.</td></tr>
              ) : displayedStudents.map((student) => {
                const currentStatus = attendances[student.id]?.status;
                return (
                  <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 font-black text-sm border-2 border-white dark:border-slate-800 shadow-sm">
                          {student.name.charAt(0)}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white">{student.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleStatusChange(student.id, 'hadir')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all",
                          currentStatus === 'hadir' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-none" : "bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        <Check size={20} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleStatusChange(student.id, 'sakit')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all",
                          currentStatus === 'sakit' ? "bg-amber-500 text-white shadow-lg shadow-amber-100 dark:shadow-none" : "bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        <Clock size={20} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleStatusChange(student.id, 'izin')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all",
                          currentStatus === 'izin' ? "bg-blue-500 text-white shadow-lg shadow-blue-100 dark:shadow-none" : "bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        <FileDown size={20} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleStatusChange(student.id, 'alpa')}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all",
                          currentStatus === 'alpa' ? "bg-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-none" : "bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                        )}
                      >
                        <X size={20} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {loading ? (
            <div className="p-10 text-center text-slate-400">Memuat data siswa...</div>
          ) : displayedStudents.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Tidak ada data siswa yang sesuai filter.</div>
          ) : displayedStudents.map((student) => {
            const currentStatus = attendances[student.id]?.status;
            return (
              <div key={student.id} className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 font-black text-lg border-2 border-white dark:border-slate-800 shadow-sm">
                    {student.name.charAt(0)}
                  </div>
                  <p className="font-black text-slate-900 dark:text-white">{student.name}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'hadir', label: 'Hadir', icon: Check, color: 'emerald' },
                    { id: 'sakit', label: 'Sakit', icon: Clock, color: 'amber' },
                    { id: 'izin', label: 'Izin', icon: FileDown, color: 'blue' },
                    { id: 'alpa', label: 'Alpa', icon: X, color: 'rose' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      onClick={() => handleStatusChange(student.id, btn.id as any)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all border-2",
                        currentStatus === btn.id 
                          ? `bg-${btn.color}-500 border-${btn.color}-500 text-white shadow-lg shadow-${btn.color}-100 dark:shadow-none` 
                          : "bg-slate-50 dark:bg-slate-900 border-transparent text-slate-400 dark:text-slate-600"
                      )}
                    >
                      <btn.icon size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-end gap-4">
          <button 
            onClick={handleMarkAllPresent}
            disabled={loading || filteredStudents.length === 0}
            className="flex items-center justify-center gap-2 w-full lg:w-auto px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-100 dark:shadow-none transition-all disabled:opacity-50"
          >
            <Check size={20} />
            Hadir Semua
          </button>
          <button 
            onClick={handleMarkAllAbsent}
            disabled={loading || filteredStudents.length === 0}
            className="flex items-center justify-center gap-2 w-full lg:w-auto px-8 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 shadow-xl shadow-rose-100 dark:shadow-none transition-all disabled:opacity-50"
          >
            <X size={20} />
            Tidak Hadir Semua
          </button>
          <button 
            onClick={saveAttendance}
            disabled={saving || loading}
            className="flex items-center justify-center gap-2 w-full lg:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Menyimpan...' : 'Simpan Absensi'}
          </button>
        </div>
      </div>
    </div>
  );
};
