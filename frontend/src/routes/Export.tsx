import { Button, Card, DatePicker, Divider, Space, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import { exportsApi } from '../api/exports';

const { Paragraph, Text } = Typography;

export default function ExportPage() {
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [busy, setBusy] = useState<string | null>(null);

  const wrap = async (key: string, fn: () => Promise<void>, doneMsg: string) => {
    setBusy(key);
    try {
      await fn();
      message.success(doneMsg);
    } catch (e: any) {
      message.error(e?.response?.data?.detail ?? '导出失败');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="数据导出（admin）">
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 720 }}>
        <Card type="inner" title="① 学生及配套">
          <Paragraph type="secondary">
            列：<Text code>学生姓名 · 班级 · 课程类型 · 配套ID · 购买/赠送/剩余课时 · 课单价 · 购买总价 · 有效期 · 状态</Text>
            。一行一个配套；只导出在读学生。
          </Paragraph>
          <Button
            type="primary" icon={<DownloadOutlined />}
            loading={busy === 'students'}
            onClick={() => wrap('students', () => exportsApi.students(), '学生及配套.xlsx 已下载')}
          >
            下载 学生及配套.xlsx
          </Button>
        </Card>

        <Card type="inner" title="② 月度课时消耗">
          <Paragraph type="secondary">
            列：<Text code>学生名 · 班级 · 课程类型 · 应出席 · 实际出席 · 缺席 · 未确认 · 消耗课时数</Text>
            。汇总指定月份每位学生的出勤情况。
          </Paragraph>
          <Space>
            <DatePicker.MonthPicker value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
            <Button
              type="primary" icon={<DownloadOutlined />}
              loading={busy === 'sessions'}
              onClick={() => {
                const m = month.format('YYYY-MM');
                wrap('sessions', () => exportsApi.monthlySessions(m), `${m}-课时消耗.xlsx 已下载`);
              }}
            >
              下载 {month.format('YYYY-MM')}-课时消耗.xlsx
            </Button>
          </Space>
        </Card>

        <Card type="inner" title="③ 月度营收明细">
          <Paragraph type="secondary">
            列：<Text code>月份 · 来源 · 学生 · 课程类型 · 上课日期 · 课时 · 单价 · 营收金额 · 备注</Text>
            。包含课时营收 + 调整项（欠费抵扣 / 删除学生），底部带合计行。
          </Paragraph>
          <Space>
            <DatePicker.MonthPicker value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
            <Button
              type="primary" icon={<DownloadOutlined />}
              loading={busy === 'revenue'}
              onClick={() => {
                const m = month.format('YYYY-MM');
                wrap('revenue', () => exportsApi.revenue(m), `${m}-营收明细.xlsx 已下载`);
              }}
            >
              下载 {month.format('YYYY-MM')}-营收明细.xlsx
            </Button>
          </Space>
        </Card>

        <Divider plain>说明</Divider>
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          所有导出文件为 .xlsx，UTF-8 中文文件名，可在 Excel / Numbers / WPS 打开。
          月度表的"月份"按 <Text code>revenue_month</Text> 字段（确认课时时记录的归属月份）筛选。
        </Paragraph>
      </Space>
    </Card>
  );
}
