// Configurações gerais do app: tom do texto, histórico e backup.
import type { Tone } from "./broker/writing";
import type { Perfil } from "./backup";
import { loadJSON } from "./util";

export interface AppSettings {
  tone: Tone;
  historyOn: boolean;
  historyMax: number;
  /** salvar sozinho enquanto você escreve */
  autosaveOn: boolean;
  /** guardar o log de alterações (patches) de cada documento */
  commitsOn: boolean;
  /** cópias dos documentos em disco */
  backupOn: boolean;
  /** pasta escolhida pelo usuário para o backup (vazio = só a pasta do app) */
  backupRoot: string;
  /** perfil de limpeza: quanto cada documento guarda */
  backupProfile: Perfil;
  /** números usados quando o perfil é "personalizado" */
  backupCopies: number;
  backupDays: number;
  /** avisar quando o arquivo original sumir mas o backup estiver lá */
  backupWarnMissing: boolean;
  /** a pergunta da primeira vez já foi respondida */
  backupAsked: boolean;
}

const KEY = "mdc.settings";

const DEFAULTS: AppSettings = {
  tone: "formal",
  historyOn: true,
  historyMax: 60,
  autosaveOn: true,
  commitsOn: true,
  backupOn: true,
  backupRoot: "",
  backupProfile: "equilibrado",
  backupCopies: 50,
  backupDays: 30,
  backupWarnMissing: true,
  backupAsked: false,
};

export function loadSettings(): AppSettings {
  const saved = loadJSON<Partial<AppSettings>>(KEY, {});
  const tone: Tone = saved.tone === "neutro" || saved.tone === "informal" ? saved.tone : "formal";
  const perfil = saved.backupProfile;
  const backupProfile: Perfil =
    perfil === "leve" || perfil === "maximo" || perfil === "personalizado" ? perfil : "equilibrado";
  return { ...DEFAULTS, ...saved, tone, backupProfile };
}