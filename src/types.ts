export type UserProfile = 'Administrador' | 'Especialista Santander' | 'Especialista de loja' | 'Líder';

export interface User {
  id: string;
  name: string;
  matricula: string;
  profile: UserProfile;
  store_id?: string;
  created_at: string;
  store?: Store;
}

export type BlockType = 'Créditos' | 'Comissões' | 'Conquista';

export interface Store {
  id: string;
  name: string;
  code: string;
  nps?: number;
  nps_updated_at?: string;
}

export interface Product {
  id: string;
  block: BlockType;
  name: string;
  segment?: string;
  multiplier: number;
  variable_rate: number;
  specialist_rate?: number;
  leader_rate?: number;
  is_focus?: boolean;
}

export interface Goal {
  id: string;
  profile: UserProfile;
  block: BlockType;
  value: number;
  is_focus?: boolean;
  month: string; // YYYY-MM
  store_id?: string;
}

export interface Production {
  id: string;
  user_id: string;
  date: string;
  product_id: string;
  amount: number;
}

export interface Reminder {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AppSettings {
  id: string;
  logo_url: string;
}

export interface Indicator {
  id: string;
  name: string;
  value: number;
  month: string; // YYYY-MM
  updated_at: string;
}

export interface IndicatorRule {
  id: string;
  indicator_name: string;
  min_value: number;
  max_value: number;
  multiplier: number;
  description: string;
}
