import { Layout, Menu, Button, Space, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuthStore } from '../stores/auth';

const { Header, Sider, Content } = Layout;

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { username, role, clear } = useAuthStore();

  const items = useMemo(() => {
    const base = [
      { key: '/dashboard/students', label: '学生管理' },
      { key: '/dashboard/sessions/by-class', label: '课时（按班级）' },
      { key: '/dashboard/sessions/by-student', label: '课时（按学生）' },
    ];
    if (role === 'admin') {
      base.push({ key: '/dashboard/revenue', label: '营收统计' });
      base.push({ key: '/dashboard/export', label: '数据导出' });
    }
    return base;
  }, [role]);

  const selectedKey = items.find((i) => location.pathname.startsWith(i.key))?.key ?? items[0].key;

  const onLogout = () => {
    clear();
    navigate('/');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220}>
        <div style={{ color: 'white', padding: 16, fontWeight: 600 }}>画画补习班</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={items}
          onClick={(e) => navigate(e.key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography.Title level={4} style={{ margin: 0 }}>管理面板</Typography.Title>
          <Space>
            <span>{username}（{role === 'admin' ? '管理员' : '老师'}）</span>
            <Button onClick={onLogout}>退出</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
