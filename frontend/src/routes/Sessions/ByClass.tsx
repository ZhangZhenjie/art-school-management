import {
  Alert, Button, Card, Collapse, DatePicker, Descriptions, Divider, Modal, Popconfirm,
  Space, Switch, Table, Tag, message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { sessionsApi, type SessionWithStudent } from '../../api/sessions';
import { schedulesApi } from '../../api/schedules';
import type { Schedule } from '../../types/models';

interface ScheduleGroup {
  schedule_id: string;
  schedule_name: string | null;
  rows: SessionWithStudent[];
}

export default function SessionsByClass() {
  const [day, setDay] = useState<Dayjs>(dayjs());
  const [rows, setRows] = useState<SessionWithStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [schedulesById, setSchedulesById] = useState<Record<string, Schedule>>({});

  const reload = async (d: Dayjs = day) => {
    setLoading(true);
    try {
      const data = await sessionsApi.list({ date: d.format('YYYY-MM-DD') });
      setRows(data);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    schedulesApi.list().then((s) => setSchedulesById(Object.fromEntries(s.map((x) => [x.id, x]))));
    reload(day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo<ScheduleGroup[]>(() => {
    const m = new Map<string, ScheduleGroup>();
    rows.forEach((r) => {
      if (!m.has(r.schedule_id)) {
        m.set(r.schedule_id, { schedule_id: r.schedule_id, schedule_name: r.schedule_name, rows: [] });
      }
      m.get(r.schedule_id)!.rows.push(r);
    });
    return [...m.values()].sort((a, b) => a.schedule_id.localeCompare(b.schedule_id));
  }, [rows]);

  const onGenerate = async () => {
    Modal.confirm({
      title: `生成 ${day.format('YYYY-MM')} 整月课表？`,
      content: '将为所有有班级的活跃学生生成当月课时（已存在的不重复）。',
      onOk: async () => {
        setGenerating(true);
        try {
          const res = await sessionsApi.generate(day.format('YYYY-MM'));
          message.success(`已生成 ${res.inserted} 条（跳过 ${res.skipped} 条已存在）`);
          await reload();
        } catch (e: any) {
          message.error(e?.response?.data?.detail ?? '生成失败');
        } finally {
          setGenerating(false);
        }
      },
    });
  };

  const onToggleAttended = async (row: SessionWithStudent, attended: boolean) => {
    try {
      const updated = await sessionsApi.updateAttended(row.id, attended);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '更新失败');
    }
  };

  const onConfirmDay = async () => {
    setConfirming(true);
    try {
      const res = await sessionsApi.confirm({
        session_ids: rows.filter((r) => !r.confirmed).map((r) => r.id),
      });
      message.success(`已确认 ${res.confirmed} 条，消耗 ${res.classes_consumed} 课时，营收 ¥${res.revenue}`);
      await reload();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const onConfirmWeek = async () => {
    setConfirming(true);
    try {
      const res = await sessionsApi.confirm({ week_of: day.format('YYYY-MM-DD') });
      message.success(`本周已确认 ${res.confirmed} 条，消耗 ${res.classes_consumed} 课时，营收 ¥${res.revenue}`);
      await reload();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const onConfirmGroup = async (g: ScheduleGroup) => {
    setConfirming(true);
    try {
      const res = await sessionsApi.confirm({
        schedule_id: g.schedule_id,
        session_date: day.format('YYYY-MM-DD'),
      });
      message.success(`${g.schedule_id}：确认 ${res.confirmed} 条，营收 ¥${res.revenue}`);
      await reload();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '确认失败');
    } finally {
      setConfirming(false);
    }
  };

  const studentColumns: ColumnsType<SessionWithStudent> = [
    { title: '学生', dataIndex: 'student_name' },
    {
      title: '出席', dataIndex: 'attended', width: 100,
      render: (v: boolean, r) => (
        <Switch
          checkedChildren="✓"
          unCheckedChildren="✗"
          checked={v}
          disabled={r.confirmed}
          onChange={(c) => onToggleAttended(r, c)}
        />
      ),
    },
    {
      title: '状态', width: 220,
      render: (_v, r) => r.confirmed
        ? <Tag color={r.classes_deducted > 0 ? 'green' : 'default'}>
            已确认{r.classes_deducted > 0 ? ` · 扣${r.classes_deducted}课时 · ¥${r.revenue_amount}` : ''}
          </Tag>
        : <Tag color="processing">未确认</Tag>,
    },
    { title: '确认人', dataIndex: 'confirmed_by', width: 100, render: (v) => v ?? '—' },
    {
      title: '确认时间', dataIndex: 'confirmed_at', width: 170,
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: '操作', width: 90,
      render: (_v, r) => r.confirmed ? null : (
        <Popconfirm
          title="单独确认此条？"
          onConfirm={async () => {
            try {
              const res = await sessionsApi.confirm({ session_ids: [r.id] });
              message.success(`已确认，扣 ${res.classes_consumed} 课时，营收 ¥${res.revenue}`);
              await reload();
            } catch (e: any) {
              message.error(e?.response?.data?.detail ?? '失败');
            }
          }}
        >
          <Button size="small" type="link">确认</Button>
        </Popconfirm>
      ),
    },
  ];

  const allConfirmed = rows.length > 0 && rows.every((r) => r.confirmed);
  const totalUnconfirmed = rows.filter((r) => !r.confirmed).length;
  const totalAttended = rows.filter((r) => r.confirmed && r.attended).length;
  const totalRevenue = rows.reduce((acc, r) => acc + (r.revenue_amount ?? 0), 0);

  return (
    <Card
      title={`课时（按班级/日期） — ${day.format('YYYY-MM-DD')} 周${'日一二三四五六'[day.day()]}`}
      extra={
        <Space>
          <DatePicker
            value={day}
            onChange={(v) => { if (v) { setDay(v); reload(v); } }}
            allowClear={false}
          />
          <Button onClick={onGenerate} loading={generating}>生成本月课表</Button>
        </Space>
      }
    >
      <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="班级数">{groups.length}</Descriptions.Item>
        <Descriptions.Item label="学生数">{rows.length}</Descriptions.Item>
        <Descriptions.Item label="未确认">{totalUnconfirmed}</Descriptions.Item>
        <Descriptions.Item label="今日营收">¥{totalRevenue.toFixed(2)}（已出席 {totalAttended}）</Descriptions.Item>
      </Descriptions>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          loading={confirming}
          disabled={totalUnconfirmed === 0}
          onClick={onConfirmDay}
        >
          确认当天剩余 {totalUnconfirmed} 条
        </Button>
        <Button loading={confirming} onClick={onConfirmWeek}>
          确认本周（周一~周日）
        </Button>
        {allConfirmed && rows.length > 0 && (
          <Tag color="success">当天已全部确认</Tag>
        )}
      </Space>

      {rows.length === 0 && !loading && (
        <Alert
          type="info" showIcon
          message="当天没有课时记录"
          description="若该日期是工作日且有学生，可能是当月还未生成。点右上「生成本月课表」。"
        />
      )}

      <Collapse
        defaultActiveKey={groups.map((g) => g.schedule_id)}
        items={groups.map((g) => {
          const sched = schedulesById[g.schedule_id];
          return {
            key: g.schedule_id,
            label: (
              <Space>
                <strong>{g.schedule_id}</strong>
                <span>{g.schedule_name}</span>
                {sched && <span style={{ color: '#888' }}>{sched.start_time}–{sched.end_time}</span>}
                <Tag>{g.rows.length} 人</Tag>
                <Tag color={g.rows.every((r) => r.confirmed) ? 'success' : 'processing'}>
                  {g.rows.filter((r) => r.confirmed).length}/{g.rows.length} 已确认
                </Tag>
              </Space>
            ),
            extra: (
              <Button
                size="small"
                disabled={g.rows.every((r) => r.confirmed)}
                onClick={(e) => { e.stopPropagation(); onConfirmGroup(g); }}
              >
                批量确认本班
              </Button>
            ),
            children: (
              <Table<SessionWithStudent>
                size="small"
                rowKey="id"
                columns={studentColumns}
                dataSource={g.rows}
                pagination={false}
              />
            ),
          };
        })}
      />
      <Divider style={{ marginTop: 24 }} />
      <Alert
        type="info" showIcon
        message="提示"
        description="切换 attended 不会立即扣课时；点击「确认」时按规则扣最旧、有余额的配套。已确认的记录不可再切换 attended（如需更正，请去学生详情页修改配套）。"
      />
    </Card>
  );
}
