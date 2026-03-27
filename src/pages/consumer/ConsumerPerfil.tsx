import { useNavigate } from "react-router-dom";
import {
  User,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Wallet,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

const mockProfile = {
  name: "Lucas Oliveira",
  email: "lucas@email.com",
  phone: "(11) 99876-5432",
  avatar: "LO",
  eventsAttended: 12,
  totalSpent: 1847.5,
};

const menuSections = [
  {
    title: "Conta",
    items: [
      { icon: User, label: "Dados Pessoais", path: "/app/perfil", color: "text-primary" },
      { icon: CreditCard, label: "Métodos de Pagamento", path: "/app/perfil", color: "text-info" },
      { icon: Wallet, label: "Meus Limites", path: "/app/limites", color: "text-warning" },
    ],
  },
  {
    title: "Evento",
    items: [
      { icon: MapPin, label: "Check-in / Presença", path: "/app/checkin", color: "text-success" },
      { icon: Bell, label: "Notificações", path: "/app/perfil", color: "text-accent-foreground" },
    ],
  },
  {
    title: "Suporte",
    items: [
      { icon: Shield, label: "Privacidade e Segurança", path: "/app/perfil", color: "text-muted-foreground" },
      { icon: HelpCircle, label: "Ajuda", path: "/app/perfil", color: "text-muted-foreground" },
    ],
  },
];

export default function ConsumerPerfil() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-5">
      {/* Profile header */}
      <div className="flex flex-col items-center rounded-2xl border border-border/60 bg-card p-5">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-2xl font-bold text-primary-foreground"
          style={{ boxShadow: "0 0 30px hsl(24 100% 50% / 0.3)" }}
        >
          {mockProfile.avatar}
        </div>
        <h1 className="mt-3 text-lg font-bold text-foreground">{mockProfile.name}</h1>
        <p className="text-xs text-muted-foreground">{mockProfile.email}</p>

        {/* Stats */}
        <div className="mt-4 grid w-full grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-primary">{mockProfile.eventsAttended}</p>
            <p className="text-[10px] text-muted-foreground">Eventos</p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-lg font-bold text-primary">R$ {mockProfile.totalSpent.toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground">Total gasto</p>
          </div>
        </div>
      </div>

      {/* Menu sections */}
      {menuSections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">
            {section.title}
          </h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            {section.items.map((item, i) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex w-full min-h-[48px] items-center gap-3 px-4 py-3 text-left active:bg-secondary/50 transition-colors",
                  i > 0 && "border-t border-border/30"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", item.color)} />
                <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <button className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive active:bg-destructive/10 transition-colors">
        <LogOut className="h-4 w-4" />
        Sair da conta
      </button>

      <p className="text-center text-[10px] text-muted-foreground/40 pb-2">
        Close Out v1.0 · © 2026
      </p>
    </div>
  );
}
