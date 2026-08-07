import "server-only";

import type { Locale } from "./config";
import type en from "./dictionaries/en.json";

/** The English file is the source of truth for the shape of every dictionary. */
export type Dictionary = typeof en;

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("./dictionaries/en.json").then((m) => m.default),
  tr: () => import("./dictionaries/tr.json").then((m) => m.default),
  fa: () => import("./dictionaries/fa.json").then((m) => m.default),
  ar: () => import("./dictionaries/ar.json").then((m) => m.default),
  es: () => import("./dictionaries/es.json").then((m) => m.default),
};

/** Only the requested locale's strings are ever sent to the client. */
export function getDictionary(locale: Locale): Promise<Dictionary> {
  return loaders[locale]();
}
