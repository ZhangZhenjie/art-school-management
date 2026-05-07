import { Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Select, Space, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentsApi } from '../../api/students';
import { schedulesApi } from '../../api/schedules';
import type { Schedule } from '../../types/models';

interface FormValues {
  name: string;
  birthday?: Dayjs;
  email?: string;
  parent_name?: string;
  phone?: string;
  schedule_id?: string;
  purchased_classes: number;
  gifted_classes?: number;
  purchase_price: number;
  start_date?: Dayjs;
}

export default function StudentNew() {
  const nav = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    schedulesApi.list().then(setSchedules);
  }, []);

  const onFinish = async (vals: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: vals.name,
        birthday: vals.birthday?.format('YYYY-MM-DD') ?? null,
        email: vals.email ?? null,
        parent_name: vals.parent_name ?? null,
        phone: vals.phone ?? null,
        schedule_id: vals.schedule_id ?? null,
        purchased_classes: vals.purchased_classes,
        gifted_classes: vals.gifted_classes ?? 0,
        purchase_price: vals.purchase_price,
        start_date: vals.start_date?.format('YYYY-MM-DD') ?? null,
      };
      const res = await studentsApi.create(payload);
      message.success(`学生 ${res.name} 已新增`);
      nav(`/dashboard/students/${res.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '新增失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="新增学生">
      <Form<FormValues>
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ gifted_classes: 0, start_date: dayjs() }}
        style={{ maxWidth: 720 }}
      >
        <Divider orientation="left">基本信息</Divider>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input autoFocus />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="schedule_id" label="班级">
              <Select
                allowClear
                placeholder="选班级（线下私课填 1O）"
                showSearch
                options={[
                  ...schedules.map((s) => ({ label: `${s.id} · ${s.name}`, value: s.id })),
                  { label: '1O · 线下私课', value: '1O' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="birthday" label="生日">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="email" label="邮箱">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="parent_name" label="家长姓名">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="电话">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">首个配套</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="purchased_classes"
              label="购买课时数"
              rules={[{ required: true, message: '必填' }]}
              tooltip="<48 节自动 4 个月有效期，≥48 节 16 个月"
            >
              <InputNumber min={0.5} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gifted_classes" label="赠送课时数">
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="purchase_price"
              label="购买总价"
              rules={[{ required: true, message: '必填' }]}
            >
              <InputNumber min={0} step={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="start_date" label="起始日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>提交</Button>
            <Button onClick={() => nav('/dashboard/students')}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
