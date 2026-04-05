import { vi } from "vitest";

// ─── Supabase Client ──────────────────────────────────────────────
const chainable = () => {
  const obj: any = {};
  const methods = [
    "select", "insert", "update", "delete", "upsert",
    "eq", "neq", "in", "is", "not", "or", "and",
    "gt", "gte", "lt", "lte", "like", "ilike",
    "order", "limit", "range", "filter",
    "maybeSingle", "single", "csv",
    "textSearch", "contains", "containedBy",
    "overlaps", "match",
  ];
  for (const m of methods) {
    obj[m] = vi.fn(() => obj);
  }
  obj.single = vi.fn().mockResolvedValue({ data: null, error: null });
  obj.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  obj.then = vi.fn((cb: any) => Promise.resolve(cb({ data: [], error: null, count: 0 })));
  return obj;
};

export const mockSupabase = {
  from: vi.fn(() => chainable()),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t", user: { id: "user-1" } } } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "test@test.com" } } }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    signOut: vi.fn().mockResolvedValue({}),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    mfa: {
      listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }),
      challenge: vi.fn().mockResolvedValue({ data: { id: "ch-1" }, error: null }),
      verify: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
  removeChannel: vi.fn(),
  functions: { invoke: vi.fn().mockResolvedValue({ data: { data: {} }, error: null }) },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "http://test.com/img.png" } })),
    })),
  },
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));

// ─── useAuth ──────────────────────────────────────────────────────
export const mockAuth = {
  session: { access_token: "test" },
  user: { id: "user-1", email: "test@test.com" },
  profile: { id: "user-1", name: "Test User", status: "active", avatar_url: null, phone: null, cpf: null, language: "pt-BR" },
  roles: [{ id: "r1", role: "super_admin", client_id: null, venue_id: null, event_id: null }],
  loading: false,
  signOut: vi.fn(),
  hasRole: vi.fn((r: string) => ["super_admin", "owner"].includes(r)),
  isSuperAdmin: true,
  isOwner: true,
  refreshRoles: vi.fn(),
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }: any) => children,
}));

// ─── i18n ─────────────────────────────────────────────────────────
vi.mock("@/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// ─── Sonner ───────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// ─── Native Bridge ───────────────────────────────────────────────
vi.mock("@/lib/native-bridge", () => ({
  vibrate: vi.fn(),
  getLocation: vi.fn().mockResolvedValue({ lat: 0, lng: 0 }),
}));

// ─── Audit ────────────────────────────────────────────────────────
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

// ─── html5-qrcode ────────────────────────────────────────────────
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ─── qrcode.react ────────────────────────────────────────────────
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: any) => `<svg data-testid="qr-code" data-value="${value}" />`,
}));

// ─── Contexts ─────────────────────────────────────────────────────
vi.mock("@/contexts/GestorContext", () => ({
  useGestor: () => ({
    effectiveClientId: "client-1",
    clientName: "Test Bar",
    isSuperAdmin: true,
    allClients: [{ id: "client-1", name: "Test Bar" }],
    selectedClientId: "client-1",
    setSelectedClientId: vi.fn(),
  }),
  GestorProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/BarContext", () => ({
  useBar: () => ({ eventId: "event-1", clientId: "client-1" }),
  BarProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/ConsumerContext", () => ({
  useConsumer: () => ({
    activeEvent: { id: "event-1", name: "Test Event", client_id: "client-1" },
    activeOrder: null,
    cart: { items: [], total: 0 },
    consumptionLimits: null,
    location: null,
    setActiveEvent: vi.fn(),
    setActiveOrder: vi.fn(),
    setLocation: vi.fn(),
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    refreshActiveOrder: vi.fn(),
    loadingOrder: false,
  }),
  ConsumerProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/WaiterContext", () => ({
  useWaiter: () => ({
    sessionId: "session-1",
    eventId: "event-1",
    clientId: "client-1",
    waiterId: "user-1",
    waiterName: "Test Waiter",
    eventName: "Test Event",
    loading: false,
    refreshSession: vi.fn(),
    pendingCallsCount: 0,
    cashCollected: 0,
    assignmentType: "free",
    assignmentValue: null,
  }),
  WaiterProvider: ({ children }: any) => children,
}));

vi.mock("@/contexts/CaixaContext", () => ({
  useCaixa: () => ({
    eventId: "event-1",
    clientId: "client-1",
    cashRegisterId: "cr-1",
    registerNumber: 1,
    operatorName: "Operador",
    eventName: "Test Event",
    availableEvents: [],
    setEventId: vi.fn(),
    loading: false,
    refreshCashRegister: vi.fn(),
    cart: [],
    setCart: vi.fn(),
    cartDiscount: 0,
    setCartDiscount: vi.fn(),
    cartPaymentMethod: "cash",
    setCartPaymentMethod: vi.fn(),
    cartAmountReceived: 0,
    setCartAmountReceived: vi.fn(),
    clearCart: vi.fn(),
  }),
  CaixaProvider: ({ children }: any) => children,
}));

// ─── Guards (renderizam children direto) ──────────────────────────
vi.mock("@/components/WaiterSessionGuard", () => ({
  WaiterSessionGuard: ({ children }: any) => children,
}));

vi.mock("@/components/BarEventGuard", () => ({
  BarEventGuard: ({ children }: any) => children,
}));

vi.mock("@/components/GestorClientGuard", () => ({
  GestorClientGuard: ({ children }: any) => children,
}));

vi.mock("@/components/CaixaEventGuard", () => ({
  CaixaEventGuard: ({ children }: any) => children,
}));

// ─── Hooks extras ─────────────────────────────────────────────────
vi.mock("@/hooks/useWaiterNotifications", () => ({
  useWaiterNotifications: vi.fn(),
}));

vi.mock("@/hooks/useConsumerNotifications", () => ({
  useConsumerNotifications: vi.fn(),
}));

vi.mock("@/hooks/useEventClosingReport", () => ({
  useEventClosingReport: () => ({ report: null, loading: false, fetchReport: vi.fn() }),
}));
