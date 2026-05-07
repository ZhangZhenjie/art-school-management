import api from './client';
import type { ClassSessionRecord, AttendanceStats } from '../types/models';

export interface SessionWithStudent extends ClassSessionRecord {
  student_name: string;
  schedule_name: string | null;
}

export interface SessionsQuery {
  date?: string;
  student_id?: number;
  schedule_id?: string;
  month?: string;
  confirmed?: boolean;
}

export interface ConfirmBody {
  session_ids?: number[];
  schedule_id?: string;
  session_date?: string;
  week_of?: string;
  month?: string;
  revenue_month?: string | null;
}

export interface ConfirmResponse {
  confirmed: number;
  skipped_already_confirmed: number;
  classes_consumed: number;
  revenue: number;
}

export interface GenerateResponse {
  month: string;
  inserted: number;
  skipped: number;
  students_considered: number;
}

export const sessionsApi = {
  list: (params?: SessionsQuery) =>
    api.get<SessionWithStudent[]>('/sessions', { params }).then((r) => r.data),

  generate: (month?: string) =>
    api.post<GenerateResponse>('/sessions/generate', { month }).then((r) => r.data),

  updateAttended: (id: number, attended: boolean) =>
    api.put<SessionWithStudent>(`/sessions/${id}`, { attended }).then((r) => r.data),

  confirm: (body: ConfirmBody) =>
    api.post<ConfirmResponse>('/sessions/confirm', body).then((r) => r.data),

  attendance: (studentId: number, year: number, month?: number) =>
    api
      .get<AttendanceStats>(`/attendance/${studentId}`, { params: { year, month } })
      .then((r) => r.data),
};
