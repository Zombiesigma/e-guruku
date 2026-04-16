import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Save, User, Shield, Bell, Palette, MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'message'>('profile');
  const [formData, setFormData] = useState({
    fullName: profile?.fullName || '',
    nip: profile?.nip || '',
    rank: profile?.rank || '',
    workUnit: profile?.workUnit || ''
  });
  const [messageData, setMessageData] = useState({
    subject: '',
    message: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), formData);
      MySwal.fire({
        icon: 'success',
        title: 'Berhasil!',
        text: 'Profil berhasil diperbarui.',
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid || !messageData.subject || !messageData.message) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'admin_messages'), {
        senderId: profile.uid,
        senderName: profile.fullName,
        senderEmail: profile.email,
        subject: messageData.subject,
        message: messageData.message,
        status: 'unread',
        createdAt: serverTimestamp()
      });
      MySwal.fire({
        icon: 'success',
        title: 'Terkirim!',
        text: 'Pesan Anda telah dikirim ke administrator.',
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff',
        color: document.documentElement.classList.contains('dark') ? '#f8fafc' : '#1e293b',
      });
      setMessageData({ subject: '', message: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'admin_messages');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pengaturan</h2>
        <p className="text-slate-500 dark:text-slate-400">Kelola profil dan preferensi aplikasi Anda.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all",
              activeTab === 'profile' 
                ? "bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <User size={20} />
            Profil Saya
          </button>
          <button 
            onClick={() => setActiveTab('message')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all",
              activeTab === 'message' 
                ? "bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800"
            )}
          >
            <MessageSquare size={20} />
            Pesan Admin
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-2xl font-medium transition-all">
            <Shield size={20} />
            Keamanan
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-2xl font-medium transition-all">
            <Bell size={20} />
            Notifikasi
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-2xl font-medium transition-all">
            <Palette size={20} />
            Tampilan
          </button>
        </div>

        <div className="md:col-span-2">
          <AnimatePresence mode="wait">
            {activeTab === 'profile' ? (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Informasi Profil</h3>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        value={formData.fullName}
                        onChange={e => setFormData({...formData, fullName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">NIP</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        value={formData.nip}
                        onChange={e => setFormData({...formData, nip: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Pangkat / Golongan</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        value={formData.rank}
                        onChange={e => setFormData({...formData, rank: e.target.value})}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Kerja</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        value={formData.workUnit}
                        onChange={e => setFormData({...formData, workUnit: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                    >
                      <Save size={20} />
                      {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div 
                key="message"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Kirim Pesan ke Admin</h3>
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Subjek</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: Masalah Login, Request Fitur"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                      value={messageData.subject}
                      onChange={e => setMessageData({...messageData, subject: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Pesan</label>
                    <textarea 
                      required
                      placeholder="Tuliskan pesan Anda di sini..."
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 h-40 text-slate-900 dark:text-white"
                      value={messageData.message}
                      onChange={e => setMessageData({...messageData, message: e.target.value})}
                    />
                  </div>
                  <div className="pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all disabled:opacity-50"
                    >
                      <Send size={20} />
                      {saving ? 'Mengirim...' : 'Kirim Pesan'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
