# Financeiras

Especificação para recriar cada função. Formato: **NOME_PT (NOME_EN)** · `sintaxe` · regra · exemplo → resultado.
Marca: ✅ já no mdOffice · ⚠️ diverge · ❌ falta. Veja o [índice](README.md).

**Nenhuma função desta categoria existe no mdOffice ainda.** Valores numéricos dos exemplos foram calculados com as fórmulas abaixo (use-os como teste de aceitação).

## Convenções do Excel (importante para recriar)

- **Sinal do dinheiro:** quem **paga** é negativo, quem **recebe** é positivo. `PGTO` de um empréstimo (vp positivo) devolve valor **negativo**.
- Argumentos comuns: `taxa` (por período), `nper` (nº de períodos), `pgto` (prestação), `vp` (valor presente), `vf` (valor futuro, padrão 0), `tipo` (0 = pagamento no fim do período, padrão; 1 = no início).
- Equação base (taxa ≠ 0): `vp·(1+taxa)^nper + pgto·(1+taxa·tipo)·((1+taxa)^nper − 1)/taxa + vf = 0`. Com taxa = 0: `vp + pgto·nper + vf = 0`.
- **Iterativas** (`TAXA`, `TIR`, `XTIR`, `LUCRO`…): Newton-Raphson com até **20 iterações** e tolerância `0,0000001`; sem convergir → `#NÚM!`. `TAXA` e `TIR` partem de palpite 10% (`0,1`) quando omitido.
- Datas são números de série (ver [data-hora](data-hora.md)); a `base` de contagem de dias é 0 (30/360 EUA, padrão), 1 (real/real), 2 (real/360), 3 (real/365) ou 4 (30/360 europeu).

---

## Empréstimos e investimentos (anuidades)

**PGTO (PMT)** ❌ · `=PGTO(taxa; nper; vp; [vf]; [tipo])` · prestação constante.
`=PGTO(1%; 12; 10000)` → `-888,487886783417`.

**VF (FV)** ❌ · `=VF(taxa; nper; pgto; [vp]; [tipo])` · valor futuro.
`=VF(1%; 12; -100)` → `1268,25030131970` (12 depósitos de 100 a 1% ao mês).

**VP (PV)** ❌ · `=VP(taxa; nper; pgto; [vf]; [tipo])` · valor presente.
`=VP(1%; 12; -100)` → `1125,50774734846`.

**NPER (NPER)** ❌ · `=NPER(taxa; pgto; vp; [vf]; [tipo])` · número de períodos.
`=NPER(1%; -100; 1000)` → `10,5886444594232`.

**TAXA (RATE)** ❌ · `=TAXA(nper; pgto; vp; [vf]; [tipo]; [palpite])` · taxa por período (iterativa).
`=TAXA(12; -888,487886783417; 10000)` → `0,01`.

**IPGTO (IPMT)** ❌ · `=IPGTO(taxa; período; nper; vp; [vf]; [tipo])` · juros de um período.
`=IPGTO(1%; 1; 12; 10000)` → `-100`.

**PPGTO (PPMT)** ❌ · `=PPGTO(taxa; período; nper; vp; [vf]; [tipo])` · parte do principal; `PGTO = IPGTO + PPGTO`.
`=PPGTO(1%; 1; 12; 10000)` → `-788,487886783417`.

**PGTOJURACUM (CUMIPMT)** ❌ · `=PGTOJURACUM(taxa; nper; vp; início; fim; tipo)` · juros acumulados entre dois períodos (tipo é obrigatório). `=PGTOJURACUM(1%; 12; 10000; 1; 12; 0)` → soma dos 12 `IPGTO` (negativa).
**PGTOCAPACUM (CUMPRINC)** ❌ · principal acumulado; `=PGTOCAPACUM(1%; 12; 10000; 1; 12; 0)` → `-10000`.

**ÉPGTO (ISPMT)** ❌ · `=ÉPGTO(taxa; período; nper; vp)` · juros em empréstimo com principal amortizado em parcelas iguais (período começa em 0). `=ÉPGTO(1%; 0; 12; 10000)` → `-100`.

**PDURAÇÃO (PDURATION)** ❌ · `=PDURAÇÃO(taxa; vp; vf)` · `=PDURAÇÃO(10%; 100; 200)` → `7,27254089734171`.
**TAXAJURO (RRI)** ❌ · `=TAXAJURO(nper; vp; vf)` · taxa equivalente de crescimento. `=TAXAJURO(10; 100; 200)` → `0,0717734625362931`.

**VFPLANO (FVSCHEDULE)** ❌ · `=VFPLANO(principal; taxas)` · capital com taxas variáveis por período. `=VFPLANO(1000; A1:A2)` com A1=0,1 e A2=0,2 → `1320`.

**EFETIVA (EFFECT)** ❌ · `=EFETIVA(taxa_nominal; núm_por_ano)` · `=EFETIVA(12%; 12)` → `0,126825030131970`.
**NOMINAL (NOMINAL)** ❌ · `=NOMINAL(taxa_efetiva; núm_por_ano)` · `=NOMINAL(0,126825030131970; 12)` → `0,12`.

---

## Fluxo de caixa (VPL e TIR)

**VPL (NPV)** ❌ · `=VPL(taxa; valor1; [valor2]...)` · desconta os valores a partir do **período 1** (o investimento inicial, no período 0, soma-se por fora).
`=VPL(10%; 300; 400; 500)` → `978,963185574756` · `=-1000+VPL(10%; 300; 400; 500)` → `-21,0368144252441`.

**TIR (IRR)** ❌ · `=TIR(valores; [palpite])` · taxa que zera o VPL; exige ao menos um valor positivo e um negativo (senão `#NÚM!`).
`=TIR(A1:A5)` com −1000, 300, 400, 500, 200 → `0,153221378769` (≈15,32%).

**XVPL (XNPV)** ❌ · `=XVPL(taxa; valores; datas)` · cada fluxo descontado por `(data − data1)/365`. A 1ª data é a base (não precisa vir ordenada, mas nenhuma pode ser anterior a ela).
**XTIR (XIRR)** ❌ · `=XTIR(valores; datas; [palpite])` · TIR com datas.
**TIRM (MIRR)** ❌ · `=TIRM(valores; taxa_financ; taxa_reinvest)` · TIR modificada.

---

## Depreciação

Exemplo comum: custo 10.000, valor residual 1.000, vida útil 5 anos.

**DPD (SLN)** ❌ · `=DPD(custo; residual; vida)` · linear. `=DPD(10000; 1000; 5)` → `1800`.
**SDA (SYD)** ❌ · `=SDA(custo; residual; vida; período)` · soma dos dígitos dos anos. `=SDA(10000; 1000; 5; 1)` → `3000` · período 2 → `2400`.
**BD (DB)** ❌ · `=BD(custo; residual; vida; período; [meses_1º_ano])` · saldo decrescente com taxa fixa `1 − (residual/custo)^(1/vida)` **arredondada a 3 casas**. `=BD(10000; 1000; 5; 1)` → `3690` · período 2 → `2328,39`.
**BDD (DDB)** ❌ · `=BDD(custo; residual; vida; período; [fator])` · saldo decrescente duplo (fator 2); nunca desce abaixo do residual. `=BDD(10000; 1000; 5; 1)` → `4000` · período 2 → `2400`.
**BDV (VDB)** ❌ · `=BDV(custo; residual; vida; início; fim; [fator]; [sem_mudança])` · depreciação variável com troca para linear.
**AMORDEGRC (AMORDEGRC)** / **AMORLINC (AMORLINC)** ❌ · amortização francesa (contabilidade da França), com data de compra e fim do 1º período.

---

## Títulos e valores mobiliários

Todas usam `liquidação` (data de compra), `vencimento`, e `base`. `liquidação` ≥ `vencimento` → `#NÚM!`.

**PREÇO (PRICE)** ❌ · `=PREÇO(liq; venc; taxa; lucro; resgate; freq; [base])` · preço por 100 de valor nominal, com cupons periódicos.
**LUCRO (YIELD)** ❌ · rendimento (iterativa). **PREÇODESC (PRICEDISC)** ❌ · **PREÇOVENC (PRICEMAT)** ❌ · **LUCRODESC (YIELDDISC)** ❌ · **LUCROVENC (YIELDMAT)** ❌.
**DURAÇÃO (DURATION)** ❌ · duração de Macauley. **MDURAÇÃO (MDURATION)** ❌ · modificada.
**JUROSACUM (ACCRINT)** ❌ · juros acumulados de título com pagamentos periódicos. **JUROSACUMV (ACCRINTM)** ❌ · no vencimento.
**RECEBER (RECEIVED)** ❌ · valor recebido no vencimento de título totalmente investido.
**DESC (DISC)** ❌ · taxa de desconto. **TAXAJUROS (INTRATE)** ❌ · taxa de juros de título totalmente investido.
**Cupons:** **CUPDATAANT (COUPPCD)** ❌ data de cupom anterior · **CUPDATAPRÓX (COUPNCD)** ❌ próxima · **CUPNUM (COUPNUM)** ❌ nº de cupons · **CUPDIAS (COUPDAYS)** ❌ · **CUPDIASINLIQ (COUPDAYBS)** ❌ · **CUPDIASPRÓX (COUPDAYSNC)** ❌.
**Tesouro dos EUA:** **OTN (TBILLEQ)** ❌ equivalente a título · **OTNVALOR (TBILLPRICE)** ❌ · **OTNLUCRO (TBILLYIELD)** ❌.
**MOEDADEC (DOLLARDE)** ❌ · `=MOEDADEC(1,02; 16)` → `1,125` (1 + 2/16). **MOEDAFRA (DOLLARFR)** ❌ · `=MOEDAFRA(1,125; 16)` → `1,02`.
**PREÇOPRIMINC / LUCROPRIMINC / PREÇOÚLTINC / LUCROÚLTINC (ODDFPRICE / ODDFYIELD / ODDLPRICE / ODDLYIELD)** ❌ · títulos com primeiro/último período irregular.

---

## Resumo de status

0 implementadas. Ordem sugerida: `VP`, `VF`, `PGTO`, `NPER`, `TAXA`, `IPGTO`, `PPGTO`, `VPL`, `TIR`, `EFETIVA`, `NOMINAL`, `DPD`, `SDA`, `BDD`, depois `XVPL/XTIR` (precisam de [datas](data-hora.md)) e por último os títulos.
