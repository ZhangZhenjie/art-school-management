import { Button, Card, Input, Select, Space, Table, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { studentsApi, type ListParams } from '../../api/students';
import { schedulesApi } from '../../api/schedules';
import StatusTags from '../../components/StatusTags';
import type { Schedule, Student, StatusTag } from '../../types/models';

export default function StudentList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<ListParams>({});

  const reload = (params: ListParams = filters) => {
    setLoading(true);
    studentsApi
      .list(params)
      .then(setRows)
      .catch((e) => message.error(e?.response?.data?.detail ?? '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    schedulesApi.list().then(setSchedules);
    reload({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ColumnsType<Student> = useMemo(() => [
    {
      title: '姓名', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v, r) => <Link to={`/dashboard/students/${r.id}`}>{v}</Link>,
    },
    { title: '班级', dataIndex: 'schedule_id', width: 90, render: (v) => v ?? '—' },
    {
      title: '配套数', dataIndex: 'package_count', width: 80,
      sorter: (a, b) => a.package_count - b.package_count,
    },
    {
      title: '剩余课时合计', dataIndex: 'total_remaining', width: 130,
      sorter: (a, b) => a.total_remaining - b.total_remaining,
      render: (v: number) => <span style={{ color: v < 0 ? '#cf1322' : undefined }}>{v}</span>,
    },
    { title: '家长', dataIndex: 'parent_name', render: (v) => v ?? '—' },
    { title: '电话', dataIndex: 'phone', render: (v) => v ?? '—' },
    {
      title: '状态', dataIndex: 'status_tags', width: 200,
      render: (tags: StatusTag[]) => <StatusTags tags={tags} />,
    },
  ], []);

  return (
    <Card
      title="学生列表"
      extra={<Button type="primary" onClick={() => nav('/dashboard/students/new')}>新增学生</Button>}
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="姓名 / 家长 / 电话 / 邮箱"
          allowClear
          style={{ width: 280 }}
          onSearch={(v) => {
            const next = { ...filters, q: v || undefined };
            setFilters(next);
            reload(next);
          }}
        />
        <Select
          placeholder="按班级"
          allowClear
          style={{ width: 160 }}
          value={filters.schedule_id}
          onChange={(v) => {
            const next = { ...filters, schedule_id: v };
            setFilters(next);
            reload(next);
          }}
          options={schedules.map((s) => ({ label: `${s.id} ${s.name}`, value: s.id }))}
        />
        <Select
          placeholder="按状态"
          allowClear
          style={{ width: 140 }}
          value={filters.status_tag}
          onChange={(v) => {
            const next = { ...filters, status_tag: v };
            setFilters(next);
            reload(next);
          }}
          options={[
            { label: '欠费', value: 'arrears' },
            { label: '余额低', value: 'low_balance' },
            { label: '快过期', value: 'expiring_soon' },
          ]}
        />
        <Select
          style={{ width: 140 }}
          value={filters.include_inactive ? 'all' : 'active'}
          onChange={(v) => {
            const next = { ...filters, include_inactive: v === 'all' };
            setFilters(next);
            reload(next);
          }}
          options={[
            { label: '仅在读', value: 'active' },
            { label: '含已退学', value: 'all' },
          ]}
        />
      </Space>
      <Table<Student>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 人` }}
      />
    </Card>
  );
}
