import api from './client';
import type { Schedule } from '../types/models';

export const schedulesApi = {
  list: () => api.get<Schedule[]>('/schedules').then((r) => r.data),
};
