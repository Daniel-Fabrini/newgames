export const snake = {
  help: {
    intro: 'Guie a cobra, coma as maçãs para crescer e não bata em nada. Quanto mais você come, mais rápido ela anda!',
    rules: [
      'A cobra avança sozinha, uma casa de cada vez; você só escolhe para onde ela vira.',
      'Cada maçã faz a cobra crescer uma casa e soma pontos. Logo aparece outra em uma casa livre aleatória.',
      'Você pode entrar na casa onde está a ponta da cauda, porque a cauda sai dali no mesmo instante.',
      'Bater no próprio corpo sempre encerra a partida.',
      'Se a cobra ocupar o tabuleiro inteiro, você vence!',
    ],
    modesTitle: 'Modos',
    modes: [
      'Clássico: as bordas do tabuleiro são paredes (moldura contínua). Bater em uma parede ou no próprio corpo encerra a partida.',
      'Infinito: não há paredes (moldura tracejada) — você sai por um lado e entra pelo lado oposto. Só o seu corpo pode parar você.',
    ],
    speedTitle: 'Dificuldade e velocidade',
    speed: (difficulty: string, startMs: string, accelMs: string, minMs: string) =>
      `${difficulty}: começa com uma casa a cada ${startMs} ms e acelera ${accelMs} ms a cada maçã, até o limite de uma casa a cada ${minMs} ms.`,
    foodPoints: (easy: string, medium: string, hard: string) =>
      `Cada maçã vale ${easy} pontos no Fácil, ${medium} na Média e ${hard} no Difícil.`,
    bonus: (every: string, ticks: string, multiplier: string) =>
      `A cada ${every} maçãs aparece uma estrela dourada por ${ticks} movimentos. Ela vale ${multiplier} vezes os pontos de uma maçã e não faz a cobra crescer. O anel em volta da estrela mostra o tempo que falta.`,
    records: 'Os recordes são salvos separadamente para cada modo e dificuldade.',
    controls: [
      'Celular: deslize o dedo sobre o tabuleiro para onde quer virar. Você pode encadear curvas sem levantar o dedo.',
      'Botões de direção abaixo do tabuleiro (ao lado, em telas largas).',
      'Teclado: setas ou W, A, S, D. Espaço, P ou Esc pausam.',
      'A cobra guarda até 2 curvas e aplica uma por casa, então você pode fazer curvas rápidas. Inverter o sentido de uma vez (180°) é ignorado.',
    ],
    pauseTitle: 'Pausa e salvamento',
    pause: [
      'O jogo pausa sozinho quando você sai do app ou abre um menu.',
      'Ao continuar, há uma contagem regressiva de 3 segundos.',
      'Se você sair no meio, a partida fica salva e você pode continuá-la mais tarde.',
    ],
  },
  modes: {
    classic: 'Clássico',
    endless: 'Infinito',
  },
  modeHints: {
    classic: 'Paredes sólidas: bater em uma parede ou no próprio corpo encerra a partida.',
    endless: 'Sem paredes: atravesse as bordas e apareça do lado oposto. Só o seu corpo pode parar você.',
  },
  speedHint: (start: string, max: string, points: string) =>
    `Começa a ${start} casas por segundo e chega a ${max}. Cada maçã vale ${points} pontos.`,
  variant: (mode: string, difficulty: string) => `${mode} · ${difficulty}`,
  setup: {
    bestLabel: 'Recorde nesta combinação',
    noBest: 'Ainda sem recorde',
    savedTitle: 'Partida salva',
    savedBody: (variant: string, score: string, length: string) => `${variant} — ${score} pontos, comprimento ${length}`,
    discardTitle: 'Começar uma nova partida?',
    discardBody: 'A partida salva termina aqui e conta para as estatísticas com a pontuação que tem agora.',
  },
  length: 'Comprimento',
  survival: 'Sobrevivência',
  food: 'Maçãs',
  changeMode: 'Mudar modo',
  boardLabel: (mode: string, size: string) =>
    `Tabuleiro da cobra, modo ${mode}, ${size} por ${size} casas. Deslize sobre o tabuleiro ou use os botões de direção para virar.`,
  directionsLabel: 'Direção da cobra',
  directions: {
    up: 'Virar para cima',
    down: 'Virar para baixo',
    left: 'Virar para a esquerda',
    right: 'Virar para a direita',
  },
  keyboardHint: 'Setas ou W A S D para virar · Espaço, P ou Esc para pausar',
  causes: {
    wall: 'Você bateu na parede.',
    self: 'Você mordeu o próprio corpo.',
  },
  wonTitle: 'Tabuleiro cheio!',
  wonBody: 'A cobra ocupa todas as casas. Uma façanha lendária!',
  announce: {
    start: (variant: string) => `A partida vai começar: ${variant}. Prepare-se!`,
    progress: (score: string, length: string) => `${score} pontos, comprimento ${length}.`,
    bonusAppeared: 'Apareceu uma estrela bônus!',
    bonusEaten: (points: string) => `Estrela bônus: mais ${points} pontos!`,
    over: (cause: string, score: string) => `${cause} Fim de jogo com ${score} pontos.`,
    won: (score: string) => `Você encheu o tabuleiro! ${score} pontos.`,
  },
};

export type SnakeMessages = typeof snake;
