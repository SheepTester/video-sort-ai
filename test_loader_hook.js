import { resolve as resolveTs } from "node:path";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".tsx")) {
    try {
      return await nextResolve(specifier + ".ts", context);
    } catch {
      try {
        return await nextResolve(specifier + ".tsx", context);
      } catch {}
    }
  }
  return nextResolve(specifier, context);
}