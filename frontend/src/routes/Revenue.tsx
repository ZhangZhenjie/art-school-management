import {
  Card, Col, DatePicker, Descriptions, Empty, Radio, Row, Space, Statistic, Table, Tabs, Tag, message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  revenueApi,
  type RevenueDetailRow,
  type RevenueSummary,
  type StudentBreakdown,
  type TypeBreakdown,
} from '../api/revenue';

type Mode = 'month' | 'range';

export default function Revenue() {
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [from, setFrom] = useState<Dayjs>(dayjs().subtract(2, 'month'));
  const [to, setTo] = useState<Dayjs>(dayjs());
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [details, setDetails] = useState<RevenueDetailRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const params = mode === 'month'
        ? { month: month.format('YYYY-MM') }
        : { from: from.format('YYYY-MM'), to: to.format('YYYY-MM') };
      const [s, d] = await Promise.all([revenueApi.summary(params), revenueApi.details(params)]);
      setSummary(s);
      setDetails(d);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, month, from, to]);

  const studentCols: ColumnsType<StudentBreakdown> = useMemo(() => [
    { title: '学生', dataIndex: 'student_name' },
    {
      title: '课时', dataIndex: 'classes', width: 100,
      sorter: (a, b) => a.classes - b.classes,
      align: 'right',
    },
    {
      title: '营收', dataIndex: 'amount', width: 130,
      sorter: (a, b) => a.amount - b.amount,
      align: 'right',
      defaultSortOrder: 'descend',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
  ], []);

  const typeCols: ColumnsType<TypeBreakdown> = useMemo(() => [
    { title: '课程类型', dataIndex: 'schedule_type' },
    { title: '课时', dataIndex: 'classes', width: 100, align: 'right' },
    { title: '营收', dataIndex: 'amount', width: 130, align: 'right',
      render: (v: number) => `¥${v.toFixed(2)}` },
  ], []);

  const detailCols: ColumnsType<RevenueDetailRow> = useMemo(() => [
    { title: '月份', dataIndex: 'revenue_month', width: 90 },
    {
      title: '来源', dataIndex: 'source', width: 90,
      render: (v: string) => v === 'session'
        ? <Tag color="blue">课时</Tag>
        : <Tag color="orange">调整</Tag>,
    },
    { title: '日期', dataIndex: 'session_date', width: 110, render: (v) => v ?? '—' },
    { title: '学生', dataIndex: 'student_name' },
    { title: '课程类型', dataIndex: 'schedule_type', width: 100, render: (v) => v ?? '—' },
    { title: '课时', dataIndex: 'classes', width: 80, align: 'right' },
    {
      title: '课单价', dataIndex: 'unit_price', width: 90, align: 'right',
      render: (v) => v == null ? '—' : `¥${v}`,
    },
    {
      title: '金额', dataIndex: 'amount', width: 110, align: 'right',
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '原因 / 备注', render: (_, r) => {
        if (r.source === 'adjustment') {
          const tag = r.adjustment_reason === 'student_deleted' ? '删除学生剩余课时'
                    : r.adjustment_reason === 'deduct_arrears' ? '欠费抵扣'
                    : r.adjustment_reason ?? '';
          return <span>{tag}{r.note ? ` · ${r.note}` : ''}</span>;
        }
        return '—';
      },
    },
  ], []);

  return (
    <Card
      title="营收统计（admin）"
      extra={
        <Space>
          <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="month">单月</Radio.Button>
            <Radio.Button value="range">区间</Radio.Button>
          </Radio.Group>
          {mode === 'month' ? (
            <DatePicker.MonthPicker value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
          ) : (
            <Space>
              <DatePicker.MonthPicker value={from} onChange={(v) => v && setFrom(v)} allowClear={false} />
              <span>—</span>
              <DatePicker.MonthPicker value={to} onChange={(v) => v && setTo(v)} allowClear={false} />
            </Space>
          )}
        </Space>
      }
    >
      {!summary && !loading && <Empty />}
      {summary && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <Statistic title={`营收（${summary.period}）`} value={summary.total_amount} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="消耗课时" value={summary.total_classes} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="课时营收" value={summary.sessions_amount} precision={2} prefix="¥" />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <Statistic title="调整营收" value={summary.adjustments_amount} precision={2} prefix="¥" />
              </Card>
            </Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'student',
                label: `按学生 (${summary.by_student.length})`,
                children: (
                  <Table<StudentBreakdown>
                    rowKey={(r) => `${r.student_id ?? r.student_name}`}
                    size="small"
                    columns={studentCols}
                    dataSource={summary.by_student}
                    pagination={{ pageSize: 20 }}
                  />
                ),
              },
              {
                key: 'type',
                label: `按课程类型 (${summary.by_schedule_type.length})`,
                children: (
                  <Table<TypeBreakdown>
                    rowKey="schedule_type"
                    size="small"
                    columns={typeCols}
                    dataSource={summary.by_schedule_type}
                    pagination={false}
                    summary={(rows) => {
                      const tc = rows.reduce((a, r) => a + r.classes, 0);
                      const ta = rows.reduce((a, r) => a + r.amount, 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0}><strong>合计</strong></Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right"><strong>{tc}</strong></Table.Summary.Cell>
                          <Table.Summary.Cell index={2} align="right"><strong>¥{ta.toFixed(2)}</strong></Table.Summary.Cell>
                        </Table.Summary.Row>
                      );
                    }}
                  />
                ),
              },
              {
                key: 'detail',
                label: `明细 (${details.length})`,
                children: (
                  <Table<RevenueDetailRow>
                    rowKey={(r) => `${r.source}-${r.revenue_month}-${r.student_id}-${r.session_date ?? r.adjustment_reason}-${Math.random()}`}
                    size="small"
                    columns={detailCols}
                    dataSource={details}
                    pagination={{ pageSize: 50 }}
                    loading={loading}
                  />
                ),
              },
            ]}
          />

          <Descriptions size="small" column={4} style={{ marginTop: 16 }}>
            <Descriptions.Item label="周期">{summary.period}</Descriptions.Item>
            <Descriptions.Item label="数据源">课时营收 + 调整（删除学生 / 欠费抵扣）</Descriptions.Item>
          </Descriptions>
        </>
      )}
    </Card>
  );
}
