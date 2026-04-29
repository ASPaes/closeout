import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarDays } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

type Preset = "today" | "7d" | "30d" | "custom";

type Props = {
  onRangeChange: (start: Date, end: Date) => void;
};

export function AdminPeriodFilter({ onRangeChange }: Props) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handlePreset = (value: string) => {
    if (!value) return;
    const p = value as Preset;
    setPreset(p);
    setCustomRange(undefined);
    const end = new Date();
    const start = new Date();
    if (p === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (p === "7d") {
      start.setDate(start.getDate() - 7);
    } else if (p === "30d") {
      start.setDate(start.getDate() - 30);
    }
    onRangeChange(start, end);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    if (range?.from && range?.to) {
      setPreset("custom");
      const start = new Date(range.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range.to);
      end.setHours(23, 59, 59, 999);
      onRangeChange(start, end);
      setPopoverOpen(false);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  const customLabel =
    customRange?.from && customRange?.to
      ? `${formatDate(customRange.from)} — ${formatDate(customRange.to)}`
      : null;

  const isCustom = preset === "custom";

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <ToggleGroup
        type="single"
        value={isCustom ? "" : preset}
        onValueChange={handlePreset}
        className="justify-start"
      >
        <ToggleGroupItem value="today" size="sm">
          Hoje
        </ToggleGroupItem>
        <ToggleGroupItem value="7d" size="sm">
          7 dias
        </ToggleGroupItem>
        <ToggleGroupItem value="30d" size="sm">
          30 dias
        </ToggleGroupItem>
      </ToggleGroup>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal gap-2",
              isCustom && "border-primary text-primary",
            )}
          >
            <CalendarDays className="h-4 w-4" />
            {customLabel && <span>{customLabel}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}