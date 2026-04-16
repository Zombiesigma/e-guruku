import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type NotificationType = 'info' | 'warning' | 'success' | 'error';

export const sendNotification = async (userId: string, title: string, message: string, type: NotificationType = 'info') => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      status: 'unread',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

export const broadcastNotification = async (userIds: string[], title: string, message: string, type: NotificationType = 'info') => {
  const promises = userIds.map(uid => sendNotification(uid, title, message, type));
  await Promise.all(promises);
};
