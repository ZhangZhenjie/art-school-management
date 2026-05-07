import { Button, Card, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore, Role } from '../stores/auth';

interface FormVals {
  username: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const onFinish = async (vals: FormVals) => {
    try {
      const { data } = await api.post<{ access_token: string; role: Role }>('/auth/login', vals);
      setAuth({ token: data.access_token, username: vals.username, role: data.role });
      navigate('/dashboard');
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail ?? '登录失败');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f0f2f5' }}>
      <Card title="画画补习班管理系统" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
      </Card>
    </div>
  );
}
