/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './components/MainLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { StudentList } from './pages/StudentList';
import { TeacherList } from './pages/TeacherList';
import { ClassList } from './pages/ClassList';
import { AttendanceModule } from './pages/Attendance';
import { GradesModule } from './pages/Grades';
import { BehaviorModule } from './pages/Behavior';
import { ReportsModule } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { CalendarPage } from './pages/Calendar';
import { NotificationsPage } from './pages/Notifications';
import { SchedulesPage } from './pages/Schedules';
import { GraduationCap } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white animate-bounce shadow-lg shadow-indigo-200">
          <GraduationCap size={32} />
        </div>
        <p className="mt-4 text-slate-500 font-medium animate-pulse">Memuat e-Guruku...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />;
      case 'students':
        return <StudentList />;
      case 'teachers':
        return <TeacherList />;
      case 'classes':
        return <ClassList />;
      case 'attendance':
        return <AttendanceModule />;
      case 'grades':
        return <GradesModule />;
      case 'behavior':
        return <BehaviorModule />;
      case 'reports':
        return <ReportsModule />;
      case 'calendar':
        return <CalendarPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'schedules':
        return <SchedulesPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </MainLayout>
  );
};


export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

