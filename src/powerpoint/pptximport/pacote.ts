// O pacote .pptx: um ZIP com partes (XML e mídia) ligadas por relacionamentos (.rels).
// Esta camada só abre o ZIP e resolve caminhos; quem interpreta o conteúdo são os outros módulos.
import { filhos, lerXml, type No } from "./xmltree";

export interface Relacao {
  id: string;
  /** último trecho do tipo (slideLayout, image, notesSlide, theme...) */
  tipo: string;
  /** caminho absoluto dentro do zip (sem "/" no início) */
  alvo: string;
  externo: boolean;
}

/** Resolve um alvo de relacionamento em relação à parte que o declarou. */
export function resolverAlvo(parte: string, alvo: string): string {
  if (alvo.startsWith("/")) return alvo.slice(1);
  const base = parte.split("/").slice(0, -1);
  for (const seg of alvo.split("/")) {
    if (seg === "..") base.pop();
    else if (seg !== "." && seg !== "") base.push(seg);
  }
  return base.join("/");
}

export class Pacote {
  private cacheXml = new Map<string, No | undefined>();
  private cacheRels = new Map<string, Map<string, Relacao>>();

  constructor(private zip: any) {}

  static async abrir(bytes: Uint8Array): Promise<Pacote> {
    const { default: JSZip } = await import("jszip");
    return new Pacote(await JSZip.loadAsync(bytes));
  }

  existe(caminho: string): boolean {
    return !!this.zip.file(caminho);
  }

  nomes(): string[] {
    return Object.keys(this.zip.files);
  }

  async texto(caminho: string): Promise<string | undefined> {
    const f = this.zip.file(caminho);
    return f ? await f.async("string") : undefined;
  }

  async bytes(caminho: string): Promise<Uint8Array | undefined> {
    const f = this.zip.file(caminho);
    return f ? await f.async("uint8array") : undefined;
  }

  /** Lê e interpreta uma parte XML (com cache). */
  async xml(caminho: string): Promise<No | undefined> {
    if (this.cacheXml.has(caminho)) return this.cacheXml.get(caminho);
    const t = await this.texto(caminho);
    const no = t === undefined ? undefined : lerXml(t);
    this.cacheXml.set(caminho, no);
    return no;
  }

  /** Relacionamentos de uma parte (por id). */
  async relacoes(parte: string): Promise<Map<string, Relacao>> {
    const achada = this.cacheRels.get(parte);
    if (achada) return achada;
    const mapa = new Map<string, Relacao>();
    const pasta = parte.split("/").slice(0, -1).join("/");
    const arq = parte.split("/").pop()!;
    const raiz = await this.xml(`${pasta ? pasta + "/" : ""}_rels/${arq}.rels`);
    for (const r of filhos(raiz, "Relationship")) {
      const externo = r.a.TargetMode === "External";
      mapa.set(r.a.Id, {
        id: r.a.Id,
        tipo: (r.a.Type ?? "").split("/").pop() ?? "",
        alvo: externo ? (r.a.Target ?? "") : resolverAlvo(parte, r.a.Target ?? ""),
        externo,
      });
    }
    this.cacheRels.set(parte, mapa);
    return mapa;
  }

  /** Primeira relação de um tipo (ex.: o layout de um slide). */
  async relacaoDoTipo(parte: string, tipo: string): Promise<Relacao | undefined> {
    for (const r of (await this.relacoes(parte)).values()) if (r.tipo === tipo) return r;
    return undefined;
  }
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  emf: "image/x-emf",
  wmf: "image/x-wmf",
};

export function mimeDe(caminho: string): string {
  return MIME[(caminho.split(".").pop() ?? "").toLowerCase()] ?? "application/octet-stream";
}

/** Bytes -> data URL (em blocos, para não estourar a pilha em imagens grandes). */
export function paraDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) bin += String.fromCharCode(...bytes.subarray(i, i + bloco));
  return `data:${mime};base64,${btoa(bin)}`;
}
