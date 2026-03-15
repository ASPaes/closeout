import { type ReactNode, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useDebounce } from "@/hooks/use-debounce";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptyHint?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  filters?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  search,
  onSearchChange,
  searchPlaceholder,
  emptyMessage = "Nenhum resultado encontrado",
  emptyHint,
  emptyActionLabel,
  onEmptyAction,
  filters,
}: DataTableProps<T>) {
  // Internal search state with debounce for parent callback
  const [internalSearch, setInternalSearch] = useState(search ?? "");
  const debouncedSearch = useDebounce(internalSearch, 250);

  // Sync debounced value to parent
  const handleSearchChange = (value: string) => {
    setInternalSearch(value);
    // We pass immediately to parent for controlled usage, 
    // but parent should use the value from props
    onSearchChange?.(value);
  };

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      {(onSearchChange || filters) && (
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border/40">
          {onSearchChange && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 bg-secondary/50 border-border/60 transition-shadow duration-200 focus:glow-sm"
              />
            </div>
          )}
          {filters}
        </div>
      )}
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-in">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/40 hover:bg-transparent">
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="p-0">
                    <EmptyState
                      message={emptyMessage}
                      hint={emptyHint}
                      actionLabel={emptyActionLabel}
                      onAction={onEmptyAction}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={keyExtractor(row)} className="border-border/30 transition-colors duration-150">
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
