import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Attendance, Grade, ClassInfo, Behavior } from '../types';
import { FileText, Download, Printer, FileSpreadsheet, BookOpen, Search, Filter, ShieldAlert } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '../lib/utils';

export const ReportsModule: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [studentsSnap, classesSnap, attendanceSnap, gradesSnap, behaviorSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'classes')),
          getDocs(collection(db, 'attendances')),
          getDocs(collection(db, 'grades')),
          getDocs(collection(db, 'behaviors'))
        ]);

        setStudents(studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClassInfo)));
        setAttendances(attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
        setGrades(gradesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Grade)));
        setBehaviors(behaviorSnap.docs.map(d => ({ id: d.id, ...d.data() } as Behavior)));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'reports');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredStudents = students.filter(s => selectedClassId === 'all' || s.classId === selectedClassId);
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || 'Semua Kelas';

  const exportStudentPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Laporan Data Siswa", 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Kelas: ${selectedClassName}`, 14, 25);
    doc.text(`Tanggal: ${format(new Date(), 'dd MMMM yyyy', { locale: localeId })}`, 14, 32);

    autoTable(doc, {
      startY: 40,
      head: [['No', 'Nama', 'NISN', 'Gender', 'Status']],
      body: filteredStudents.map((s, i) => [
        i + 1,
        s.name,
        s.nisn,
        s.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        s.isActive ? 'Aktif' : 'Non-aktif'
      ]),
      headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save(`Laporan_Siswa_${selectedClassName}.pdf`);
  };

  const exportAttendancePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Rekapitulasi Absensi Siswa", 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Kelas: ${selectedClassName}`, 14, 25);

    const tableData = filteredStudents.map((s, i) => {
      const studentAtt = attendances.filter(a => a.studentId === s.id);
      const hadir = studentAtt.filter(a => a.status === 'hadir').length;
      const sakit = studentAtt.filter(a => a.status === 'sakit').length;
      const izin = studentAtt.filter(a => a.status === 'izin').length;
      const alpa = studentAtt.filter(a => a.status === 'alpa').length;
      const total = studentAtt.length;
      const percent = total > 0 ? Math.round((hadir / total) * 100) : 0;

      return [i + 1, s.name, hadir, sakit, izin, alpa, `${percent}%`];
    });

    autoTable(doc, {
      startY: 40,
      head: [['No', 'Nama Siswa', 'H', 'S', 'I', 'A', '%']],
      body: tableData,
      headStyles: { fillColor: [245, 158, 11] }
    });
    doc.save(`Rekap_Absensi_${selectedClassName}.pdf`);
  };

  const exportGradesPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Rekapitulasi Nilai & Hasil Belajar", 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Kelas: ${selectedClassName}`, 14, 25);

    const tableData = filteredStudents.map((s, i) => {
      const studentGrades = grades.filter(g => g.studentId === s.id);
      
      // Calculate average by type
      const harian = studentGrades.filter(g => g.type === 'harian');
      const tugas = studentGrades.filter(g => g.type === 'tugas');
      const uts = studentGrades.find(g => g.type === 'uts')?.score || 0;
      const uas = studentGrades.find(g => g.type === 'uas')?.score || 0;

      const avgHarian = harian.length > 0 ? harian.reduce((acc, curr) => acc + curr.score, 0) / harian.length : 0;
      const avgTugas = tugas.length > 0 ? tugas.reduce((acc, curr) => acc + curr.score, 0) / tugas.length : 0;
      
      // Final Grade Formula: (Avg(Harian, Tugas) * 0.6) + (UTS * 0.2) + (UAS * 0.2)
      const processAvg = (avgHarian + avgTugas) / (avgHarian > 0 && avgTugas > 0 ? 2 : 1);
      const finalGrade = Math.round((processAvg * 0.6) + (uts * 0.2) + (uas * 0.2));

      return [
        i + 1, 
        s.name, 
        Math.round(avgHarian), 
        Math.round(avgTugas), 
        uts || '-', 
        uas || '-', 
        finalGrade || '-'
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['No', 'Nama Siswa', 'Harian', 'Tugas', 'UTS', 'UAS', 'NILAI AKHIR']],
      body: tableData,
      headStyles: { fillColor: [244, 63, 94] }
    });
    doc.save(`Rekap_Nilai_${selectedClassName}.pdf`);
  };

  const exportBehaviorPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Rekapitulasi Poin Perilaku Siswa", 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`Kelas: ${selectedClassName}`, 14, 25);

    const tableData = filteredStudents.map((s, i) => {
      const studentBeh = behaviors.filter(b => b.studentId === s.id);
      const rewards = studentBeh.filter(b => b.type === 'reward').reduce((acc, curr) => acc + curr.points, 0);
      const violations = studentBeh.filter(b => b.type === 'violation').reduce((acc, curr) => acc + curr.points, 0);
      const total = 100 + rewards - violations;

      return [i + 1, s.name, rewards, violations, total];
    });

    autoTable(doc, {
      startY: 40,
      head: [['No', 'Nama Siswa', 'Poin Reward', 'Poin Pelanggaran', 'Total Poin']],
      body: tableData,
      headStyles: { fillColor: [16, 185, 129] }
    });
    doc.save(`Rekap_Perilaku_${selectedClassName}.pdf`);
  };

  const exportToExcel = (type: 'siswa' | 'absensi' | 'nilai' | 'perilaku') => {
    let data: any[] = [];
    let fileName = "";

    if (type === 'siswa') {
      data = filteredStudents.map(s => ({
        Nama: s.name,
        NISN: s.nisn,
        Gender: s.gender === 'L' ? 'Laki-laki' : 'Perempuan',
        Status: s.isActive ? 'Aktif' : 'Non-aktif',
        Alamat: s.address || '-'
      }));
      fileName = `Laporan_Siswa_${selectedClassName}.xlsx`;
    } else if (type === 'absensi') {
      data = filteredStudents.map(s => {
        const studentAtt = attendances.filter(a => a.studentId === s.id);
        return {
          Nama: s.name,
          Hadir: studentAtt.filter(a => a.status === 'hadir').length,
          Sakit: studentAtt.filter(a => a.status === 'sakit').length,
          Izin: studentAtt.filter(a => a.status === 'izin').length,
          Alpa: studentAtt.filter(a => a.status === 'alpa').length,
          Persentase: `${studentAtt.length > 0 ? Math.round((studentAtt.filter(a => a.status === 'hadir').length / studentAtt.length) * 100) : 0}%`
        };
      });
      fileName = `Rekap_Absensi_${selectedClassName}.xlsx`;
    } else if (type === 'perilaku') {
      data = filteredStudents.map(s => {
        const studentBeh = behaviors.filter(b => b.studentId === s.id);
        const rewards = studentBeh.filter(b => b.type === 'reward').reduce((acc, curr) => acc + curr.points, 0);
        const violations = studentBeh.filter(b => b.type === 'violation').reduce((acc, curr) => acc + curr.points, 0);
        return {
          Nama: s.name,
          'Poin Reward': rewards,
          'Poin Pelanggaran': violations,
          'Total Poin': 100 + rewards - violations
        };
      });
      fileName = `Rekap_Perilaku_${selectedClassName}.xlsx`;
    } else {
      data = filteredStudents.map(s => {
        const studentGrades = grades.filter(g => g.studentId === s.id);
        const harian = studentGrades.filter(g => g.type === 'harian');
        const tugas = studentGrades.filter(g => g.type === 'tugas');
        const uts = studentGrades.find(g => g.type === 'uts')?.score || 0;
        const uas = studentGrades.find(g => g.type === 'uas')?.score || 0;
        const avgHarian = harian.length > 0 ? harian.reduce((acc, curr) => acc + curr.score, 0) / harian.length : 0;
        const avgTugas = tugas.length > 0 ? tugas.reduce((acc, curr) => acc + curr.score, 0) / tugas.length : 0;
        const processAvg = (avgHarian + avgTugas) / (avgHarian > 0 && avgTugas > 0 ? 2 : 1);
        const finalGrade = Math.round((processAvg * 0.6) + (uts * 0.2) + (uas * 0.2));

        return {
          Nama: s.name,
          'Rata Harian': Math.round(avgHarian),
          'Rata Tugas': Math.round(avgTugas),
          UTS: uts,
          UAS: uas,
          'NILAI AKHIR': finalGrade
        };
      });
      fileName = `Rekap_Nilai_${selectedClassName}.xlsx`;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Laporan & Ekspor</h2>
          <p className="text-slate-500 dark:text-slate-400">Unduh data administrasi dalam format PDF atau Excel.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <Filter size={18} className="text-slate-400 ml-2" />
          <select 
            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-300 pr-8"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="all">Semua Kelas</option>
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">Menyiapkan Data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Data Siswa */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm group"
          >
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <FileText size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Data Siswa</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Laporan lengkap biodata dan status siswa aktif/non-aktif.</p>
            <div className="flex gap-3">
              <button 
                onClick={exportStudentPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
              >
                <Printer size={14} />
                PDF
              </button>
              <button 
                onClick={() => exportToExcel('siswa')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
          </motion.div>

          {/* Rekap Absensi */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm group"
          >
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <Download size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Rekap Absensi</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Rekapitulasi kehadiran bulanan per siswa dan per kelas.</p>
            <div className="flex gap-3">
              <button 
                onClick={exportAttendancePDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 dark:shadow-none"
              >
                <Printer size={14} />
                PDF
              </button>
              <button 
                onClick={() => exportToExcel('absensi')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
          </motion.div>

          {/* Rekap Nilai */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm group"
          >
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <FileSpreadsheet size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Rekap Nilai</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Laporan nilai rata-rata dan perhitungan nilai akhir semester.</p>
            <div className="flex gap-3">
              <button 
                onClick={exportGradesPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 dark:shadow-none"
              >
                <Printer size={14} />
                PDF
              </button>
              <button 
                onClick={() => exportToExcel('nilai')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
          </motion.div>

          {/* Rekap Perilaku */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm group"
          >
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-3">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Rekap Perilaku</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Laporan poin reward dan pelanggaran tata tertib siswa.</p>
            <div className="flex gap-3">
              <button 
                onClick={exportBehaviorPDF}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <Printer size={14} />
                PDF
              </button>
              <button 
                onClick={() => exportToExcel('perilaku')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
