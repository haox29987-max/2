import axios from 'axios';

export interface Account {
  id: number;
  username: string;
  nickname: string;
  avatar_url: string;
  type: 'internal' | 'external';
  status: 'active' | 'deleted';
  last_updated: string;
  deleted_at?: string;
  reg_time?: string;
  group_name?: string; 
  country?: string;    
  custom_name?: string;
  created_at?: string;
  avg_daily_videos?: number;
  mcn?: string;                
  commerce_tendency?: string;  
  last_video_time?: number; 
  ai_video_count?: number;
}

export interface Snapshot {
  id: number;
  account_id: number;
  timestamp: string;
  follower_count: number;
  following_count: number;
  heart_count: number;
  video_count: number;
  play_count: number;
  pid_count?: number; 
}

export interface Video {
  id: number;
  account_id: number;
  video_id: string;
  desc: string;
  create_time: number;
  duration: number;
  category: string;
  play_count: number;
  digg_count: number;
  comment_count: number;
  share_count: number;
  cover_url: string;
  platform_category?: string;
  sub_label?: string;
  vq_score?: string;
  is_ai?: string;
  video_type?: string;
  music_name?: string;     
  collect_count?: number;  
  pid?: string;
  product_category?: string;
  username?: string; 
  account_username?: string; 
}

export interface WarningVideo extends Video {
  daily_growth: number;
  is_high_play: boolean;
  is_high_growth: boolean;
  nickname: string;
  avatar_url: string;
  group_name: string;
  country: string;
}

export interface ProductInfo {
  introduction: string;
  brand: string;
  country: string;
  category: string;
  price: string;
  sold_count: string;
  sale_amount: string;
  author_count: string;
  aweme_count: string;
  commission_rate: string;
  product_rating: string;
  images: string[];
}

export const api = {
  chatWithAI: async (messages: {role: string, content: string}[], context: any) => {
    const res = await axios.post<{role: string, content: string}>('/api/ai/chat', { messages, context });
    return res.data;
  },

  getWarningVideos: async (type: 'normal' | 'growth' | 'low') => {
    const res = await axios.get<WarningVideo[]>(`/api/warnings?type=${type}`);
    return res.data;
  },
  batchDeleteVideos: async (ids: number[]) => {
    const res = await axios.post(`/api/videos/batch/delete`, { ids });
    return res.data;
  },
  getDashboardStats: async (type?: string, days: number = 30, group?: string, country?: string) => {
    let url = `/api/dashboard/stats?days=${days}`;
    if (type) url += `&type=${type}`;
    if (group) url += `&group=${encodeURIComponent(group)}`;
    if (country) url += `&country=${encodeURIComponent(country)}`;
    const res = await axios.get<{
      trend: { date: string; count: number }[];
      ranking: { nickname: string; count: number }[];
      categoryRanking: { category: string; count: number }[];
    }>(url);
    return res.data;
  },
  getFilteredVideos: async (filterType: string, filterVal: string, type?: string) => {
    const res = await axios.get<Video[]>(`/api/videos/filter?filter_type=${filterType}&filter_val=${encodeURIComponent(filterVal)}${type ? `&type=${type}` : ''}`);
    return res.data;
  },
  getAccounts: async (type?: string) => {
    const res = await axios.get<Account[]>(`/api/accounts${type ? `?type=${type}` : ''}`);
    return res.data;
  },
  getDeletedAccounts: async () => {
    const res = await axios.get<Account[]>('/api/accounts?status=deleted');
    return res.data;
  },
  addAccount: async (username: string, type: string) => {
    const res = await axios.post<Account>('/api/accounts', { username, type });
    return res.data;
  },
  updateAccountMeta: async (id: number, meta: { custom_name: string; group_name: string; country: string; mcn: string; created_at: string }) => {
    const res = await axios.put(`/api/accounts/${id}/meta`, meta);
    return res.data;
  },
  deleteAccount: async (id: number) => {
    const res = await axios.post(`/api/accounts/${id}/delete`);
    return res.data;
  },
  restoreAccount: async (id: number) => {
    const res = await axios.post(`/api/accounts/${id}/restore`);
    return res.data;
  },
  permanentDeleteAccount: async (id: number) => {
    const res = await axios.delete(`/api/accounts/${id}`);
    return res.data;
  },
  batchDeleteAccounts: async (ids: number[]) => {
    const res = await axios.post(`/api/accounts/batch/delete`, { ids });
    return res.data;
  },
  batchHardDeleteAccounts: async (ids: number[]) => {
    const res = await axios.delete(`/api/accounts/batch/hard_delete`, { data: { ids } });
    return res.data;
  },
  batchUpdateGroup: async (ids: number[], group_name: string) => {
    const res = await axios.put(`/api/accounts/batch/group`, { ids, group_name });
    return res.data;
  },
  batchUpdateMeta: async (ids: number[], meta: { group_name?: string; country?: string; mcn?: string; created_at?: string }) => {
    const res = await axios.put(`/api/accounts/batch/meta`, { ids, ...meta });
    return res.data;
  },
  getAccountDetails: async (id: number, days: number = 30) => {
    const res = await axios.get<{ 
      account: Account; 
      snapshots: Snapshot[]; 
      videos: Video[]; 
      play_trend: {date: string; plays: number}[];
      follower_trend: {date: string; followers_inc: number; followers: number}[];
    }>(`/api/accounts/${id}?days=${days}`);
    return res.data;
  },
  refreshAccount: async (id: number, limit: number) => {
    const res = await axios.post(`/api/accounts/${id}/refresh`, { limit });
    return res.data;
  },
  getRefreshProgress: async (id: number) => {
    const res = await axios.get<{total: number, current: number, status: string, done: boolean}>(`/api/accounts/${id}/progress`);
    return res.data;
  },
  getAllProgress: async () => {
    const res = await axios.get<Record<string, {total: number, current: number, status: string, done: boolean}>>('/api/progress/all');
    return res.data;
  },
  addManualVideo: async (accountId: number, url: string) => {
    const res = await axios.post(`/api/accounts/${accountId}/add_video`, { url });
    return res.data;
  },
  deleteVideo: async (videoId: string) => {
    const res = await axios.post(`/api/videos/${videoId}/delete`);
    return res.data;
  },
  getDeletedVideos: async () => {
    const res = await axios.get<Video[]>('/api/videos/deleted');
    return res.data;
  },
  getVideoTrend: async (videoId: string, days: number = 30) => {
    const res = await axios.get<{date: string, plays: number, likes: number}[]>(`/api/videos/${videoId}/trend?days=${days}`);
    return res.data;
  },
  restoreVideo: async (videoId: string) => {
    const res = await axios.post(`/api/videos/${videoId}/restore`);
    return res.data;
  },
  hardDeleteVideo: async (videoId: string) => {
    const res = await axios.delete(`/api/videos/${videoId}`);
    return res.data;
  },
  emptyRecycleBin: async () => {
    const res = await axios.delete(`/api/recycle_bin/empty`);
    return res.data;
  },
  refreshSingleVideo: async (videoId: string, accountId: number) => {
    const res = await axios.post(`/api/videos/${videoId}/refresh_single`, { account_id: accountId });
    return res.data;
  },
  exportData: async (type?: string, group?: string) => {
    let url = `/api/export`;
    const params = [];
    if (type) params.push(`type=${type}`);
    if (group) params.push(`group=${encodeURIComponent(group)}`);
    if (params.length) url += '?' + params.join('&');
    const res = await axios.get<{ accounts: any[], videos: any[] }>(url);
    return res.data;
  },
  exportAccountData: async (id: number) => {
    const res = await axios.get<{ account: Account, videos: any[] }>(`/api/accounts/${id}/export`);
    return res.data;
  },
  getSettings: async () => {
    const res = await axios.get<any>('/api/settings');
    return res.data;
  },
  saveSettings: async (settings: any) => {
    const res = await axios.post('/api/settings', settings);
    return res.data;
  },
  forceUpdateAll: async () => {
    const res = await axios.post('/api/settings/force_update_all');
    return res.data;
  },
  getProductInfo: async (pid: string) => {
    const res = await axios.get<ProductInfo>(`/api/product/${pid}`);
    return res.data;
  }
};