// Ferramentas de manutenção do Markdown (reparar alinhamentos).

import type { App } from "./app";
import { $, toast } from "../util";

export const mdToolsMethods = {
  /**
   * Repara os blocos de alinhamento: remove `</div>` que sobrou e fecha os `<div align>`
   * que ficaram abertos (o bug antigo de aninhamento deixava os dois casos).
   */
  repairAlignments(this: App): void {
    const texto = this.editor.getText();
    const abrirRx = /^<div align="(left|center|right|justify)">$/;
    const saida: string[] = [];
    let abertos = 0;
    let removidos = 0;
    let emCodigo = false;

    for (const linha of texto.split("\n")) {
      const t = linha.trim();
      if (t.startsWith("```")) {
        emCodigo = !emCodigo;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && abrirRx.test(t)) {
        abertos++;
        saida.push(linha);
        continue;
      }
      if (!emCodigo && t === "</div>") {
        if (abertos === 0) {
          removidos++; // fechamento sobrando
          continue;
        }
        abertos--;
        saida.push(linha);
        continue;
      }
      saida.push(linha);
    }

    let fechados = 0;
    if (abertos > 0) {
      if (saida.length && saida[saida.length - 1].trim() !== "") saida.push("");
      for (let i = 0; i < abertos; i++) {
        saida.push("</div>");
        saida.push("");
      }
      fechados = abertos;
    }

    if (!removidos && !fechados) {
      toast("Os alinhamentos já estão certos — nada para reparar.", "info", 2800);
      return;
    }
    this.editor.replaceRange(0, texto.length, saida.join("\n"));
    const partes = [];
    if (removidos) partes.push(`${removidos} fechamento(s) sobrando`);
    if (fechados) partes.push(`${fechados} bloco(s) sem fechar`);
    toast(`Alinhamentos reparados: ${partes.join(" e ")}.`, "ok", 4200);
  },
};
