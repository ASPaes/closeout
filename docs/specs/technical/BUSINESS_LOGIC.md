# CloseOut — Business Logic: Enums e Status

## Enums de Status

### `order_status`
| Valor | Descrição |
|---|---|
| `pending` | Pedido criado, aguardando pagamento |
| `paid` | Pagamento confirmado |
| `preparing` | Em preparo |
| `ready` | Pronto para retirada/entrega |
| `delivered` | Entregue ao consumidor |
| `cancelled` | Cancelado |

### `payment_status`
| Valor | Descrição |
|---|---|
| `created` | Pagamento criado no gateway |
| `processing` | Em processamento |
| `approved` | Aprovado |
| `failed` | Falhou |
| `cancelled` | Cancelado |

### `qr_status`
| Valor | Descrição |
|---|---|
| `valid` | QR code válido e disponível para uso |
| `used` | Já utilizado |
| `cancelled` | Cancelado manualmente |
| `invalid` | Invalidado pelo sistema |

### `stock_movement_type`
| Valor | Descrição |
|---|---|
| `entry` | Entrada de estoque |
| `reservation` | Reserva (pedido em andamento) |
| `release` | Liberação de reserva (pedido cancelado) |
| `sale` | Venda confirmada (baixa definitiva) |
| `adjustment` | Ajuste manual de inventário |

### `campaign_status`
| Valor | Descrição |
|---|---|
| `scheduled` | Agendada para início futuro |
| `active` | Em andamento |
| `paused` | Pausada temporariamente |
| `ended` | Encerrada |

### `cash_register_status`
| Valor | Descrição |
|---|---|
| `open` | Caixa aberto |
| `closed` | Caixa fechado |

### `waiter_session_status`
| Valor | Descrição |
|---|---|
| `active` | Sessão ativa do garçom |
| `closed` | Sessão encerrada |

### `order_origin`
| Valor | Descrição |
|---|---|
| `consumer_app` | Pedido feito pelo app do consumidor |
| `waiter_app` | Pedido registrado pelo garçom |
| `cashier` | Pedido registrado no caixa |

## Enums Existentes

### `app_role`
super_admin, client_admin, venue_manager, event_manager, event_organizer, staff, waiter, cashier, consumer

### `event_status`
draft, active, completed, cancelled
