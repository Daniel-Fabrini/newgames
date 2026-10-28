export const game2048 = {
  help: {
    intro: 'Deslize as peças para juntá-las. Quando duas peças com o mesmo número se encontram, elas se fundem em uma só com o dobro do valor. Chegue à peça 2048!',
    sections: [
      {
        title: 'Regras',
        items: [
          'Cada movimento desliza todas as peças o máximo possível na direção escolhida.',
          'Duas peças iguais se fundem em uma só; cada peça só pode se fundir uma vez por movimento.',
          'Depois de cada movimento que altera o tabuleiro, aparece uma peça nova (2 ou 4) em uma casa vazia.',
          'Se o movimento não mexer nenhuma peça, nenhuma peça nova aparece.',
          'Você vence quando cria a peça 2048 e pode continuar jogando para ir mais longe.',
          'O jogo termina quando o tabuleiro está cheio e não há nenhuma fusão possível.',
        ],
      },
      {
        title: 'Controles',
        items: [
          'Celular: deslize o dedo sobre o tabuleiro.',
          'Teclado: setas ou W, A, S, D. U desfaz, P ou Esc pausam.',
          'Você também pode usar os botões de direção abaixo do tabuleiro.',
        ],
      },
      {
        title: 'Pontuação',
        items: ['Cada fusão soma à pontuação o valor da nova peça (2 + 2 = 4 pontos).', 'Você pode desfazer até 10 movimentos seguidos.'],
      },
    ],
  },
  reachedTitle: 'Você chegou a 2048!',
  reachedBody: 'Fantástico! Você pode continuar jogando para tentar uma peça ainda maior.',
  overBody: 'Não há mais movimentos possíveis.',
  bestTile: 'Maior peça',
  boardLabel: 'Tabuleiro de 2048, 4 por 4',
  cellEmpty: 'vazio',
  cellLabel: (row: number, col: number, value: string) => `Linha ${row}, coluna ${col}: ${value}`,
  directionsLabel: 'Mover peças',
  directions: {
    up: 'Mover para cima',
    down: 'Mover para baixo',
    left: 'Mover para a esquerda',
    right: 'Mover para a direita',
  },
  movedAnnouncement: (score: number) => `Pontuação: ${score}`,
  undoLimit: (n: number) => `Você pode desfazer mais ${n}`,
};

export type Game2048Messages = typeof game2048;
