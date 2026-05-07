import { Tag } from 'antd';
import type { StatusTag } from '../types/models';

const META: Record<StatusTag, { label: string; color: string }> = {
  arrears: { label: '欠费', color: 'red' },
  low_balance: { label: '余额低', color: 'gold' },
  expiring_soon: { label: '快过期', color: 'orange' },
};

export default function StatusTags({ tags }: { tags: StatusTag[] }) {
  if (!tags.length) return <Tag color="green">正常</Tag>;
  return (
    <>
      {tags.map((t) => (
        <Tag color={META[t].color} key={t}>{META[t].label}</Tag>
      ))}
    </>
  );
}
