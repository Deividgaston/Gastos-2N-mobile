
export interface ExpenseEntry {
  id?: string;
  date: any;
  dateJs?: Date;
  amount: number;
  provider: string;
  category: string;
  paidWith: string;
  notes: string;
  photoURL?: string;
  photoPath?: string;
  createdAt?: any;
  _src?: 'remote' | 'local';
  _localIndex?: number;
}

export interface KmEntry {
  id?: string;
  date: any;
  dateJs?: Date;
  km: number;
  distance?: number;
  type: string;
  fuelPrice?: number | null;
  totalKm?: number | null;
  notes: string;
  _src?: 'remote' | 'local';
  _localIndex?: number;
}

export interface User {
  uid: string;
  email: string | null;
}
