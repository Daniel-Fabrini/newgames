/** "2 linhas", "1 quadrado"… for the groups cleared by one placement. */
function clearParts(lines: number, squares: number): string[] {
  const parts: string[] = [];
  if (lines > 0) parts.push(lines === 1 ? '1 linha' : `${lines} linhas`);
  if (squares > 0) parts.push(squares === 1 ? '1 quadrado' : `${squares} quadrados`);
  return parts;
}

export const blockPuzzle = {
  help: {
    intro:
      'Encaixe as peças no tabuleiro de 9 × 9. Complete linhas, colunas ou quadrados 3 × 3 para limpá-los e ganhar pontos. O jogo termina quando nenhuma das suas peças cabe no tabuleiro.',
    sections: [
      {
        title: 'Regras',
        items: [
          'Você recebe 3 peças de cada vez. Só chegam peças novas depois que você colocar as três, na ordem que quiser.',
          'As peças não giram: cada orientação é uma peça diferente.',
          'Uma peça só pode ser colocada inteira dentro do tabuleiro e sobre casas vazias.',
          'Quando uma linha, uma coluna ou um dos nove quadrados 3 × 3 destacados fica completo, ele é limpo. Tudo o que ficar completo é limpo ao mesmo tempo; uma casa que pertença a vários grupos conta só uma vez.',
          'Os quadrados 3 × 3 são os blocos sombreados do tabuleiro (3 por 3 casas, sem sobreposição).',
          'As peças que não cabem em lugar nenhum aparecem esmaecidas.',
          'Sempre que alguma peça cabe no tabuleiro, pelo menos uma das três peças novas cabe — mas nunca há garantia de que todas caibam, então planeje com cuidado.',
          'O jogo termina quando nenhuma das peças que sobraram cabe no tabuleiro.',
        ],
      },
      {
        title: 'Controles',
        items: [
          'Arrastar: arraste uma peça da bandeja para o tabuleiro. A sombra mostra onde ela vai ficar, e as linhas, colunas e quadrados que serão limpos ficam iluminados. Se você soltar em um lugar inválido, ela volta para a bandeja.',
          'Na tela sensível ao toque, a peça arrastada fica um pouco acima do dedo para você conseguir vê-la.',
          'Tocar: toque em uma peça para selecioná-la e depois toque em uma casa do tabuleiro. A casa tocada fica no centro da peça (nas peças com largura ou altura par, é a casa logo à esquerda ou acima do centro) e, perto das bordas, a peça é deslocada para dentro do tabuleiro. Com o mouse, você vê a prévia antes de clicar.',
          'Teclado: 1, 2 e 3 selecionam a peça, as setas a movem no tabuleiro, Enter ou Espaço a colocam e Esc cancela a seleção. P pausa o jogo.',
        ],
      },
      {
        title: 'Pontuação',
        items: [
          '1 ponto por bloco colocado.',
          'Limpar L grupos de uma só vez (cada linha, coluna ou quadrado 3 × 3 conta como um grupo) vale 10 × L × L pontos: 1 → 10, 2 → 40, 3 → 90, 4 → 160.',
          'Combo: cada colocação seguida que limpa pelo menos um grupo aumenta o combo (×1, ×2, ×3…), e os pontos da limpeza são multiplicados pelo combo. Uma colocação que não limpa nada zera o combo.',
          'Exemplo: uma peça de 4 blocos que completa uma linha e um quadrado (2 grupos) com combo ×3 vale 4 + 40 × 3 = 124 pontos.',
        ],
      },
    ],
  },
  lines: 'Limpezas',
  combo: (n: number) => `Combo ×${n}`,
  comboLabel: (n: number) => `Combo atual: ${n}`,
  clearsPopup: (lines: number, squares: number) => `${clearParts(lines, squares).join(' + ')}!`,
  boardLabel: 'Tabuleiro de 9 por 9',
  cellLabel: (row: number, col: number, state: string) => `Linha ${row}, coluna ${col}: ${state}`,
  cellEmpty: 'vazia',
  cellFilled: 'ocupada',
  trayLabel: 'Peças disponíveis',
  slotLabel: (slot: number, name: string, blocks: number) => `Peça ${slot}: ${name}, ${blocks === 1 ? '1 bloco' : `${blocks} blocos`}`,
  slotEmpty: (slot: number) => `Espaço ${slot}: peça já colocada`,
  slotNoFit: 'não cabe no tabuleiro',
  shapes: {
    mono: 'bloco simples',
    line2: 'linha de 2',
    line3: 'linha de 3',
    line4: 'linha de 4',
    line5: 'linha de 5',
    square2: 'quadrado 2 × 2',
    square3: 'quadrado 3 × 3',
    corner3: 'canto pequeno',
    l4: 'peça em L',
    j4: 'peça em J',
    t4: 'peça em T',
    s4: 'peça em S',
    z4: 'peça em Z',
    corner5: 'canto grande',
  },
  orientation: {
    horizontal: 'horizontal',
    vertical: 'vertical',
  },
  hintIdle: 'Arraste uma peça para o tabuleiro ou toque nela para selecioná-la.',
  hintSelected: 'Toque em uma casa do tabuleiro para colocar a peça.',
  hintNoFit: 'Esta peça não cabe em lugar nenhum. Escolha outra.',
  announce: {
    selected: (name: string) => `Você selecionou: ${name}. Use as setas e Enter, ou toque no tabuleiro.`,
    selectedNoFit: (name: string) => `Você selecionou: ${name}. Esta peça não cabe em lugar nenhum.`,
    cancelled: 'Seleção cancelada.',
    position: (row: number, col: number, valid: boolean) => `Linha ${row}, coluna ${col}${valid ? '' : ': não cabe aqui'}`,
    placed: (gained: number, score: number) => `Peça colocada. +${gained} pontos, total ${score}.`,
    cleared: (lines: number, squares: number, combo: number) => `Você limpou ${clearParts(lines, squares).join(' e ')}${combo >= 2 ? `, combo ×${combo}` : ''}.`,
    newPieces: 'Novas peças na bandeja.',
    invalid: 'Não é possível colocar a peça aí.',
    emptySlot: 'Esse espaço já está vazio.',
  },
  overBody: 'Nenhuma das peças que sobraram cabe no tabuleiro.',
  bestCombo: 'Melhor combo',
  piecesPlaced: 'Peças colocadas',
  totalPiecesPlaced: 'Peças colocadas (total)',
};

export type BlockPuzzleMessages = typeof blockPuzzle;
