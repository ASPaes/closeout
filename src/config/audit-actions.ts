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

  // Event Settings
  EVENT_SETTINGS_CREATED: 'event_settings.created',
  EVENT_SETTINGS_UPDATED: 'event_settings.updated',

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
  STOCK_BALANCE_UPDATED: 'stock.balance_updated',
  STOCK_ENTRY_CREATED: 'stock.entry_created',

  // Catalog (products)
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DEACTIVATED: 'product.deactivated',

  // Catalogs (reusable)
  CATALOG_CREATED: 'catalog.created',
  CATALOG_UPDATED: 'catalog.updated',
  CATALOG_ITEM_ADDED: 'catalog_item.added',
  CATALOG_ITEM_UPDATED: 'catalog_item.updated',
  CATALOG_ITEM_REMOVED: 'catalog_item.removed',
  EVENT_CATALOG_LINKED: 'event_catalog.linked',
  EVENT_CATALOG_UNLINKED: 'event_catalog.unlinked',

  // Combos
  COMBO_CREATED: 'combo.created',
  COMBO_UPDATED: 'combo.updated',
  COMBO_ITEM_ADDED: 'combo_item.added',
  COMBO_ITEM_UPDATED: 'combo_item.updated',
  COMBO_ITEM_REMOVED: 'combo_item.removed',

  // Campaigns
  CAMPAIGN_ITEM_ADDED: 'campaign_item.added',
  CAMPAIGN_ITEM_UPDATED: 'campaign_item.updated',
  CAMPAIGN_ITEM_REMOVED: 'campaign_item.removed',

  // Campaigns
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_PAUSED: 'campaign.paused',
  CAMPAIGN_ENDED: 'campaign.ended',

  // Cash register
  CASH_REGISTER_OPENED: 'cash_register.opened',
  CASH_REGISTER_CLOSED: 'cash_register.closed',
  CASH_SANGRIA: 'cash_register.sangria',
  CASH_ORDER_CREATED: 'cash_order.created',
  CASH_ORDER_CANCELLED: 'cash_order.cancelled',
  CASH_MOVEMENT_CREATED: 'cash_movement.created',
  CASH_RETURN_CREATED: 'cash_return.created',
  CASH_EXCHANGE_CREATED: 'cash_exchange.created',

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

  // Recipes (BOM)
  RECIPE_CREATED: 'recipe.created',
  RECIPE_UPDATED: 'recipe.updated',
  RECIPE_REMOVED: 'recipe.removed',

  // Billing Rules
  BILLING_RULE_CREATED: 'billing_rule.created',
  BILLING_RULE_UPDATED: 'billing_rule.updated',

  // Event Billing Overrides
  EVENT_BILLING_OVERRIDE_CREATED: 'event_billing_override.created',
  EVENT_BILLING_OVERRIDE_UPDATED: 'event_billing_override.updated',
} as const;

export type AuditAction = typeof AUDIT_ACTION[keyof typeof AUDIT_ACTION];
