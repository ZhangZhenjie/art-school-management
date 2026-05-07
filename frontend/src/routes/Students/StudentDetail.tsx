import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input, InputNumber,
  Modal, Popconfirm, Row, Select, Space, Spin, Table, Tabs, Tag, message,
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { studentsApi } from '../../api/students';
import { schedulesApi } from '../../api/schedules';
import StatusTags from '../../components/StatusTags';
import type { AuditLog, Package, Schedule, StudentDetail } from '../../types/models';

function pickDetail(detail: StudentDetail) {
  return {
    name: detail.name,
    schedule_id: detail.schedule_id ?? undefined,
    parent_name: detail.parent_name ?? undefined,
    phone: detail.phone ?? undefined,
    email: detail.email ?? undefined,
    birthday: detail.birthday ? dayjs(detail.birthday) : undefined,
  };
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const sid = Number(id);
  const nav = useNavigate();

  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBasic, setEditingBasic] = useState(false);
  const [addPkgOpen, setAddPkgOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<Package | null>(null);
  const [delOpen, setDelOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [d, l] = await Promise.all([studentsApi.get(sid), studentsApi.auditLogs(sid)]);
      setDetail(d);
      setLogs(l);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    schedulesApi.list().then(setSchedules);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  if (loading || !detail) return <Spin />;

  const pkgColumns: ColumnsType<Package> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '剩余 / 购买 / 赠送',
      width: 200,
      render: (_, p) => (
        <span>
          <span style={{ color: p.remaining_classes < 0 ? '#cf1322' : undefined }}>{p.remaining_classes}</span>
          {' / '}{p.purchased_classes}{' / '}{p.gifted_classes}
        </span>
      ),
    },
    { title: '课单价', dataIndex: 'unit_price', width: 100, render: (v: number) => `¥${v}` },
    { title: '购买总价', dataIndex: 'purchase_price', width: 110, render: (v: number) => `¥${v}` },
    { title: '起始', dataIndex: 'start_date', width: 110 },
    { title: '到期', dataIndex: 'end_date', width: 110 },
    {
      title: '状态', width: 80,
      render: (_, p) => p.is_negative ? <Tag color="red">欠费</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: '操作', width: 90,
      render: (_, p) => <Button size="small" onClick={() => setEditPkg(p)}>修改</Button>,
    },
  ];

  const logColumns: ColumnsType<AuditLog> = [
    { title: '时间', dataIndex: 'operated_at', width: 170, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
    { title: '操作人', dataIndex: 'operator', width: 100 },
    {
      title: '对象', width: 130,
      render: (_, l) => `${l.entity_type}#${l.entity_id}`,
    },
    { title: '字段', dataIndex: 'field_name', width: 130 },
    {
      title: '变更', width: 200,
      render: (_, l) => `${l.old_value ?? '∅'} → ${l.new_value ?? '∅'}`,
    },
    { title: '备注', dataIndex: 'note' },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {!detail.is_active && (
        <Alert type="warning" showIcon message="该学生已退学（软删除）" />
      )}

      <Card
        title={
          <Space>
            <span>#{detail.id} {detail.name}</span>
            <StatusTags tags={detail.status_tags} />
          </Space>
        }
        extra={
          <Space>
            <Button onClick={() => setEditingBasic((v) => !v)}>{editingBasic ? '取消编辑' : '编辑信息'}</Button>
            {detail.is_active && (
              <Popconfirm
                title="确认软删除该学生？"
                description="剩余课时将作为营收调整记录。"
                onConfirm={() => setDelOpen(true)}
              >
                <Button danger>退学</Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        {editingBasic ? (
          <BasicEditForm
            detail={detail}
            schedules={schedules}
            onSaved={async () => { setEditingBasic(false); await reload(); }}
            onCancel={() => setEditingBasic(false)}
          />
        ) : (
          <Descriptions column={2} size="small">
            <Descriptions.Item label="班级">{detail.schedule_id ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="生日">{detail.birthday ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="家长">{detail.parent_name ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="电话">{detail.phone ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{detail.email ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="剩余课时合计">{detail.total_remaining}</Descriptions.Item>
            <Descriptions.Item label="配套数">{detail.package_count}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Tabs
        items={[
          {
            key: 'packages',
            label: `配套 (${detail.packages.length})`,
            children: (
              <Card
                size="small"
                extra={detail.is_active && (
                  <Button type="primary" onClick={() => setAddPkgOpen(true)}>新增配套</Button>
                )}
              >
                <Table<Package>
                  rowKey="id"
                  columns={pkgColumns}
                  dataSource={[...detail.packages].sort((a, b) =>
                    a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : a.id - b.id,
                  )}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: `操作日志 (${logs.length})`,
            children: (
              <Card size="small">
                <Table<AuditLog>
                  rowKey="id"
                  columns={logColumns}
                  dataSource={logs}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {addPkgOpen && (
        <AddPackageModal
          studentId={sid}
          onDone={async () => { setAddPkgOpen(false); await reload(); }}
          onCancel={() => setAddPkgOpen(false)}
        />
      )}
      {editPkg && (
        <EditPackageModal
          studentId={sid}
          pkg={editPkg}
          onDone={async () => { setEditPkg(null); await reload(); }}
          onCancel={() => setEditPkg(null)}
        />
      )}
      {delOpen && (
        <DeleteStudentModal
          studentId={sid}
          studentName={detail.name}
          onDone={async () => { setDelOpen(false); await reload(); nav('/dashboard/students'); }}
          onCancel={() => setDelOpen(false)}
        />
      )}
    </Space>
  );
}

// ─── Basic info inline edit ─────────────────────────────────────────────────

function BasicEditForm({
  detail, schedules, onSaved, onCancel,
}: { detail: StudentDetail; schedules: Schedule[]; onSaved: () => void; onCancel: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await studentsApi.update(detail.id, {
        name: v.name,
        schedule_id: v.schedule_id ?? null,
        parent_name: v.parent_name ?? null,
        phone: v.phone ?? null,
        email: v.email ?? null,
        birthday: v.birthday ? (v.birthday as Dayjs).format('YYYY-MM-DD') : null,
      });
      message.success('已保存');
      onSaved();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical" initialValues={pickDetail(detail)}>
      <Row gutter={16}>
        <Col span={12}><Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item></Col>
        <Col span={12}>
          <Form.Item name="schedule_id" label="班级">
            <Select
              allowClear showSearch
              options={[
                ...schedules.map((s) => ({ label: `${s.id} · ${s.name}`, value: s.id })),
                { label: '1O · 线下私课', value: '1O' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={12}><Form.Item name="parent_name" label="家长"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="phone" label="电话"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="email" label="邮箱"><Input /></Form.Item></Col>
        <Col span={12}><Form.Item name="birthday" label="生日"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
      </Row>
      <Space>
        <Button type="primary" onClick={onSave} loading={saving}>保存</Button>
        <Button onClick={onCancel}>取消</Button>
      </Space>
    </Form>
  );
}

// ─── Add package ────────────────────────────────────────────────────────────

function AddPackageModal({
  studentId, onDone, onCancel,
}: { studentId: number; onDone: () => void; onCancel: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onOk = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await studentsApi.addPackage(studentId, {
        purchased_classes: v.purchased_classes,
        gifted_classes: v.gifted_classes ?? 0,
        purchase_price: v.purchase_price,
        start_date: v.start_date ? (v.start_date as Dayjs).format('YYYY-MM-DD') : null,
        revenue_month: v.revenue_month ?? null,
      });
      message.success('已新增（如有同价配套会自动合并；如有欠费会自动抵扣）');
      onDone();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '提交失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="新增配套"
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ loading: saving }}
      okText="提交"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" initialValues={{ gifted_classes: 0, start_date: dayjs() }}>
        <Form.Item name="purchased_classes" label="购买课时数" rules={[{ required: true }]}>
          <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="gifted_classes" label="赠送课时数">
          <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="purchase_price" label="购买总价" rules={[{ required: true }]}>
          <InputNumber min={0} step={10} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="start_date" label="起始日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="revenue_month"
          label="欠费抵扣的营收月份（可空，默认当月）"
          tooltip='格式 "YYYY-MM"，仅在该学生当前有欠费时才会用到'
        >
          <Input placeholder="2026-05" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Edit package (audited fields) ──────────────────────────────────────────

const AUDITED_FIELDS: Array<keyof Package> = ['remaining_classes', 'unit_price', 'end_date'];

function EditPackageModal({
  studentId, pkg, onDone, onCancel,
}: { studentId: number; pkg: Package; onDone: () => void; onCancel: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onOk = async () => {
    const v = await form.validateFields();
    const payload: any = { note: v.note };
    let touched = false;
    for (const f of AUDITED_FIELDS) {
      const next = v[f];
      if (next === undefined || next === null) continue;
      const formatted = f === 'end_date' ? (next as Dayjs).format('YYYY-MM-DD') : next;
      if (formatted !== pkg[f]) {
        payload[f] = formatted;
        touched = true;
      }
    }
    if (!touched) {
      message.info('没有变更');
      return;
    }
    if (!v.note?.trim()) {
      message.error('修改受审计字段必须填写备注');
      return;
    }
    setSaving(true);
    try {
      await studentsApi.updatePackage(studentId, pkg.id, payload);
      message.success('已保存，已写入操作日志');
      onDone();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`修改配套 #${pkg.id}`}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ loading: saving }}
      okText="保存"
      cancelText="取消"
    >
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message="修改剩余课时 / 课单价 / 有效期 必须填写备注，会写入操作日志。" />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          remaining_classes: pkg.remaining_classes,
          unit_price: pkg.unit_price,
          end_date: dayjs(pkg.end_date),
        }}
      >
        <Divider orientation="left">受审计字段</Divider>
        <Form.Item name="remaining_classes" label="剩余课时">
          <InputNumber step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="unit_price" label="课单价">
          <InputNumber min={0} step={1} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="end_date" label="有效期至">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="备注（必填）" rules={[{ required: true, message: '请填写修改原因' }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Soft delete ────────────────────────────────────────────────────────────

function DeleteStudentModal({
  studentId, studentName, onDone, onCancel,
}: { studentId: number; studentName: string; onDone: () => void; onCancel: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onOk = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await studentsApi.remove(studentId, {
        revenue_month: v.revenue_month ?? null,
        note: v.note ?? null,
      });
      message.success('已退学，剩余课时计入营收调整');
      onDone();
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`退学：${studentName}`}
      onOk={onOk}
      onCancel={onCancel}
      okButtonProps={{ loading: saving, danger: true }}
      okText="确认退学"
      cancelText="取消"
    >
      <Alert type="warning" showIcon style={{ marginBottom: 16 }}
        message="软删除：is_active=false。剩余课时（>0 的部分）将写入营收调整。历史课时记录保留。" />
      <Form form={form} layout="vertical">
        <Form.Item name="revenue_month" label="营收归属月份（可空，默认当月）">
          <Input placeholder="2026-05" />
        </Form.Item>
        <Form.Item name="note" label="备注">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
