# Avisos de terceiros

O mdOffice é original. Este arquivo registra o material de terceiros cujo **uso
foi inspirado ou adaptado** aqui, com a licença pedida por cada um.

## WordCraft (ArtCraft)

- Projeto: <https://github.com/storytold/wordcraft>
- Licença: **MIT OR Apache-2.0** (escolhemos a MIT, abaixo)
- Copyright (c) 2026 ArtCraft Team and the WordCraft contributors.

**O que foi adaptado:** a técnica de **reancorar** uma imagem flutuante quando
ela é arrastada pelo texto — o objeto é tirado do parágrafo de origem, reinserido
no parágrafo que ficou sob ele e o deslocamento é recalculado a partir da nova
âncora (em vez de a âncora ficar presa). A referência é o comando
`move_object_once` do WordCraft (`crates/engine/src/cmd/objects.rs`), que faz o
mesmo no motor de layout deles.

O código do mdOffice é original (TypeScript, no navegador, com o layout do
navegador); só a **ideia** foi aproveitada — a mesma que o Microsoft Word faz
há décadas. Onde a técnica aparece, o código do mdOffice diz isso.

### Licença MIT (a escolhida)

```
MIT License

Copyright (c) 2026 ArtCraft Team and the WordCraft contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

O texto da Apache-2.0 (a outra opção) está no repositório do WordCraft:
<https://github.com/storytold/wordcraft/blob/main/LICENSE-APACHE>.

**Nada** do WordCraft além da técnica foi copiado: nem o código, nem os nomes
das structs, nem os ícones, nem as fontes, nem a marca (as marcas ArtCraft não
são open source e não são usadas aqui).
