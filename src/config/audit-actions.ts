export const AUDIT_ACTION = {
  // Clients
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',

  // Venues
  VENUE_CREATED: 'venue.created',
  VENUE_UPDATED: 'venue.updated',

  // Events
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',

  // Roles
  ROLE_ASSIGNED: 'user.role_assigned',
  ROLE_REVOKED: 'user.role_removed',

  // Payments
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_APPROVED: 'payment.approved',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_SPLIT_PROCESSED: 'payment.split_processed',

  // QR Code
  QR_GENERATED: 'qr.generated',
  QR_VALIDATED: 'qr.validated',
  QR_VALIDATION_FAILED: 'qr.validation_failed',
  QR_CANCELLED: 'qr.cancelled',

  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_DELIVERED: 'order.delivered',

  // Stock
  STOCK_ENTRY: 'stock.entry',
  STOCK_ADJUSTED: 'stock.adjusted',

  // Catalog
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DEACTIVATED: 'product.deactivated',

  // Campaigns
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_PAUSED: 'campaign.paused',
  CAMPAIGN_ENDED: 'campaign.ended',

  // Cash register
  CASH_REGISTER_OPENED: 'cash_register.opened',
  CASH_REGISTER_CLOSED: 'cash_register.closed',
  CASH_SANGRIA: 'cash_register.sangria',

  // Waiter
  WAITER_SESSION_STARTED: 'waiter_session.started',
  WAITER_SESSION_CLOSED: 'waiter_session.closed',
  WAITER_CANCELLATION_REQUESTED: 'waiter.cancellation_requested',
  WAITER_CANCELLATION_AUTHORIZED: 'waiter.cancellation_authorized',

  // Users
  USER_ROLE_ASSIGNED: 'user.role_assigned',
  USER_ROLE_REMOVED: 'user.role_removed',
  CONSUMER_LIMIT_CHANGED: 'consumer.limit_changed',

  // Check-in
  CHECKIN_CREATED: 'checkin.created',
  CHECKOUT_CREATED: 'checkin.checkout',

  // Returns
  RETURN_REQUESTED: 'return.requested',
  RETURN_AUTHORIZED: 'return.authorized',
  EXCHANGE_CREATED: 'exchange.created',
} as const;

export type AuditAction = typeof AUDIT_ACTION[keyof typeof AUDIT_ACTION];
