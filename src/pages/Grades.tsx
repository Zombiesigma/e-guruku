import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, addDoc, where, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Grade, ClassInfo } from '../types';
import { Save, Search, Filter, BookOpen, FileDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MySwal = withReactContent(Swal);

export const GradesModule: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [grades, setGrades] = useState<Record<string, Grade>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('Matematika');
  const [gradeType, setGradeType] = useState<Grade['type']>('harian');

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
      const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(studentsData);

      const q = query(
        collection(db, 'grades'), 
        where('subjectId', '==', subject),
        where('type', '==', gradeType)
      );
      const gradeSnap = await getDocs(q);
      const gradeData: Record<string, Grade> = {};
      gradeSnap.docs.forEach(d => {
        const data = d.data() as Grade;
        gradeData[data.studentId] = { id: d.id, ...data };
      });
      setGrades(gradeData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'grades');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [subject, gradeType]);

  const handleScoreChange = (studentId: string, score: number) => {
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        studentId,
        subjectId: subject,
        type: gradeType,
        score,
        classId: students.find(s => s.id === studentId)?.classId || 'default',
        date: new Date().toISOString().split('T')[0]
      } as Grade
    }));
  };

  const saveGrades = async () => {
    setSaving(true);
    try {
      const promises = Object.values(grades).map(async (g: Grade) => {
        if (g.id) {
          return setDoc(doc(db, 'grades', g.id), {
            ...g,
            updatedAt: serverTimestamp()
          });
        } else {
          const { id: _, ...gradeData } = g as any;
          return addDoc(collection(db, 'grades'), {
            ...gradeData,
            createdBy: profile?.uid,
            createdAt: serverTimestamp()
          });
        }
      });
      await Promise.all(promises);
      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Nilai berhasil disimpan.',
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s => s.classId === selectedClassId);

  const exportToPDF = () => {
    const doc = new jsPDF();
    const className = classes.find(c => c.id === selectedClassId)?.name || 'Kelas';
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('E-GURUKU', 105, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('LAPORAN REKAP NILAI SISWA', 105, 30, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.line(14, 35, 196, 35);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`Kelas: ${className}`, 14, 45);
    doc.text(`Mata Pelajaran: ${subject}`, 14, 50);
    doc.text(`Tipe Nilai: ${gradeType.toUpperCase()}`, 14, 55);
    doc.text(`Tanggal Cetak: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 196, 45, { align: 'right' });
    
    const tableData = filteredStudents.map((s, idx) => [
      idx + 1,
      s.name,
      s.nisn,
      grades[s.id]?.score || '-',
      grades[s.id]?.notes || '-'
    ]);

    autoTable(doc, {
      head: [['No', 'Nama Siswa', 'NISN', 'Nilai', 'Catatan']],
      body: tableData,
      startY: 65,
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 65;
    doc.setFontSize(10);
    doc.text('Mengetahui,', 150, finalY + 20);
    doc.text('Wali Kelas', 150, finalY + 40);
    doc.text('____________________', 150, finalY + 45);

    doc.save(`Rekap_Nilai_${className}_${subject}.pdf`);
  };

  const exportToExcel = () => {
    const className = classes.find(c => c.id === selectedClassId)?.name || 'Kelas';
    const data = filteredStudents.map(s => ({
      'Nama Siswa': s.name,
      'NISN': s.nisn,
      'Nilai': grades[s.id]?.score || '-',
      'Catatan': grades[s.id]?.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai");
    XLSX.writeFile(wb, `Nilai_${className}_${subject}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Penilaian Akademik</h2>
          <p className="text-slate-500 dark:text-slate-400">Input dan kelola nilai mata pelajaran siswa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
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
          <select 
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          >
            <option>Matematika</option>
            <option>Bahasa Indonesia</option>
            <option>Bahasa Inggris</option>
            <option>IPA</option>
            <option>IPS</option>
          </select>
          <select 
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-700 dark:text-slate-300"
            value={gradeType}
            onChange={e => setGradeType(e.target.value as Grade['type'])}
          >
            <option value="harian">Harian</option>
            <option value="tugas">Tugas</option>
            <option value="uts">UTS</option>
            <option value="uas">UAS</option>
          </select>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Siswa</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Nilai (0-100)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">Memuat data...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-400">Tidak ada data siswa di kelas ini.</td></tr>
              ) : filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 font-black text-sm border-2 border-white dark:border-slate-800 shadow-sm">
                        {student.name.charAt(0)}
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white">{student.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      min="0" 
                      max="100"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 font-black text-indigo-600 dark:text-indigo-400"
                      value={grades[student.id]?.score || ''}
                      onChange={e => handleScoreChange(student.id, Number(e.target.value))}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      placeholder="Tambahkan catatan..."
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-600 dark:text-slate-400"
                      value={grades[student.id]?.notes || ''}
                      onChange={e => setGrades(prev => ({
                        ...prev,
                        [student.id]: { ...(prev[student.id] || {}), notes: e.target.value } as Grade
                      }))}
                    />
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
            <div className="p-10 text-center text-slate-400">Tidak ada data siswa di kelas ini.</div>
          ) : filteredStudents.map((student) => (
            <div key={student.id} className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400 font-black text-lg border-2 border-white dark:border-slate-800 shadow-sm">
                  {student.name.charAt(0)}
                </div>
                <p className="font-black text-slate-900 dark:text-white">{student.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nilai</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-black text-indigo-600 dark:text-indigo-400 text-center text-lg"
                    value={grades[student.id]?.score || ''}
                    onChange={e => handleScoreChange(student.id, Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Catatan</label>
                  <input 
                    type="text" 
                    placeholder="..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-600 dark:text-slate-400 h-[52px]"
                    value={grades[student.id]?.notes || ''}
                    onChange={e => setGrades(prev => ({
                      ...prev,
                      [student.id]: { ...(prev[student.id] || {}), notes: e.target.value } as Grade
                    }))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button 
            onClick={saveGrades}
            disabled={saving || loading}
            className="flex items-center justify-center gap-2 w-full lg:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Menyimpan...' : 'Simpan Nilai'}
          </button>
        </div>
      </div>
    </div>
  );
};
