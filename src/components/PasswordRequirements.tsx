import { Check, X } from "lucide-react";

export function validatePassword(pw: string) {
  const result = {
    minLength: pw.length >= 6,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
  return {
    ...result,
    isValid: result.minLength && result.hasUpper && result.hasLower && result.hasNumber && result.hasSpecial,
  };
}

interface PasswordRequirementsProps {
  password: string;
  show: boolean;
}

const requirements = [
  { key: "minLength" as const, label: "Mínimo 6 caracteres" },
  { key: "hasUpper" as const, label: "Letra maiúscula (A-Z)" },
  { key: "hasLower" as const, label: "Letra minúscula (a-z)" },
  { key: "hasNumber" as const, label: "Número (0-9)" },
  { key: "hasSpecial" as const, label: "Caractere especial (!@#$%)" },
];

export function PasswordRequirements({ password, show }: PasswordRequirementsProps) {
  if (!show) return null;

  const validation = validatePassword(password);

  return (
    <div className="flex flex-col gap-1 mt-1">
      {requirements.map((req) => {
        const met = validation[req.key];
        return (
          <div key={req.key} className="flex items-center gap-1.5">
            {met ? (
              <Check className="h-3 w-3 text-success shrink-0" />
            ) : (
              <X className="h-3 w-3 text-destructive shrink-0" />
            )}
            <span className={`text-xs ${met ? "text-muted-foreground line-through opacity-60" : "text-muted-foreground"}`}>
              {req.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
