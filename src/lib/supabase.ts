import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./api-error";

/** PostgREST normally returns errors as values. Never turn a failed query into []/success. */
export async function databaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response: Response;
  try { response = await fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) }); }
  catch { throw new ApiError("INTERNAL_ERROR", "Banco indisponível. Seus dados não foram apagados; tente novamente."); }
  if (!response.ok) {
    const body = await response.clone().json().catch(() => ({}));
    const conflict = ["40001", "23505"].includes(body.code);
    throw new ApiError(conflict ? "CONFLICT" : "INTERNAL_ERROR", conflict
      ? "Os dados mudaram ou já existem. Atualize a tela e tente novamente."
      : "Não foi possível concluir a operação no banco. Tente novamente.");
  }
  return response;
}

function createDatabaseClient() { return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { global: { fetch: databaseFetch }, auth: { persistSession: false, autoRefreshToken: false } }
); }

// Resolve runtime secrets only when a request uses the database; builds need no credentials.
let client: ReturnType<typeof createDatabaseClient> | undefined;
export const supabase = new Proxy({} as ReturnType<typeof createDatabaseClient>, {
  get(_target, key) {
    client ??= createDatabaseClient();
    const value = Reflect.get(client, key);
    if ((key === "from" || key === "rpc") && typeof value === "function") return (...args: unknown[]) => checkedQuery(value.apply(client, args));
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** PostgREST catches fetch exceptions by default. Every awaited query must opt out. */
function checkedQuery<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, key) {
      if(key === "then") {
        const query=target as T & {throwOnError:()=>unknown};
        query.throwOnError();
        const then = Reflect.get(target,key) as (...args: unknown[]) => unknown;
        return then.bind(target);
      }
      const value=Reflect.get(target,key);
      if(typeof value!=="function") return value;
      return (...args:unknown[])=>{
        const result=value.apply(target,args);
        return result && typeof result==="object" ? checkedQuery(result) : result;
      };
    },
  });
}
