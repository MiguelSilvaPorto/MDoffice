// Áudio e vídeo na apresentação: tipo do arquivo, opções de reprodução e as contas puras
// (normalização do volume e do corte). O desenho e a reprodução ficam em render/midia.ts.
import type { Midia, MidiaTipo, ShapeBox } from "../schema";

/** Rótulo do tipo (fita, painel e mensagens). */
export const MIDIA_ROTULOS: Record<MidiaTipo, string> = { audio: "Áudio", video: "Vídeo" };

/** Extensões aceitas em cada tipo. */
export const MIDIA_EXTS: Record<MidiaTipo, string[]> = {
  video: ["mp4", "webm", "ogv", "mov", "m4v", "mkv"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"],
};

/** MIME das extensões que o motor conhece (importação, exportação e data URLs). */
export const MIDIA_MIMES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
};

const MIME_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
};

/** Extensão do arquivo pelo nome (sem depender do sistema). */
export function extDoNome(nome: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Tipo de mídia pela extensão do arquivo; null quando não é áudio nem vídeo conhecido. */
export function tipoDeArquivo(nome: string): MidiaTipo | null {
  const ext = extDoNome(nome);
  if (MIDIA_EXTS.video.includes(ext)) return "video";
  if (MIDIA_EXTS.audio.includes(ext)) return "audio";
  return null;
}

/** Extensão para nomear o arquivo em ppt/media a partir do MIME (ou do nome original). */
export function extDeMime(mime: string, nome?: string): string {
  return MIME_EXT[mime] ?? extDoNome(nome ?? "") ?? "bin";
}

/** MIME pela extensão (data URL do arquivo importado/exportado). */
export function mimeDeExt(ext: string): string {
  return MIDIA_MIMES[ext.toLowerCase()] ?? "application/octet-stream";
}

/** Opções padrão de uma mídia recém-inserida: vídeo começa sozinho e com controles; áudio espera o clique. */
export function midiaPadrao(tipo: MidiaTipo, nome?: string): Midia {
  return { tipo, auto: tipo === "video", loop: false, controles: tipo === "video", continuar: false, volume: 1, nome };
}

/** Volume, corte e nome dentro dos limites (0-1, início >= 0, fim > início). */
export function normalizarMidia(m: Midia): Midia {
  const out: Midia = { ...m, volume: Math.max(0, Math.min(1, Number.isFinite(m.volume) ? (m.volume as number) : 1)) };
  if (m.corte) {
    const inicio = Math.max(0, Number.isFinite(m.corte.inicio) ? m.corte.inicio : 0);
    const fim = m.corte.fim !== undefined && Number.isFinite(m.corte.fim) ? Math.max(inicio + 0.1, m.corte.fim) : undefined;
    out.corte = { inicio, fim };
  }
  return out;
}

export function comOpcaoMidia(m: Midia, chave: "auto" | "loop" | "controles" | "continuar", ligado: boolean): Midia {
  return normalizarMidia({ ...m, [chave]: ligado });
}

export function comVolumeDaMidia(m: Midia, volume: number): Midia {
  return normalizarMidia({ ...m, volume });
}

export function comCorteDaMidia(m: Midia, inicio: number, fim?: number): Midia {
  return normalizarMidia({ ...m, corte: { inicio, fim } });
}

/** O trecho que deve tocar agora (segundos), já respeitando o corte. */
export function trechoDaMidia(m: Midia): { inicio: number; fim: number | null } {
  const inicio = Math.max(0, m.corte?.inicio ?? 0);
  const fim = m.corte?.fim !== undefined ? Math.max(inicio + 0.1, m.corte.fim) : null;
  return { inicio, fim };
}

/** Caixa padrão de uma mídia nova, centrada na lâmina (vídeo 16:9; áudio num cartão baixo). */
export function caixaDaMidia(tipo: MidiaTipo, larguraPt: number, alturaPt: number): ShapeBox {
  const w = Math.min(tipo === "video" ? 62 : 46, Math.max(30, (tipo === "video" ? 480 : 360 / 1.6) / larguraPt * 100));
  const h = tipo === "video" ? Math.min(60, Math.max(24, (w / 100 * larguraPt * 9) / 16 / alturaPt * 100)) : 16;
  const y = tipo === "video" ? (100 - h) / 2 : 68;
  return { x: (100 - w) / 2, y, w, h };
}
