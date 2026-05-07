import api from './client';

export interface StudentBreakdown {
  student_id: number | null;
  student_name: string;
  classes: number;
  amount: number;
}

export interface TypeBreakdown {
  schedule_type: string;
  classes: number;
  amount: number;
}

export interface RevenueSummary {
  period: string;
  total_amount: number;
  total_classes: number;
  sessions_amount: number;
  adjustments_amount: number;
  by_student: StudentBreakdown[];
  by_schedule_type: TypeBreakdown[];
}

export interface RevenueDetailRow {
  student_id: number | null;
  student_name: string;
  schedule_id: string | null;
  schedule_type: string | null;
  classes: number;
  unit_price: number | null;
  amount: number;
  source: 'session' | 'adjustment';
  revenue_month: string;
  note: string | null;
  session_date: string | null;
  adjustment_reason: string | null;
}

export interface RangeQuery {
  month?: string;
  from?: string;
  to?: string;
}

export const revenueApi = {
  summary: (q: RangeQuery) => api.get<RevenueSummary>('/revenue/summary', { params: q }).then((r) => r.data),
  details: (q: RangeQuery) => api.get<RevenueDetailRow[]>('/revenue/details', { params: q }).then((r) => r.data),
};
