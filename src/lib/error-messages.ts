/**
 * Centralized error mapper for pt-BR friendly messages.
 * Technical details are logged to console only.
 */

const httpErrorMap: Record<number, string> = {
  400: "Requisição inválida. Verifique os dados e tente novamente.",
  401: "Sessão expirada. Faça login novamente.",
  403: "Você não tem permissão para acessar este recurso.",
  404: "Registro não encontrado.",
  409: "Conflito: esta operação não pode ser concluída no estado atual.",
  422: "Dados inválidos. Verifique os campos e tente novamente.",
  429: "Muitas requisições. Aguarde um momento e tente novamente.",
  500: "Erro interno do servidor. Tente novamente mais tarde.",
  502: "Serviço temporariamente indisponível. Tente novamente.",
  503: "Serviço temporariamente indisponível. Tente novamente.",
};

const supabaseMessageMap: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Email não confirmado. Verifique sua caixa de entrada.",
  "User already registered": "Este email já está cadastrado.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  "new row violates row-level security policy": "Você não tem permissão para esta operação.",
  "infinite recursion detected in policy": "Erro de configuração de acesso. Contate o administrador.",
  "JWT expired": "Sessão expirada. Faça login novamente.",
  "duplicate key value violates unique constraint": "Este registro já existe.",
  "Auth session missing!": "Sessão não encontrada. Faça login novamente.",
};

const pgCodeMap: Record<string, string> = {
  "23505": "Este registro já existe (duplicado).",
  "23503": "Este registro está vinculado a outros dados e não pode ser removido.",
  "42501": "Você não tem permissão para esta operação.",
  "42P17": "Erro de configuração de acesso. Contate o administrador.",
  "PGRST301": "Sessão expirada. Faça login novamente.",
};

type SupabaseError = {
  message?: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
};

/**
 * Returns a user-friendly pt-BR error message.
 * Always logs the technical error to console.
 */
export function getPtBrErrorMessage(error: SupabaseError | Error | unknown): string {
  if (!error) return "Ocorreu um erro inesperado. Tente novamente.";

  // Log technical details to console
  console.error("[CloseOut Error]", error);

  // Network errors
  if (error instanceof TypeError && error.message?.includes("fetch")) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  const err = error as SupabaseError;

  // Check by PostgreSQL error code
  if (err.code && pgCodeMap[err.code]) {
    return pgCodeMap[err.code];
  }

  // Check by HTTP status
  if (err.status && httpErrorMap[err.status]) {
    return httpErrorMap[err.status];
  }

  // Check by exact message match
  if (err.message) {
    for (const [key, value] of Object.entries(supabaseMessageMap)) {
      if (err.message.includes(key)) {
        return value;
      }
    }
  }

  // Fallback
  return "Ocorreu um erro inesperado. Tente novamente.";
}
