import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, where, serverTimestamp, orderBy, updateDoc, doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Check, Trash2, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Swal from 'sweetalert2';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  status: 'unread' | 'read';
  createdAt: any;
}

export const NotificationsPage: React.FC = () => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), {
        status: 'read'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => n.status === 'unread');
    try {
      const promises = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { status: 'read' }));
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications');
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'success': return <CheckCircle className="text-emerald-500" size={20} />;
      case 'error': return <XCircle className="text-rose-500" size={20} />;
      default: return <Info className="text-indigo-500" size={20} />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Notifikasi</h2>
          <p className="text-slate-500 dark:text-slate-400">Pembaruan sistem dan pengumuman untuk Anda.</p>
        </div>
        {notifications.some(n => n.status === 'unread') && (
          <button 
            onClick={markAllAsRead}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-all flex items-center gap-1"
          >
            <Check size={14} />
            Tandai semua dibaca
          </button>
        )}
      </header>

      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Memuat Notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-12 text-center border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Bell size={40} className="text-slate-200" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tidak ada notifikasi</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Anda sudah up-to-date dengan semua informasi.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "group relative bg-white dark:bg-slate-800 p-5 rounded-3xl border transition-all shadow-sm flex gap-4",
                  n.status === 'unread' ? "border-indigo-100 dark:border-indigo-900/30 ring-1 ring-indigo-50 dark:ring-indigo-900/10" : "border-slate-100 dark:border-slate-700 opacity-80"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  n.type === 'info' ? "bg-indigo-50 text-indigo-600" :
                  n.type === 'warning' ? "bg-amber-50 text-amber-600" :
                  n.type === 'success' ? "bg-emerald-50 text-emerald-600" :
                  "bg-rose-50 text-rose-600"
                )}>
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                      "font-bold text-slate-900 dark:text-white leading-tight",
                      n.status === 'unread' ? "text-base" : "text-sm"
                    )}>{n.title}</h4>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'HH:mm', { locale: id }) : 'Baru saja'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-4 mt-3">
                    {n.status === 'unread' && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700"
                      >
                        Tandai Dibaca
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
                {n.status === 'unread' && (
                  <div className="absolute top-5 right-5 w-2 h-2 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
