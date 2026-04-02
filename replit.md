# Mario Party Arena — Atrapa Monedas

Real-time multiplayer browser game with a host screen and phone controllers.

## Architecture
- **Backend**: Node.js + Express + Socket.io (`index.js`), port 5000
- **Host screen** (`host.html`): 950×700px game arena + lobby
- **Controller** (`mando.html`): phone joystick + buttons
- **Assets**: `img/` directory

## Key Constants (index.js)
- Arena: `anchoArena=950, altoArena=700`
- Lobby physics: `LOBBY_W=1000, LOBBY_FLOOR=460, LOBBY_GRAV=0.7, LOBBY_JUMP=-15, LOBBY_VX=7`
- Lobby character collision: `minDist=70`

## Sprites
- **Hada**: `img/hada_sheet.png` (5×2 grid, 1427×736px); lobby 260×260px, game 120×120px
- **Mecanico**: `img/mecanico_sheet.png` (5×3 grid); `background-size: 500% 300%`
- **Caballero**: standard runner sprite

## UI Assets (`img/ui_assets2.png` — 1380×752px)
Pixel-art buttons and cartridges cropped from this spritesheet:

| File | Crop coordinates | Size |
|------|-----------------|------|
| `btn_vol_on.png` | x=51, y=38 | — |
| `btn_vol_off.png` | x=51, y=38 | — |
| `btn_prev.png` | x=55, y=233, w=155, h=150 | 155×150 |
| `btn_next.png` | x=278, y=233, w=150, h=150 | 150×150 |
| `btn_iniciar.png` | x=51, y=440, w=291, h=78 | 291×78 |
| `cartucho_verde.png` | x=545, y=40, w=390, h=440 | 390×440 (La Licuadora Gigante) |
| `cartucho_azul.png` | x=968, y=40, w=390, h=440 | 390×440 (Patinaje sobre Hielo) |

## Games Defined (host.html)
1. **Patinaje sobre Hielo** 🛼 → `img/cartucho_azul.png`
2. **La Licuadora Gigante** 🧃 → `img/cartucho_verde.png`

## Lobby Layout (3-column)
- Left: QR code + volume slider + player list
- Center: Neon "= LOBBY =" sign + game selector panel (cartridge display + prev/next arrows + INICIAR button)
- Right: spacer (min-width: 200px)
- Characters layer: `#lobby-personajes` at z-index 10

## Audio
- Lobby: `musica-lobby.mp3` → `audioLobby`
- Game: `musica.mp3` → `audioMusica`
- All `audio.play()` calls use `.catch(() => {})`

## Joystick (mando.html)
- `BASE_RADIUS=100, KNOB_RADIUS=45, MAX_DIST=55, DEAD_ZONE=15, SEND_INTERVAL_MS=50`
- touchmove/touchend listeners on `document` level

## Socket Events
- `union` — player joins with name + character
- `joystick` — joystick input `{x, y}`
- `boton` — button press `{btn}`
- `volver_lobby` — return to lobby after game
- `terminar_juego` — game over, triggers `respawnLobby()`
