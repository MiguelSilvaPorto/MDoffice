// Configurações gerais do app: tom do texto e histórico de versões.
import type { Tone } from "./broker/writing";
import { loadJSON } from "./util";

export interface AppSettings {
  tone: Tone;
  historyOn: boolean;
  historyMax: number;
}

const KEY = "mdc.settings";
const DEFAULTS: AppSettings = { tone: "formal", historyOn: true, historyMax: 60 };

export function loadSettings(): AppSettings {
  const saved = loadJSON<Partial<AppSettings>>(KEY, {});
  const tone: Tone = saved.tone === "neutro" || saved.tone === "informal" ? saved.tone : "formal";
  return { ...DEFAULTS, ...saved, tone };
}
