import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './routes/Login';
import DashboardLayout from './routes/DashboardLayout';
import StudentList from './routes/Students/StudentList';
import StudentNew from './routes/Students/StudentNew';
import StudentDetail from './routes/Students/StudentDetail';
import SessionsByClass from './routes/Sessions/ByClass';
import SessionsByStudent from './routes/Sessions/ByStudent';
import Revenue from './routes/Revenue';
import ExportPage from './routes/Export';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="students" replace />} />
        <Route path="students" element={<StudentList />} />
        <Route path="students/new" element={<StudentNew />} />
        <Route path="students/:id" element={<StudentDetail />} />
        <Route path="sessions/by-class" element={<SessionsByClass />} />
        <Route path="sessions/by-student" element={<SessionsByStudent />} />
        <Route
          path="revenue"
          element={
            <ProtectedRoute requireAdmin>
              <Revenue />
            </ProtectedRoute>
          }
        />
        <Route
          path="export"
          element={
            <ProtectedRoute requireAdmin>
              <ExportPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
