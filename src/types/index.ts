export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  requestId: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface DateRange {
  from: Date;
  to: Date;
}
