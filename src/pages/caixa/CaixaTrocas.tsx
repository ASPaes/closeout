import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ManagerApprovalDialog } from "@/components/caixa/ManagerApprovalDialog";
import { CaixaEventGuard } from "@/components/CaixaEventGuard";
import { useTranslation } from "@/i18n/use-translation";
import { useCaixa } from "@/contexts/CaixaContext";
import { useAuth } from "@/hooks/useAuth";
import { useEventCatalog, type CatalogProduct } from "@/hooks/usePOSCatalog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { AUDIT_ACTION } from "@/config/audit-actions";
import { toast } from "sonner";
import { ArrowLeftRight, Search, Plus, ShoppingBag } from "lucide-react";
import { OrderPickerDialog } from "@/components/caixa/OrderPickerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { ModalForm } from "@/components/ModalForm";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

type ExchangeRow = {
  id: string;
  created_at: string;
  cash_order_id: string;
  original_item: Json;
  new_item: Json;
  price_difference: number;
  adjustment_direction: string;
  order_number?: number;
};

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
  type: string;
  id: string;
};

type CashOrder = {
  id: string;
  order_number: number;
  created_at: string;
  items: Json;
  total: number;
  payment_method: string;
  status: string;
};

export default function CaixaTrocas() {
  const { t } = useTranslation();
  const { eventId, clientId, cashRegisterId } = useCaixa();
  const { session } = useAuth();
  const { data: catalogData } = useEventCatalog();

  // List state
  const [exchanges, setExchanges] = useState<ExchangeRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  // Step 1
  const [pickerOpen, setPickerOpen] = useState(false);
  const [foundOrder, setFoundOrder] = useState<CashOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Step 2
  const [selectedItemIdx, setSelectedItemIdx] = useState<string>("");

  // Step 3
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<CatalogProduct | null>(null);

  const catalogItems = catalogData?.items ?? [];
  const categories = catalogData?.categories ?? [];

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Fetch exchanges list
  const fetchExchanges = async () => {
    if (!eventId) return;
    setLoadingList(true);
    const { data } = await supabase
      .from("exchanges")
      .select("id, created_at, cash_order_id, original_item, new_item, price_difference, adjustment_direction")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (!data) {
      setExchanges([]);
      setLoadingList(false);
      return;
    }

    const orderIds = [...new Set(data.map((r) => r.cash_order_id))];
    const ordersRes = orderIds.length > 0
      ? await supabase.from("cash_orders").select("id, order_number").in("id", orderIds)
      : { data: [] };

    const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]));

    setExchanges(
      data.map((r) => ({
        ...r,
        order_number: orderMap.get(r.cash_order_id),
      }))
    );
    setLoadingList(false);
  };

  useEffect(() => {
    fetchExchanges();
  }, [eventId]);

  // Handle order selection from picker
  const handleOrderSelected = (order: CashOrder) => {
    setFoundOrder(order);
    const items = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
    setOrderItems(items);
  };

  const selectedOriginal = selectedItemIdx !== "" ? orderItems[parseInt(selectedItemIdx, 10)] : null;

  const priceDifference = useMemo(() => {
    if (!selectedOriginal || !newItem) return 0;
    return selectedOriginal.price - newItem.price;
  }, [selectedOriginal, newItem]);

  const adjustmentDirection = priceDifference > 0 ? "refund" : priceDifference < 0 ? "charge" : "none";

  // Reset modal
  const resetModal = () => {
    setStep(1);
    setFoundOrder(null);
    setOrderItems([]);
    setSelectedItemIdx("");
    setCatalogSearch("");
    setSelectedCategory(null);
    setNewItem(null);
    setApprovalOpen(false);
  };

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    let result = catalogItems;
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (selectedCategory) {
      result = result.filter((i) => i.categoryId === selectedCategory);
    }
    return result;
  }, [catalogItems, catalogSearch, selectedCategory]);

  // Save exchange
  const handleConfirm = async () => {
    if (!selectedOriginal || !newItem || !foundOrder || !cashRegisterId || !eventId || !clientId || !session?.user?.id)
      return;
    setSaving(true);

    try {
      const originalItemData = {
        id: selectedOriginal.id,
        name: selectedOriginal.name,
        price: selectedOriginal.price,
        type: selectedOriginal.type,
      };
      const newItemData = {
        id: newItem.id,
        name: newItem.name,
        price: newItem.price,
        type: newItem.type,
      };

      const { error } = await supabase.from("exchanges").insert({
        cash_order_id: foundOrder.id,
        cash_register_id: cashRegisterId,
        event_id: eventId,
        client_id: clientId,
        operator_id: session.user.id,
        original_item: originalItemData as unknown as Json,
        new_item: newItemData as unknown as Json,
        price_difference: Math.abs(priceDifference),
        adjustment_direction: adjustmentDirection,
      });

      if (error) throw error;

      // Register cash movement if there's a difference
      if (priceDifference !== 0) {
        await supabase.from("cash_movements").insert({
          cash_register_id: cashRegisterId,
          event_id: eventId,
          client_id: clientId,
          operator_id: session.user.id,
          movement_type: "exchange_adjustment",
          direction: priceDifference > 0 ? "out" : "in",
          amount: Math.abs(priceDifference),
          destination: `Troca pedido #${foundOrder.order_number}`,
          notes: `${selectedOriginal.name} → ${newItem.name}`,
        });
      }

      // Stock adjustments: return original item, remove new item
      if (selectedOriginal.type === "product" && selectedOriginal.id) {
        await supabase.from("stock_entries").insert({
          client_id: clientId,
          product_id: selectedOriginal.id,
          entry_type: "add",
          quantity: 1,
          reason: `Troca - devolvido (pedido #${foundOrder.order_number})`,
          created_by: session.user.id,
        });
      }
      if (newItem.type === "product" && newItem.id) {
        await supabase.from("stock_entries").insert({
          client_id: clientId,
          product_id: newItem.id,
          entry_type: "remove",
          quantity: 1,
          reason: `Troca - entregue (pedido #${foundOrder.order_number})`,
          created_by: session.user.id,
        });
      }

      await logAudit({
        action: AUDIT_ACTION.CASH_EXCHANGE_CREATED,
        entityType: "exchange",
        entityId: foundOrder.id,
        oldData: originalItemData,
        newData: { ...newItemData, price_difference: Math.abs(priceDifference), adjustment_direction: adjustmentDirection },
      });

      toast.success(t("exc_save_success"));
      setModalOpen(false);
      resetModal();
      fetchExchanges();
    } catch {
      toast.error(t("exc_save_error"));
    } finally {
      setSaving(false);
    }
  };

  // Columns
  const columns: DataTableColumn<ExchangeRow>[] = [
    {
      key: "created_at",
      header: t("mov_col_datetime"),
      render: (r) => format(new Date(r.created_at), "dd/MM/yyyy HH:mm"),
    },
    {
      key: "order_number",
      header: t("ret_col_order"),
      render: (r) => (r.order_number ? `#${r.order_number}` : "-"),
    },
    {
      key: "original_item",
      header: t("exc_col_original"),
      render: (r) => {
        const item = r.original_item as Record<string, unknown> | null;
        return item ? String(item.name ?? "-") : "-";
      },
    },
    {
      key: "new_item",
      header: t("exc_col_new"),
      render: (r) => {
        const item = r.new_item as Record<string, unknown> | null;
        return item ? String(item.name ?? "-") : "-";
      },
    },
    {
      key: "price_difference",
      header: t("exc_col_difference"),
      render: (r) => fmt(r.price_difference),
    },
    {
      key: "adjustment_direction",
      header: t("exc_col_direction"),
      render: (r) => {
        if (r.adjustment_direction === "refund")
          return <Badge variant="outline" className="text-orange-400 border-orange-400/40">{t("exc_dir_refund")}</Badge>;
        if (r.adjustment_direction === "charge")
          return <Badge variant="outline" className="text-blue-400 border-blue-400/40">{t("exc_dir_charge")}</Badge>;
        return <Badge variant="secondary">{t("exc_dir_none")}</Badge>;
      },
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && foundOrder) {
      setStep(2);
    } else if (step === 2 && selectedOriginal) {
      setStep(3);
    } else if (step === 3 && newItem) {
      // Open approval dialog instead of confirming directly
      setModalOpen(false);
      setApprovalOpen(true);
    }
  };

  const handleExchangeApproved = async (_managerId: string) => {
    setApprovalOpen(false);
    await handleConfirm();
  };

  const stepTitle =
    step === 1 ? t("exc_step1_title") : step === 2 ? t("exc_step2_title") : t("exc_step3_title");

  const canProceed =
    step === 1 ? !!foundOrder : step === 2 ? !!selectedOriginal : !!newItem;

  // Render steps
  const renderStep1 = () => (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2"
        onClick={() => setPickerOpen(true)}
      >
        <ShoppingBag className="h-4 w-4" />
        {foundOrder
          ? `${t("ret_order_label")} #${foundOrder.order_number}`
          : t("order_picker_select")}
      </Button>

      <OrderPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        eventId={eventId}
        onSelect={handleOrderSelected}
      />

      {foundOrder && (
        <Card className="border-border/60 bg-secondary/30">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">
              {t("ret_order_label")} #{foundOrder.order_number} —{" "}
              {format(new Date(foundOrder.created_at), "dd/MM/yyyy HH:mm")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xs text-muted-foreground mb-2">
              {t("pos_total")}: {fmt(foundOrder.total)} — {foundOrder.payment_method}
            </p>
            <p className="text-xs text-muted-foreground">
              {orderItems.length} {t("exc_items_count")}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{t("exc_select_item")}</Label>
      <RadioGroup value={selectedItemIdx} onValueChange={setSelectedItemIdx}>
        {orderItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-md border border-border/40 bg-muted/30 p-3">
            <RadioGroupItem value={String(idx)} id={`item-${idx}`} />
            <label htmlFor={`item-${idx}`} className="flex-1 cursor-pointer">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{fmt(item.price)}</span>
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      {/* Selected original */}
      {selectedOriginal && (
        <Card className="border-border/60 bg-secondary/30">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{t("exc_original_item")}</p>
            <p className="text-sm font-medium">{selectedOriginal.name} — {fmt(selectedOriginal.price)}</p>
          </CardContent>
        </Card>
      )}

      {/* Catalog search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("pos_search_products")}
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setSelectedCategory(null)}
        >
          {t("pos_all_categories")}
        </Badge>
        {categories.map((cat) => (
          <Badge
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
          >
            {cat.name}
          </Badge>
        ))}
      </div>

      {/* Product grid */}
      <ScrollArea className="h-[200px]">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-2">
          {filteredCatalog.map((item) => {
            const isSelected = newItem?.id === item.id;
            return (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => setNewItem(item)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all active:scale-[0.98] ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border/60 bg-card hover:border-primary/40"
                }`}
              >
                <span className="text-sm font-medium truncate w-full">{item.name}</span>
                <span className="text-primary font-bold text-sm">{fmt(item.price)}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Price comparison */}
      {newItem && selectedOriginal && (
        <Card className="border-border/60">
          <CardContent className="py-3 px-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("exc_original_item")}</span>
              <span>{fmt(selectedOriginal.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("exc_new_item")}</span>
              <span>{fmt(newItem.price)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-border/40 pt-1">
              <span>{t("exc_col_difference")}</span>
              <span>{fmt(Math.abs(priceDifference))}</span>
            </div>
            <p className={`text-xs font-medium mt-1 ${
              adjustmentDirection === "refund"
                ? "text-orange-400"
                : adjustmentDirection === "charge"
                  ? "text-blue-400"
                  : "text-muted-foreground"
            }`}>
              {adjustmentDirection === "refund" && t("exc_refund_msg").replace("%s", fmt(Math.abs(priceDifference)))}
              {adjustmentDirection === "charge" && t("exc_charge_msg").replace("%s", fmt(Math.abs(priceDifference)))}
              {adjustmentDirection === "none" && t("exc_no_difference")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <CaixaEventGuard requireRegister>
      <PageHeader
        title={t("caixa_exchanges")}
        icon={ArrowLeftRight}
        actions={
          <Button onClick={() => { resetModal(); setModalOpen(true); }} className="glow-hover">
            <Plus className="mr-2 h-4 w-4" />
            {t("exc_new")}
          </Button>
        }
      />

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={exchanges}
          keyExtractor={(r) => r.id}
          loading={loadingList}
          emptyMessage={t("exc_empty")}
          emptyHint={t("exc_empty_hint")}
        />
      </div>

      <ModalForm
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) resetModal(); }}
        title={stepTitle}
        onSubmit={handleSubmit}
        saving={saving}
        submitLabel={step < 3 ? t("ret_next") : t("exc_confirm")}
        disabled={!canProceed}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </ModalForm>
    </CaixaEventGuard>
  );
}
