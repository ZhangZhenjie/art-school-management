export type Role = 'admin' | 'teacher';

export type StatusTag = 'arrears' | 'low_balance' | 'expiring_soon';

export interface Schedule {
  id: string;
  name: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Student {
  id: number;
  name: string;
  birthday: string | null;
  email: string | null;
  parent_name: string | null;
  phone: string | null;
  schedule_id: string | null;
  is_active: boolean;
  total_remaining: number;
  package_count: number;
  status_tags: StatusTag[];
}

export interface Package {
  id: number;
  student_id: number;
  purchased_classes: number;
  gifted_classes: number;
  total_classes: number;
  unit_price: number;
  purchase_price: number;
  remaining_classes: number;
  start_date: string;
  end_date: string;
  is_negative: boolean;
  created_at: string;
}

export interface StudentDetail extends Student {
  packages: Package[];
}

export interface AuditLog {
  id: number;
  operator: string;
  operated_at: string;
  entity_type: string;
  entity_id: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
}

export interface StudentPayload {
  name: string;
  birthday?: string | null;
  email?: string | null;
  parent_name?: string | null;
  phone?: string | null;
  schedule_id?: string | null;
  purchased_classes: number;
  gifted_classes?: number;
  purchase_price: number;
  start_date?: string | null;
}

export interface PackagePayload {
  purchased_classes: number;
  gifted_classes?: number;
  purchase_price: number;
  start_date?: string | null;
  revenue_month?: string | null;
}

export interface PackageUpdatePayload {
  remaining_classes?: number;
  unit_price?: number;
  end_date?: string;
  note: string;
}

export interface ClassSessionRecord {
  id: number;
  student_id: number;
  schedule_id: string;
  session_date: string;
  attended: boolean;
  confirmed: boolean;
  confirmed_by: string | null;
  confirmed_at: string | null;
  package_id: number | null;
  classes_deducted: number;
  revenue_amount: number | null;
  revenue_month: string | null;
}

export interface AttendanceStats {
  student_id: number;
  period: string;
  expected: number;
  attended: number;
  absent: number;
  unconfirmed: number;
  attendance_rate: number | null;
}
