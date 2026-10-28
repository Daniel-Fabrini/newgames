# DA Games 👑

Coleção de jogos para celular num só app, em **português (BR)**, **inglês** e **espanhol**.
Funciona no navegador e pode ser instalado na tela inicial (PWA): abre em tela cheia e roda até sem internet.

| Jogo | Inspirado em |
|---|---|
| ⚽ **Futebol de Botão** — peteleco nos botões, contra o computador, 2 jogadores ou torneio | Soccer Stars |
| 🪖 **Esquadrão Sobrevivente** — multiplique a tropa nos portões e enfrente hordas de zumbis; base e heróis | Last War: Survival |
| 🗺️ **Onde Fica?** — encontre países no mapa-múndi (países, capitais, bandeiras, eliminação) | World Map Quiz |
| 🏁 **Bandeiras do Mundo** — quiz de bandeiras e capitais, soletrar, combinar, contra o relógio | Flags of All World Countries |
| 🦜 **Poliglota** — aprenda inglês, espanhol, português, francês, italiano e alemão | Duolingo |
| 🚌 **Todos a Bordo** — tire os carros do estacionamento e embarque os passageiros da cor certa | Bus Escape: Traffic Jam |
| 🔍 **Caça-Objetos** — ache os objetos escondidos em cenários lotados | Find It / Find It Out |
| 🔤 **Caça-Palavras** — ache as palavras escondidas, temas variados e níveis infinitos | Word Search Explorer |

Os jogos são recriações originais das mecânicas; não usam nomes, artes ou textos dos jogos originais.

## Jogar no celular

1. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, escolha o branch com o código e a pasta `/ (root)`, e salve.
2. Depois de 1–2 minutos o app fica em `https://daniel-fabrini.github.io/newgames/`.
3. Abra esse endereço no Chrome do celular e toque em **⋮ → Adicionar à tela inicial** (ou no botão *Instalar* que aparece no app).

## Rodar localmente

Não há etapa de build — são arquivos estáticos com módulos ES:

```sh
python3 -m http.server 8080
# abra http://localhost:8080
```

## Estrutura

```
index.html, manifest.webmanifest, sw.js   app shell + PWA (offline)
css/app.css                               estilos compartilhados
js/main.js                                hub, rotas (#/play/<id>), configurações
js/games.js                               lista de jogos do hub
js/core/                                  idioma (i18n), armazenamento, sons, UI
js/data/countries.js                      países: nomes e capitais em pt/en/es (gerado)
assets/flags/                             bandeiras SVG (flag-icons, MIT)
games/<id>/                               cada jogo (main.js + strings.js + …)
tools/                                    scripts que geram os dados (não são necessários para jogar)
docs/GAME_API.md                          como escrever um jogo novo
```

## Créditos

Bandeiras: [flag-icons](https://github.com/lipis/flag-icons) (MIT). Mapa: [Natural Earth](https://www.naturalearthdata.com/) via world-atlas (domínio público / ISC).
Dados de países: [world-countries](https://github.com/mledoze/countries) (ODbL), Wikidata (CC0), Unicode CLDR. Fonte: Nunito (OFL).
