export const APP_ROLE = {
  SUPER_ADMIN: 'super_admin',
  CLIENT_ADMIN: 'client_admin',
  CLIENT_MANAGER: 'client_manager',
  VENUE_MANAGER: 'venue_manager',
  EVENT_MANAGER: 'event_manager',
  EVENT_ORGANIZER: 'event_organizer',
  STAFF: 'staff',
  BAR_STAFF: 'bar_staff',
  WAITER: 'waiter',
  CASHIER: 'cashier',
  CONSUMER: 'consumer',
} as const;

export type AppRole = typeof APP_ROLE[keyof typeof APP_ROLE];

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PREPARING: 'preparing',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const PAYMENT_STATUS = {
  CREATED: 'created',
  PROCESSING: 'processing',
  APPROVED: 'approved',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const QR_STATUS = {
  VALID: 'valid',
  USED: 'used',
  CANCELLED: 'cancelled',
  INVALID: 'invalid',
} as const;

export type QrStatus = typeof QR_STATUS[keyof typeof QR_STATUS];

export const STOCK_MOVEMENT_TYPE = {
  ENTRY: 'entry',
  RESERVATION: 'reservation',
  RELEASE: 'release',
  SALE: 'sale',
  ADJUSTMENT: 'adjustment',
} as const;

export type StockMovementType = typeof STOCK_MOVEMENT_TYPE[keyof typeof STOCK_MOVEMENT_TYPE];

export const CAMPAIGN_STATUS = {
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
} as const;

export type CampaignStatus = typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS];

export const CASH_REGISTER_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export type CashRegisterStatus = typeof CASH_REGISTER_STATUS[keyof typeof CASH_REGISTER_STATUS];

export const WAITER_SESSION_STATUS = {
  ACTIVE: 'active',
  CLOSED: 'closed',
} as const;

export type WaiterSessionStatus = typeof WAITER_SESSION_STATUS[keyof typeof WAITER_SESSION_STATUS];

export const ORDER_ORIGIN = {
  CONSUMER_APP: 'consumer_app',
  WAITER_APP: 'waiter_app',
  CASHIER: 'cashier',
} as const;

export type OrderOrigin = typeof ORDER_ORIGIN[keyof typeof ORDER_ORIGIN];

export const EVENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type EventStatus = typeof EVENT_STATUS[keyof typeof EVENT_STATUS];

export const ENTITY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type EntityStatus = typeof ENTITY_STATUS[keyof typeof ENTITY_STATUS];
