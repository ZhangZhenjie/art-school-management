import {
  Card, DatePicker, Descriptions, Empty, Select, Space, Statistic, Table, Tag, message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { sessionsApi, type SessionWithStudent } from '../../api/sessions';
import { studentsApi } from '../../api/students';
import type { AttendanceStats, Student } from '../../types/models';

export default function SessionsByStudent() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<number | undefined>();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [rows, setRows] = useState<SessionWithStudent[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    studentsApi.list({ include_inactive: true }).then(setStudents);
  }, []);

  const reload = async (sid: number, m: Dayjs) => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([
        sessionsApi.list({ student_id: sid, month: m.format('YYYY-MM') }),
        sessionsApi.attendance(sid, m.year(), m.month() + 1),
      ]);
      setRows(r);
      setStats(a);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId) reload(studentId, month);
  }, [studentId, month]);

  const cols: ColumnsType<SessionWithStudent> = useMemo(() => [
    { title: '日期', dataIndex: 'session_date', width: 120 },
    { title: '班级', dataIndex: 'schedule_id', width: 100,
      render: (v, r) => <span>{v} <span style={{ color: '#888' }}>{r.schedule_name}</span></span> },
    {
      title: '出席', dataIndex: 'attended', width: 80,
      render: (v: boolean, r) => r.confirmed
        ? (v ? <Tag color="green">✓</Tag> : <Tag color="red">✗</Tag>)
        : <Tag color="processing">？</Tag>,
    },
    {
      title: '状态', width: 200,
      render: (_, r) => r.confirmed
        ? <Tag color="success">{`已确认 · 扣 ${r.classes_deducted} · ¥${r.revenue_amount ?? 0}`}</Tag>
        : <Tag color="warning">未确认</Tag>,
    },
    { title: '确认人', dataIndex: 'confirmed_by', width: 100, render: (v) => v ?? '—' },
    { title: '营收月份', dataIndex: 'revenue_month', width: 100, render: (v) => v ?? '—' },
  ], []);

  return (
    <Card
      title="课时（按学生）"
      extra={
        <Space>
          <Select
            showSearch
            placeholder="选择学生"
            style={{ width: 240 }}
            value={studentId}
            onChange={setStudentId}
            optionFilterProp="label"
            options={students.map((s) => ({
              label: `${s.name}${s.schedule_id ? ` · ${s.schedule_id}` : ''}${s.is_active ? '' : ' (已退学)'}`,
              value: s.id,
            }))}
          />
          <DatePicker.MonthPicker
            value={month}
            onChange={(v) => v && setMonth(v)}
            allowClear={false}
          />
        </Space>
      }
    >
      {!studentId && <Empty description="请先选择学生" />}
      {studentId && (
        <>
          {stats && (
            <Descriptions size="small" column={5} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="周期">{stats.period}</Descriptions.Item>
              <Descriptions.Item label="应出席">{stats.expected}</Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#3f8600' }}>实际出席</span>}>
                <Statistic value={stats.attended} valueStyle={{ fontSize: 16, color: '#3f8600' }} />
              </Descriptions.Item>
              <Descriptions.Item label={<span style={{ color: '#cf1322' }}>缺席</span>}>
                <Statistic value={stats.absent} valueStyle={{ fontSize: 16, color: '#cf1322' }} />
              </Descriptions.Item>
              <Descriptions.Item label="出勤率">
                {stats.attendance_rate === null ? '—' : `${(stats.attendance_rate * 100).toFixed(1)}%`}
                {stats.unconfirmed > 0 && (
                  <span style={{ color: '#888', marginLeft: 8 }}>（{stats.unconfirmed} 待确认）</span>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}
          <Table<SessionWithStudent>
            rowKey="id"
            loading={loading}
            columns={cols}
            dataSource={rows}
            pagination={false}
            size="small"
          />
        </>
      )}
    </Card>
  );
}
