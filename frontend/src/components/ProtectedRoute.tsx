import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuthStore } from '../stores/auth';

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin }: Props) {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/" replace />;
  if (requireAdmin && role !== 'admin') return <Navigate to="/dashboard/students" replace />;
  return <>{children}</>;
}
