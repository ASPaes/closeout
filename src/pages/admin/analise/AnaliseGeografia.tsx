import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { MapPin, Building2, Trophy, PieChart, HelpCircle, Calendar, Info } from "lucide-react";

const BRAZIL_GEO_URL =
  "https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/brazil-states.geojson";

const NAME_TO_UF: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  "Amapá": "AP",
  Amazonas: "AM",
  Bahia: "BA",
  "Ceará": "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  "Goiás": "GO",
  "Maranhão": "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  "Pará": "PA",
  "Paraíba": "PB",
  "Paraná": "PR",
  Pernambuco: "PE",
  "Piauí": "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  "Rondônia": "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
const formatInt = (n: number) => new Intl.NumberFormat("pt-BR").format(n ?? 0);
const formatPct = (n: number) => `${((n ?? 0) * 100).toFixed(1)}%`;
const formatDateBR = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

type Period = "today" | "7d" | "30d" | "month";

function computePeriod(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 30);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return { start, end };
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}

function KpiCard({ title, value, subtitle, badge, icon: Icon, tooltip }: KpiCardProps) {
  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-muted-foreground truncate">{title}</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground shrink-0">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-sm">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground truncate">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
        {badge && (
          <Badge variant="outline" className="mt-2 text-[10px] px-1.5 py-0 h-4">
            {badge}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnaliseGeografia() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const { start, end } = computePeriod(period);
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_geography_metrics" as any, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      });
      if (rpcError) {
        setError(rpcError.message);
        setData(null);
      } else {
        setData(rpcData);
      }
      setLoading(false);
    };
    fetchData();
  }, [period]);

  const stateGmvMap = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.by_state ?? []).forEach((s: any) => {
      map[s.state] = s.gmv ?? 0;
    });
    return map;
  }, [data]);

  const maxStateGmv = useMemo(() => {
    const vals = Object.values(stateGmvMap);
    return Math.max(1, ...vals);
  }, [stateGmvMap]);

  const getStateColor = (stateName: string): string => {
    const uf = NAME_TO_UF[stateName] ?? null;
    if (!uf) return "hsl(var(--muted) / 0.3)";
    const gmv = stateGmvMap[uf] ?? 0;
    if (gmv === 0) return "hsl(var(--muted) / 0.2)";
    const ratio = gmv / maxStateGmv;
    if (ratio <= 0.25) return "hsl(24, 100%, 50% / 0.4)";
    if (ratio <= 0.5) return "hsl(24, 100%, 50% / 0.6)";
    if (ratio <= 0.75) return "hsl(24, 100%, 50% / 0.8)";
    return "hsl(24, 100%, 55%)";
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Geografia</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Distribuição geográfica de venues e GMV pelo Brasil
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              <span>
                Baseado em venues cadastrados com cidade/estado. GMV reage ao filtro de período.
              </span>
            </div>
          </div>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="shrink-0"
          >
            <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
            <ToggleGroupItem value="7d">7d</ToggleGroupItem>
            <ToggleGroupItem value="30d">30d</ToggleGroupItem>
            <ToggleGroupItem value="month">Mês</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <KpiCard
                title="Estados com Presença"
                value={formatInt(data?.kpis?.estados_presenca ?? 0)}
                badge="fixo"
                icon={MapPin}
                tooltip="Quantidade de estados brasileiros (UFs) onde a plataforma tem ao menos 1 venue ativo. Independe do filtro de período."
              />
              <KpiCard
                title="Cidades com Presença"
                value={formatInt(data?.kpis?.cidades_presenca ?? 0)}
                badge="fixo"
                icon={Building2}
                tooltip="Quantidade de cidades distintas onde a plataforma tem ao menos 1 venue ativo. Independe do filtro."
              />
              <KpiCard
                title="Estado Top (GMV)"
                value={data?.kpis?.estado_top ?? "—"}
                subtitle={formatBRL(data?.kpis?.estado_top_gmv ?? 0)}
                icon={Trophy}
                tooltip="Estado que gerou o maior GMV no período selecionado. Reage ao filtro."
              />
              <KpiCard
                title="Concentração Top"
                value={formatPct(data?.kpis?.concentracao_top_estado ?? 0)}
                icon={PieChart}
                tooltip="Percentual do GMV do período que vem do estado top. Quanto maior, mais concentração geográfica (risco ou foco)."
              />
            </>
          )}
        </div>

        {/* Map */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Mapa de Presença</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Cor dos estados = volume de GMV no período · Pinos = venues geolocalizados
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">zoom/pan ativo</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full aspect-[4/3] max-h-[600px]" />
            ) : (
              <div className="relative w-full aspect-[4/3] max-h-[600px] bg-muted/20 rounded-lg overflow-hidden">
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ scale: 700, center: [-54, -15] }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={4}>
                    <Geographies geography={BRAZIL_GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const stateName = geo.properties.name;
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={getStateColor(stateName)}
                              stroke="hsl(var(--border))"
                              strokeWidth={0.5}
                              style={{
                                default: { outline: "none" },
                                hover: { fill: "hsl(24, 100%, 65%)", outline: "none", cursor: "pointer" },
                                pressed: { outline: "none" },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                    {(data?.venues_geo ?? []).map((v: any) => (
                      <Marker key={v.venue_id} coordinates={[v.longitude, v.latitude]}>
                        <circle
                          r={v.gmv > 0 ? 5 : 3}
                          fill={v.gmv > 0 ? "hsl(24, 100%, 55%)" : "hsl(var(--muted-foreground) / 0.6)"}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                        />
                      </Marker>
                    ))}
                  </ZoomableGroup>
                </ComposableMap>

                {/* Legenda */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-2 rounded-md bg-background/80 backdrop-blur-sm border border-border text-[10px]">
                  <span className="text-muted-foreground">Menos GMV</span>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(24, 100%, 50% / 0.4)" }} />
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(24, 100%, 50% / 0.6)" }} />
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(24, 100%, 50% / 0.8)" }} />
                    <div className="w-3 h-3 rounded-sm" style={{ background: "hsl(24, 100%, 55%)" }} />
                  </div>
                  <span className="text-muted-foreground">Mais GMV</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado + Cidade */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>GMV por Estado</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Estados ordenados por volume transacionado</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-96 w-full" />
              ) : (data?.by_state ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem venues cadastrados</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 px-3 text-right">Venues</th>
                        <th className="py-2 px-3 text-right">Cidades</th>
                        <th className="py-2 pl-3 text-right">GMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_state.map((s: any) => (
                        <tr key={s.state} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-3 font-medium text-foreground">{s.state}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{formatInt(s.venues_count)}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground">{formatInt(s.cities_count)}</td>
                          <td className="py-2 pl-3 text-right font-medium text-foreground">{formatBRL(s.gmv)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GMV por Cidade</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Top cidades com venues ativos</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-96 w-full" />
              ) : (data?.by_city ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem cidades cadastradas</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {data.by_city.map((c: any, idx: number) => {
                    const maxGmv = Math.max(...data.by_city.map((x: any) => x.gmv ?? 0), 1);
                    const pct = (c.gmv ?? 0) / maxGmv;
                    return (
                      <div key={`${c.city}-${c.state}-${idx}`} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {c.city}, {c.state}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatBRL(c.gmv)} · {formatInt(c.venues_count)} venue(s)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.max(2, pct * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <CardTitle>Expansão Geográfica</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Quando a plataforma entrou em cada estado</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : (data?.expansion_timeline ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem histórico de expansão</p>
            ) : (
              <div className="space-y-3">
                {data.expansion_timeline.map((e: any, idx: number) => (
                  <div
                    key={`${e.state}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/20 transition-colors"
                  >
                    <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {e.state}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Plataforma entrou em {e.state}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateBR(e.first_venue_at)} · Hoje: {formatInt(e.total_venues_now)} venue(s) em{" "}
                        {formatInt(e.total_cities_now)} cidade(s)
                      </p>
                    </div>
                    {idx === 0 && (
                      <Badge variant="outline" className="shrink-0 border-primary/40 text-primary">
                        primeiro estado
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
