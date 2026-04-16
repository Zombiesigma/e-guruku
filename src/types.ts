export type UserRole = 'admin' | 'kepala_sekolah' | 'guru' | 'wali_kelas' | 'bp_bk' | 'tu' | 'kurikulum' | 'humas' | 'perpustakaan';

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  nip?: string;
  rank?: string;
  workUnit?: string;
  createdAt: any;
}

export interface Student {
  id: string;
  nisn: string;
  name: string;
  birthPlace?: string;
  birthDate?: string;
  gender: 'L' | 'P';
  parentName?: string;
  parentPhone?: string;
  address?: string;
  extracurricular?: string;
  photoUrl?: string;
  healthHistory?: string;
  height?: number;
  weight?: number;
  isActive: boolean;
  classId?: string;
  createdAt: any;
}

export interface ClassInfo {
  id: string;
  name: string;
  academicYear: string;
  homeroomTeacherId: string;
  createdAt: any;
}

export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: 'hadir' | 'sakit' | 'izin' | 'alpa';
  notes?: string;
  createdBy: string;
  createdAt: any;
}

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  type: 'harian' | 'tugas' | 'uts' | 'uas';
  score: number;
  notes?: string;
  date: string;
  createdBy: string;
}

export interface Behavior {
  id: string;
  studentId: string;
  type: 'reward' | 'violation';
  title: string;
  description?: string;
  points: number;
  date: string;
  createdBy: string;
}

export interface AdminMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  status: 'unread' | 'read';
  createdAt: any;
}
