var OpCode = {
  STATE: 0,
  MOVE: 1
};

function emptyBoard() {
  return ["", "", "", "", "", "", "", "", ""];
}

function checkWinner(board) {
  var lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (var i = 0; i < lines.length; i++) {
    var a = lines[i][0];
    var b = lines[i][1];
    var c = lines[i][2];

    if (board[a] !== "" && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  for (var j = 0; j < board.length; j++) {
    if (board[j] === "") {
      return "";
    }
  }

  return "draw";
}

function buildStatePayload(state) {
  return JSON.stringify({
    type: "state",
    board: state.board,
    turn: state.turn,
    winner: state.winner,
    players: state.players
  });
}

function broadcastState(dispatcher, state) {
  dispatcher.broadcastMessage(OpCode.STATE, buildStatePayload(state), null, null, true);
}

function matchInit(ctx, logger, nk, params) {
  logger.info("matchInit called");

  return {
    state: {
      board: emptyBoard(),
      turn: "X",
      winner: "",
      players: {},
      presences: []
    },
    tickRate: 1,
    label: "tictactoe"
  };
}

function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
  logger.info("matchJoinAttempt userId=" + presence.userId);

  if (state.presences.length >= 2) {
    return {
      state: state,
      accept: false,
      rejectMessage: "Match is full"
    };
  }

  return {
    state: state,
    accept: true
  };
}

function matchJoin(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    var exists = false;

    for (var j = 0; j < state.presences.length; j++) {
      if (state.presences[j].userId === presence.userId) {
        exists = true;
        break;
      }
    }

    if (!exists) {
      state.presences.push(presence);

      if (!state.players[presence.userId]) {
        if (Object.keys(state.players).length === 0) {
          state.players[presence.userId] = "X";
        } else {
          state.players[presence.userId] = "O";
        }
      }
    }
  }

  logger.info("matchJoin complete. players=" + Object.keys(state.players).length);
  broadcastState(dispatcher, state);

  return {
    state: state
  };
}

function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (var i = 0; i < presences.length; i++) {
    var leavingPresence = presences[i];
    var nextPresences = [];

    for (var j = 0; j < state.presences.length; j++) {
      if (state.presences[j].userId !== leavingPresence.userId) {
        nextPresences.push(state.presences[j]);
      }
    }

    state.presences = nextPresences;
    delete state.players[leavingPresence.userId];
  }

  logger.info("matchLeave complete. remaining=" + state.presences.length);
  broadcastState(dispatcher, state);

  if (state.presences.length === 0) {
    return null;
  }

  return {
    state: state
  };
}

function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) {
  for (var i = 0; i < messages.length; i++) {
    var message = messages[i];

    logger.info("matchLoop received opCode=" + message.opCode + " from=" + message.sender.userId);

    if (message.opCode !== OpCode.MOVE) {
      continue;
    }

    if (state.winner) {
      logger.info("Ignoring move because winner already exists");
      continue;
    }

    var userId = message.sender.userId;
    var playerSymbol = state.players[userId];

    if (!playerSymbol) {
      logger.info("Ignoring move because playerSymbol missing");
      continue;
    }

    if (playerSymbol !== state.turn) {
      logger.info("Ignoring move because not player's turn. symbol=" + playerSymbol + " turn=" + state.turn);
      continue;
    }

    var rawPayload = "";
    var data = null;

    try {
      rawPayload = nk.binaryToString(message.data);
      logger.info("Decoded move payload=" + rawPayload);
      data = JSON.parse(rawPayload);
    } catch (e) {
      logger.error("Failed decoding/parsing move payload: " + e);
      continue;
    }

    var index = data.index;

    if (typeof index !== "number" || index < 0 || index > 8) {
      logger.info("Ignoring move because invalid index=" + index);
      continue;
    }

    if (state.board[index] !== "") {
      logger.info("Ignoring move because cell occupied index=" + index);
      continue;
    }

    state.board[index] = playerSymbol;
    state.winner = checkWinner(state.board);

    if (!state.winner) {
      state.turn = state.turn === "X" ? "O" : "X";
    }

    logger.info("Move applied index=" + index + " symbol=" + playerSymbol + " nextTurn=" + state.turn + " winner=" + state.winner);

    broadcastState(dispatcher, state);
  }

  return {
    state: state
  };
}

function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) {
  return {
    state: state
  };
}

function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return {
    state: state
  };
}

function rpcCreateMatch(ctx, logger, nk, payload) {
  var matchId = nk.matchCreate("tictactoe", {});
  logger.info("Created matchId=" + matchId);
  return JSON.stringify({ matchId: matchId });
}

function InitModule(ctx, logger, nk, initializer) {
  initializer.registerMatch("tictactoe", {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchSignal: matchSignal,
    matchTerminate: matchTerminate
  });

  initializer.registerRpc("create_match", rpcCreateMatch);

  logger.info("GAME READY SUCCESS");
}
