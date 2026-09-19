import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/common/ToastContainer';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar } from './components/layout/AppSidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

// Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AllObservationsPage } from './pages/observations/AllObservationsPage';
import { CreateObservationPage } from './pages/observations/CreateObservationPage';
import { MyObservationsPage } from './pages/observations/MyObservationsPage';
import { AllTasksPage } from './pages/tasks/AllTasksPage';
import { MyTasksPage } from './pages/tasks/MyTasksPage';
import { AwaitingReviewPage } from './pages/tasks/AwaitingReviewPage';
import { TrainingRecordsPage } from './pages/training/TrainingRecordsPage';
import { AddTrainingPage } from './pages/training/AddTrainingPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { LoginPage } from './pages/auth/LoginPage';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading Health & Safety...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <AppHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main>{children}</main>
        <MobileBottomNav />
      </div>
    </div>
  );
};

export const AppRoutes: React.FC = () => {
  const { isOfficer } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Main Authenticated Layout Routes */}
      <Route
        path="/"
        element={
          <MainLayout>
            <DashboardPage />
          </MainLayout>
        }
      />

      {/* Observations */}
      <Route
        path="/observations"
        element={
          <MainLayout>
            <AllObservationsPage />
          </MainLayout>
        }
      />
      <Route
        path="/observations/create"
        element={
          <MainLayout>
            <CreateObservationPage />
          </MainLayout>
        }
      />
      <Route
        path="/observations/personal"
        element={
          <MainLayout>
            <MyObservationsPage />
          </MainLayout>
        }
      />

      {/* Tasks */}
      <Route
        path="/tasks"
        element={
          <MainLayout>
            <AllTasksPage />
          </MainLayout>
        }
      />
      <Route
        path="/tasks/awaiting-review"
        element={
          <MainLayout>
            <AwaitingReviewPage />
          </MainLayout>
        }
      />
      <Route
        path="/tasks/rework"
        element={
          <MainLayout>
            <AllTasksPage />
          </MainLayout>
        }
      />
      <Route
        path="/tasks/overdue"
        element={
          <MainLayout>
            <AllTasksPage />
          </MainLayout>
        }
      />
      <Route
        path="/tasks/completed"
        element={
          <MainLayout>
            <AllTasksPage />
          </MainLayout>
        }
      />

      {/* Employee My Tasks */}
      <Route
        path="/my-tasks"
        element={
          <MainLayout>
            <MyTasksPage />
          </MainLayout>
        }
      />

      {/* Training */}
      <Route
        path="/training"
        element={
          <MainLayout>
            <TrainingRecordsPage />
          </MainLayout>
        }
      />
      <Route
        path="/training/add"
        element={
          <MainLayout>
            <AddTrainingPage />
          </MainLayout>
        }
      />

      {/* Reports & Audits */}
      <Route
        path="/reports"
        element={
          <MainLayout>
            <ReportsPage />
          </MainLayout>
        }
      />

      {/* Notifications */}
      <Route
        path="/notifications"
        element={
          <MainLayout>
            <NotificationsPage />
          </MainLayout>
        }
      />

      {/* Fallback redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
