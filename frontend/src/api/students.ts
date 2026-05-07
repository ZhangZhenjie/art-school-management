import api from './client';
import type {
  AuditLog,
  Package,
  Student,
  StudentDetail,
  StudentPayload,
  PackagePayload,
  PackageUpdatePayload,
} from '../types/models';

export interface ListParams {
  q?: string;
  schedule_id?: string;
  status_tag?: 'arrears' | 'low_balance' | 'expiring_soon';
  include_inactive?: boolean;
}

export const studentsApi = {
  list: (params?: ListParams) =>
    api.get<Student[]>('/students', { params }).then((r) => r.data),

  get: (id: number) => api.get<StudentDetail>(`/students/${id}`).then((r) => r.data),

  create: (payload: StudentPayload) =>
    api.post<StudentDetail>('/students', payload).then((r) => r.data),

  update: (id: number, payload: Partial<Pick<Student, 'name' | 'birthday' | 'email' | 'parent_name' | 'phone' | 'schedule_id'>>) =>
    api.put<StudentDetail>(`/students/${id}`, payload).then((r) => r.data),

  remove: (id: number, body: { revenue_month?: string; note?: string }) =>
    api.delete<StudentDetail>(`/students/${id}`, { data: body }).then((r) => r.data),

  listPackages: (id: number) =>
    api.get<Package[]>(`/students/${id}/packages`).then((r) => r.data),

  addPackage: (id: number, payload: PackagePayload) =>
    api.post<StudentDetail>(`/students/${id}/packages`, payload).then((r) => r.data),

  updatePackage: (sid: number, pid: number, payload: PackageUpdatePayload) =>
    api.put<Package>(`/students/${sid}/packages/${pid}`, payload).then((r) => r.data),

  auditLogs: (id: number) =>
    api.get<AuditLog[]>(`/students/${id}/audit-logs`).then((r) => r.data),
};
