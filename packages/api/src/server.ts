import { createContext } from "./context";
import { createCaller } from "./root";

/** Server-side caller for React Server Components and server actions: no HTTP hop. */
export async function api(headers: Headers) {
  return createCaller(await createContext(headers));
}
