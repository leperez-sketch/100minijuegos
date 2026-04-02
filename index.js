const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));
app.get('/', (req, res) => { res.sendFile(__dirname + '/host.html'); });
app.get('/mando', (req, res) => { res.sendFile(__dirname + '/mando.html'); });

let jugadores = {};
let moneda = { x: 0, y: 0 };
let juegoTerminado = false;
let juegoIniciado = false;

const anchoArena = 950;
const altoArena = 700;
const tamanoJugador = 60;
const tamanoMoneda = 30;
const radioHitboxMoneda = 8;
const radioHitboxJugador = 25;

// ---- LOBBY constants ----
const LOBBY_W      = 1000;   // virtual lobby width (mapped to 100% screen)
const LOBBY_FLOOR  = 460;    // virtual Y of floor
const LOBBY_GRAV   = 0.7;
const LOBBY_JUMP   = -15;
const LOBBY_VX     = 7;

let lobbyPositions = {}; // {[socketId]: {x,y,vx,vy,flip,nombre,color,saltando}}

const TODOS_PERSONAJES = ['rojo','azul','verde','amarillo','morado','naranja','ninja','astronauta','caballero','hada','mecanico','samurai'];

function colorAleatorio() {
  return TODOS_PERSONAJES[Math.floor(Math.random() * TODOS_PERSONAJES.length)];
}

function ajustarLimites(entidad) {
  if (entidad.x < 0) entidad.x = 0;
  if (entidad.x > anchoArena - tamanoJugador) entidad.x = anchoArena - tamanoJugador;
  if (entidad.y < 0) entidad.y = 0;
  if (entidad.y > altoArena - tamanoJugador) entidad.y = altoArena - tamanoJugador;
}

function centrarMoneda() {
  moneda.x = (anchoArena / 2) - (tamanoMoneda / 2);
  moneda.y = (altoArena / 2) - (tamanoMoneda / 2);
}

function generarMoneda() {
  moneda.x = Math.floor(Math.random() * (anchoArena - tamanoMoneda));
  moneda.y = Math.floor(Math.random() * (altoArena - tamanoMoneda));
}

centrarMoneda();

const esquinas = [
  { x: 20, y: 20 },
  { x: anchoArena - tamanoJugador - 20, y: 20 },
  { x: 20, y: altoArena - tamanoJugador - 20 },
  { x: anchoArena - tamanoJugador - 20, y: altoArena - tamanoJugador - 20 },
  { x: anchoArena / 2 - tamanoJugador / 2, y: 20 },
  { x: anchoArena / 2 - tamanoJugador / 2, y: altoArena - tamanoJugador - 20 },
];

function verificarColisiones() {
  const ids = Object.keys(jugadores);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = jugadores[ids[i]];
      const b = jugadores[ids[j]];
      const cx_a = a.x + tamanoJugador / 2;
      const cy_a = a.y + tamanoJugador / 2;
      const cx_b = b.x + tamanoJugador / 2;
      const cy_b = b.y + tamanoJugador / 2;
      const dist = Math.hypot(cx_a - cx_b, cy_a - cy_b);
      if (dist < radioHitboxJugador * 2 && dist > 0) {
        const nx = (cx_a - cx_b) / dist;
        const ny = (cy_a - cy_b) / dist;
        const fuerza = 6;
        a.velX += nx * fuerza;
        a.velY += ny * fuerza;
        b.velX -= nx * fuerza;
        b.velY -= ny * fuerza;
        a.golpeado = true;
        b.golpeado = true;
        setTimeout(() => { if (jugadores[ids[i]]) jugadores[ids[i]].golpeado = false; }, 400);
        setTimeout(() => { if (jugadores[ids[j]]) jugadores[ids[j]].golpeado = false; }, 400);
      }
    }
  }
}

// ---- LOBBY physics loop (33ms ~30fps) ----
setInterval(() => {
  if (juegoIniciado) return;
  if (Object.keys(lobbyPositions).length === 0) return;

  for (const id in lobbyPositions) {
    const l = lobbyPositions[id];

    l.vy += LOBBY_GRAV;
    l.x  += l.vx;
    l.y  += l.vy;

    if (l.y >= LOBBY_FLOOR) {
      l.y       = LOBBY_FLOOR;
      l.vy      = 0;
      l.saltando = false;
    } else {
      l.saltando = true;
    }

    if (l.x < 0)                  { l.x = 0;               l.vx = 0; }
    if (l.x > LOBBY_W - 90)       { l.x = LOBBY_W - 90;    l.vx = 0; }

    if (!l.saltando) {
      l.vx *= 0.72;
      if (Math.abs(l.vx) < 0.3) l.vx = 0;
    }

    l.jumpHeight = Math.max(0, LOBBY_FLOOR - l.y);
  }

  // ---- Lobby collisions ----
  const lobbyIds = Object.keys(lobbyPositions);
  for (let i = 0; i < lobbyIds.length; i++) {
    for (let j = i + 1; j < lobbyIds.length; j++) {
      const a = lobbyPositions[lobbyIds[i]];
      const b = lobbyPositions[lobbyIds[j]];
      const dx = a.x - b.x;
      const dy = (a.y - a.jumpHeight) - (b.y - b.jumpHeight);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = 70;
      if (dist < minDist && dist > 0.1) {
        const nx = dx / dist;
        const ny = dy / dist;
        const impulse = (minDist - dist) * 0.5;
        a.vx += nx * impulse * 0.4;
        b.vx -= nx * impulse * 0.4;
        if (!a.saltando && ny < -0.5) { a.vy = LOBBY_JUMP * 0.6; a.saltando = true; }
        if (!b.saltando && ny >  0.5) { b.vy = LOBBY_JUMP * 0.6; b.saltando = true; }
      }
    }
  }

  io.emit('estado_lobby', lobbyPositions);
}, 33);

// ---- GAME physics loop (40ms) ----
setInterval(() => {
  if (juegoTerminado || !juegoIniciado) return;

  for (const id in jugadores) {
    const j = jugadores[id];

    j.x += j.velX;
    j.y += j.velY;
    j.velX *= 0.72;
    j.velY *= 0.72;
    if (Math.abs(j.velX) < 0.05) j.velX = 0;
    if (Math.abs(j.velY) < 0.05) j.velY = 0;

    ajustarLimites(j);

    const cx_j = j.x + tamanoJugador / 2;
    const cy_j = j.y + tamanoJugador / 2;
    const cx_m = moneda.x + tamanoMoneda / 2;
    const cy_m = moneda.y + tamanoMoneda / 2;
    const distMoneda = Math.hypot(cx_j - cx_m, cy_j - cy_m);

    if (distMoneda < radioHitboxMoneda + radioHitboxJugador) {
      j.puntaje++;
      io.emit('sonido', 'moneda');
      if (j.puntaje >= 3) {
        juegoTerminado = true;
        io.emit('game_over', j.nombre);
        return;
      }
      generarMoneda();
    }
  }

  verificarColisiones();
  io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
}, 40);

function respawnLobby() {
  lobbyPositions = {};
  let i = 0;
  for (const id in jugadores) {
    const j = jugadores[id];
    lobbyPositions[id] = {
      nombre: j.nombre,
      color:  j.color,
      x: 80 + (i * 160) % (LOBBY_W - 200),
      y: LOBBY_FLOOR,
      vx: 0, vy: 0, flip: 1, saltando: false, jumpHeight: 0
    };
    i++;
  }
}

io.on('connection', (socket) => {

  socket.on('unirse_al_juego', ({ nombre: nombreUsuario, personaje }) => {
    const color = personaje || colorAleatorio();

    const numActuales = Object.keys(jugadores).length;
    const pos = esquinas[numActuales % esquinas.length];

    jugadores[socket.id] = {
      nombre: nombreUsuario,
      puntaje: 0,
      puntajeTotal: 0,
      x: pos.x,
      y: pos.y,
      color,
      listo: false,
      patinando: false,
      golpeado: false,
      ticksMovimiento: 0,
      ultimoDx: 0,
      ultimoDy: 0,
      velX: 0,
      velY: 0
    };

    const numLobby = Object.keys(lobbyPositions).length;
    lobbyPositions[socket.id] = {
      nombre: nombreUsuario,
      color,
      x: 80 + (numLobby * 160) % (LOBBY_W - 200),
      y: LOBBY_FLOOR,
      vx: 0,
      vy: 0,
      flip: 1,
      saltando: false,
      jumpHeight: 0
    };

    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
    io.emit('estado_lobby', lobbyPositions);
  });

  socket.on('mover_lobby', ({ dx, dy }) => {
    const l = lobbyPositions[socket.id];
    if (!l || juegoIniciado) return;

    if (Math.abs(dx) > 0.15) {
      l.vx  = dx * LOBBY_VX;
      l.flip = dx > 0 ? 1 : -1;
    } else {
      l.vx *= 0.55;
    }

    // Joystick pushed upward = jump
    if (dy < -0.4 && !l.saltando) {
      l.vy       = LOBBY_JUMP;
      l.saltando = true;
    }
  });

  socket.on('iniciar_juego', () => {
    juegoIniciado = true;
    io.emit('juego_iniciado');
  });

  socket.on('mover_joystick', ({ dx, dy }) => {
    if (juegoTerminado || !jugadores[socket.id] || !juegoIniciado) return;
    const j = jugadores[socket.id];
    if (j.golpeado) return;

    const magnitud = Math.sqrt(dx * dx + dy * dy);
    if (magnitud < 0.1) {
      j.ticksMovimiento = 0;
      j.patinando = false;
      return;
    }

    const dot = dx * j.ultimoDx + dy * j.ultimoDy;
    if (dot > 0.7) {
      j.ticksMovimiento++;
    } else {
      j.ticksMovimiento = 1;
    }
    j.ultimoDx = dx;
    j.ultimoDy = dy;

    const velocidad = j.ticksMovimiento >= 3 ? 7 * 2.2 : 7;
    j.patinando = j.ticksMovimiento >= 3;
    j.velX = dx * velocidad;
    j.velY = dy * velocidad;
  });

  socket.on('toggle_listo', () => {
    if (!jugadores[socket.id]) return;
    jugadores[socket.id].listo = !jugadores[socket.id].listo;
    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
  });

  socket.on('reiniciar_juego', () => {
    if (!juegoTerminado) return;
    juegoTerminado = false;
    centrarMoneda();

    let i = 0;
    for (const id in jugadores) {
      const pos = esquinas[i % esquinas.length];
      jugadores[id].puntajeTotal += jugadores[id].puntaje;
      jugadores[id].puntaje = 0;
      jugadores[id].x = pos.x;
      jugadores[id].y = pos.y;
      jugadores[id].listo = false;
      jugadores[id].patinando = false;
      jugadores[id].golpeado = false;
      jugadores[id].ticksMovimiento = 0;
      jugadores[id].ultimoDx = 0;
      jugadores[id].ultimoDy = 0;
      jugadores[id].velX = 0;
      jugadores[id].velY = 0;
      i++;
    }

    io.emit('juego_reiniciado');
    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
  });

  socket.on('terminar_juego', () => {
    juegoTerminado = false;
    juegoIniciado = false;
    centrarMoneda();

    let i = 0;
    for (const id in jugadores) {
      const pos = esquinas[i % esquinas.length];
      jugadores[id].puntaje = 0;
      jugadores[id].puntajeTotal = 0;
      jugadores[id].x = pos.x;
      jugadores[id].y = pos.y;
      jugadores[id].listo = false;
      jugadores[id].patinando = false;
      jugadores[id].golpeado = false;
      jugadores[id].ticksMovimiento = 0;
      jugadores[id].ultimoDx = 0;
      jugadores[id].ultimoDy = 0;
      jugadores[id].velX = 0;
      jugadores[id].velY = 0;
      i++;
    }

    respawnLobby();
    io.emit('juego_terminado');
    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
    io.emit('estado_lobby', lobbyPositions);
  });

  socket.on('volver_lobby', () => {
    if (!juegoIniciado) return;
    juegoTerminado = false;
    juegoIniciado = false;
    centrarMoneda();

    for (const id in jugadores) {
      jugadores[id].listo = false;
      jugadores[id].patinando = false;
      jugadores[id].golpeado = false;
      jugadores[id].ticksMovimiento = 0;
      jugadores[id].ultimoDx = 0;
      jugadores[id].ultimoDy = 0;
      jugadores[id].velX = 0;
      jugadores[id].velY = 0;
    }

    respawnLobby();
    io.emit('volver_lobby');
    io.emit('estado_lobby', lobbyPositions);
    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
  });

  socket.on('disconnect', () => {
    if (jugadores[socket.id])       delete jugadores[socket.id];
    if (lobbyPositions[socket.id])  delete lobbyPositions[socket.id];
    io.emit('estado_juego', { jugadores, moneda, juegoTerminado });
    io.emit('estado_lobby', lobbyPositions);
  });
});

const PORT = process.env.PORT || 5000;
http.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor escuchando en puerto ' + PORT);
});
