import type { WordDelimiter } from './storage'

export const WORD_PRACTICE_TEXTS = [
  'O cafe ainda estava quente quando Marina abriu a janela. A rua acordava devagar, com passos leves, portas rangendo e uma luz dourada passando entre os predios.',
  'Pedro guardou o bilhete dentro do livro azul. Ele sabia que algumas respostas precisam de tempo para amadurecer antes de serem lidas em voz alta.',
  'A biblioteca da escola ficava silenciosa depois do intervalo. Entre as mesas, a poeira brilhava no sol e cada pagina parecia esconder uma pequena promessa.',
  'Quando a chuva apertou, os vizinhos se reuniram na garagem. Alguem trouxe bolo, outro trouxe cafe, e a tarde virou conversa comprida.',
  'O primeiro treino da semana sempre parecia mais dificil. Depois de alguns minutos, porem, os dedos encontravam ritmo e a respiracao voltava ao lugar.',
  'Clara caminhou ate a ponte para ver o rio subir. A corrente levava folhas, historias pequenas e o reflexo torto das nuvens de fim de tarde.',
  'No escritorio vazio, Rafael organizou as ideias em tres colunas. Ao escrever cada tarefa, percebeu que o problema era menor do que parecia.',
  'A horta crescia no canto do quintal, cercada por tijolos antigos. Todos os dias, Ana regava as mudas e aprendia paciencia com as folhas novas.',
  'O trem chegou atrasado, mas ninguem reclamou muito. Na plataforma, um musico tocava baixo e transformava a espera em alguma coisa menos pesada.',
  'Helena consertou a luminaria antes do jantar. A luz voltou fraca no comeco, depois firme, como se a casa respirasse aliviada.',
  'O mapa estava marcado com caneta vermelha. Cada ponto indicava uma lembranca, uma parada improvisada ou uma historia que ainda merecia ser contada.',
  'Mateus aprendeu a cozinhar observando a avó. Ela nunca media nada, mas sabia o ponto certo pelo cheiro, pela cor e pelo silencio da panela.',
  'A cidade parecia outra no domingo cedo. Sem pressa, as fachadas mostravam detalhes esquecidos e os semaforos piscavam para ruas quase vazias.',
  'Lia colocou os fones e voltou ao desenho. As linhas erradas ficaram no papel, servindo de caminho para uma forma melhor aparecer.',
  'O cachorro do vizinho esperava sempre no mesmo portao. Quando alguem passava, ele abanava o rabo como quem cumprimenta velhos conhecidos.',
  'Na oficina, cada ferramenta tinha seu lugar. O mecanico dizia que ordem nao economiza apenas tempo, tambem economiza paciencia.',
  'A carta chegou sem remetente, dobrada com cuidado. Dentro havia apenas uma frase simples, mas ela mudou o rumo daquele dia inteiro.',
  'O professor apagou o quadro e esperou a turma ficar quieta. Depois explicou o assunto como quem abre uma porta e convida todos a entrar.',
  'A padaria da esquina vendia paes antes do sol nascer. O cheiro atravessava a rua e fazia a manha parecer menos fria.',
  'Joana decidiu correr sem olhar o relogio. Queria sentir o corpo encontrar seu proprio ritmo, longe das metas e dos numeros.',
  'O apartamento novo ainda tinha caixas na sala. Mesmo assim, quando a primeira planta foi colocada na janela, o lugar comecou a parecer casa.',
  'Na praia vazia, as pegadas duravam pouco. Cada onda apagava o caminho anterior e deixava espaco para outra tentativa.',
  'O computador travou pouco antes da entrega. Em vez de entrar em panico, Bruno respirou fundo e refez o trabalho em partes menores.',
  'A menina contou estrelas do banco da pracinha. Perdeu a conta varias vezes, mas ganhou uma noite inteira olhando para cima.',
  'O mercado fechava em quinze minutos. Mesmo assim, o atendente ajudou a senhora a encontrar tudo que faltava para o jantar.',
  'A banda ensaiava no fundo da garagem. Os primeiros acordes saiam tortos, mas havia alegria suficiente para manter todos tocando.',
  'O jardim publico tinha bancos descascados e sombras generosas. Ali, muita gente descansava sem precisar explicar nada a ninguem.',
  'Sofia escreveu uma lista de coisas pequenas. Beber agua, responder mensagens, arrumar a mesa; cumprir o simples tambem era uma vitoria.',
  'O farol antigo continuava aceso mesmo sem navios por perto. Para os moradores, aquela luz era menos aviso e mais companhia.',
  'O padeiro separou a primeira fornada do dia. Cada pao tinha uma casca diferente, como se o calor tambem tivesse opiniao.',
  'No ensaio da peca, todos esqueceram alguma fala. A diretora sorriu e disse que o palco tambem se constrói com erros honestos.',
  'A mala ficou pronta antes da meia-noite. Faltava apenas escolher o livro da viagem, decisao pequena que sempre parecia importante.',
  'O menino aprendeu xadrez com o porteiro. Perdia quase sempre, mas gostava de descobrir que uma jogada calma podia mudar tudo.',
  'A feira ocupava a avenida com cores e vozes. Entre frutas, sacolas e risadas, a cidade mostrava seu lado mais vivo.',
  'Miguel guardou moedas em um pote de vidro. Nao sabia ainda o destino da economia, mas gostava de ver o plano crescendo.',
  'O elevador parou entre dois andares por poucos minutos. Nesse intervalo, dois vizinhos que mal se cumprimentavam descobriram assuntos em comum.',
  'A aula de pintura comecou com uma folha branca. O instrutor disse que o vazio nao era falta de ideia, era apenas espaco disponivel.',
  'No fim da tarde, o ceu ficou laranja sobre os telhados. As pessoas diminuiram o passo sem combinar, obedecendo a uma beleza comum.',
  'A chave sumiu justamente no dia de pressa. Depois de procurar em todos os cantos, estava no bolso do casaco usado pela manha.',
  'O radio antigo pegava poucas estacoes. Ainda assim, nas noites de vento, uma musica distante bastava para encher a cozinha.',
  'A primeira pagina do caderno parecia solene. Depois da primeira frase, o medo diminuiu e a escrita encontrou caminho.',
  'O jogo terminou empatado, mas a turma saiu sorrindo. Para eles, correr juntos no campinho valia mais do que qualquer placar.',
  'A costureira alinhou o tecido com cuidado. Ela dizia que roupa bem feita comeca antes da agulha, no respeito pelo detalhe.',
  'O cheiro de terra molhada invadiu a casa. A chuva tinha sido rapida, mas suficiente para mudar a temperatura e o humor da tarde.',
  'A reuniao parecia confusa ate alguem desenhar o fluxo no papel. De repente, cada etapa ganhou lugar e o grupo voltou a respirar.',
  'O velho cinema reabriu com cadeiras novas e cartazes antigos. Na fila, pessoas de idades diferentes esperavam a mesma historia com curiosidade.',
  'Nina aprendeu a dizer nao sem pedir desculpas. Foi estranho no inicio, depois libertador, como abrir uma janela fechada havia anos.',
  'A estrada de terra seguia entre campos verdes. Nao havia placas por perto, mas o caminho parecia seguro por causa da luz do entardecer.',
  'O arquivo perdido apareceu em uma pasta esquecida. Lucas riu sozinho, aliviado por descobrir que o desastre era apenas desorganizacao.',
  'A conversa dificil aconteceu na mesa da cozinha. Ninguem saiu vencedor, mas todos sairam um pouco mais leves do que chegaram.',
]

export function buildWordPracticeText(wordLimit = 50, delimiter: WordDelimiter = 'space'): string {
  const target = Math.max(1, wordLimit)
  const start = Math.floor(Math.random() * WORD_PRACTICE_TEXTS.length)
  const paragraphs: string[] = []
  let words = 0

  for (let offset = 0; words < target + 18 && offset < WORD_PRACTICE_TEXTS.length; offset++) {
    const paragraph = WORD_PRACTICE_TEXTS[(start + offset) % WORD_PRACTICE_TEXTS.length]
    paragraphs.push(paragraph)
    words += paragraph.split(/\s+/).filter(Boolean).length
  }

  const text = paragraphs.join(' ')
  if (delimiter === 'pipe') {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean)
      .join(' | ')
  }
  return text
}
