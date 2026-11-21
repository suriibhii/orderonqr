import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createInitialState } from './src/shared/seedData.ts';
import type {
  BranchId,
  ClientEvent,
  KitchenOrder,
  OrderItem,
  ReceiptRecord,
  RestaurantState,
  ServerEvent,
  TableSession,
} from './src/shared/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const state: RestaurantState = createInitialState();

const DRAW_PROMPTS = [
  'Prawn Tempura Roll',
  'Miso Ramen',
  'Chicken Gyoza',
  'Prawn Hargao',
  'Matcha Cooler',
  'Salmon Nigiri',
  'Matcha Mochi',
  'Chopsticks',
  'Sushi Boat',
  'Bento Box',
];

function makeMaskedHint(word: string): string {
  return word
    .split('')
    .map((ch, idx) => (ch === ' ' ? '   ' : idx === 0 ? ch : '_'))
    .join(' ');
}

function tableKey(branchId: BranchId, tableNumber: number): string {
  return `${branchId}:${tableNumber}`;
}

function getTable(branchId: BranchId, tableNumber: number): TableSession | undefined {
  return state.tables[tableKey(branchId, tableNumber)];
}

function awardPoints(table: TableSession, guestId: string, points: number) {
  const guest = table.guests.find((g) => g.id === guestId);
  if (guest) {
    guest.loyaltyPoints += points;
  }
}

function checkTicTacToeWinner(board: (string | null)[]): 'X' | 'O' | 'draw' | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as 'X' | 'O';
    }
  }
  if (board.every((cell) => cell !== null)) {
    return 'draw';
  }
  return null;
}

function calculateTableTotals(table: TableSession, tipAmount: number) {
  const activeOrders = state.orders.filter(
    (o) => o.branchId === table.branchId && o.tableNumber === table.tableNumber
  );
  const allItems: OrderItem[] = activeOrders.flatMap((o) => o.items);
  const subtotal = allItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  let discount = 0;
  if (table.appliedOfferId) {
    const offer = state.offers.find((o) => o.id === table.appliedOfferId && o.active);
    if (offer) {
      if (offer.discountType === 'flat') {
        discount = Math.min(subtotal, offer.value);
      } else if (offer.discountType === 'percent') {
        // Happy Hour 20% off beverages or subtotal
        const bevTotal = allItems
          .filter((item) => {
            const menu = state.menu.find((m) => m.id === item.menuItemId);
            return menu?.category === 'Beverages & Matcha';
          })
          .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const basis = bevTotal > 0 ? bevTotal : subtotal;
        discount = Math.round((basis * offer.value) / 100);
      }
    }
  }

  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = Math.round(discountedSubtotal * 0.05);
  const total = discountedSubtotal + tax + tipAmount;
  return { allItems, subtotal, discount, tax, total };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  function broadcast(event: ServerEvent) {
    const raw = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  function broadcastState(toastMessage?: string, branchId?: BranchId) {
    broadcast({ type: 'state:sync', payload: state });
    if (toastMessage) {
      broadcast({ type: 'toast:info', payload: { message: toastMessage, branchId } });
    }
  }

  function handleClientEvent(event: ClientEvent) {
    const now = Date.now();

    switch (event.type) {
      case 'state:request': {
        broadcast({ type: 'state:sync', payload: state });
        return;
      }

      case 'table:join': {
        const { branchId, tableNumber, sessionName, guestName, avatarColor } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const trimmedName = guestName.trim() || 'Guest';
        const existing = table.guests.find(
          (g) => g.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (!existing) {
          const initials = trimmedName
            .split(/\s+/)
            .map((w) => w[0]?.toUpperCase() || '')
            .join('')
            .slice(0, 2);
          table.guests.push({
            id: `g-${now}-${Math.random().toString(36).slice(2, 6)}`,
            name: trimmedName,
            avatarColor: avatarColor || '#D97706',
            initials: initials || 'GU',
            loyaltyPoints: 250,
            joinedAt: now,
          });
        }
        if (sessionName && sessionName.trim()) {
          table.sessionName = sessionName.trim();
        }
        if (table.status === 'available' || table.status === 'cleaning') {
          table.status = 'occupied';
        }
        broadcastState(`${trimmedName} joined Table ${tableNumber} (${table.sessionName})`, branchId);
        return;
      }

      case 'table:rename': {
        const { branchId, tableNumber, sessionName } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !sessionName.trim()) return;
        table.sessionName = sessionName.trim();
        broadcastState(`Table ${tableNumber} is now "${table.sessionName}"`, branchId);
        return;
      }

      case 'table:status': {
        const { branchId, tableNumber, status } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        table.status = status;
        if (status === 'available') {
          table.guests = [];
          table.cart = [];
          table.sessionName = `Table ${tableNumber}`;
          table.billRequested = false;
          table.lastReceipt = null;
          table.ticTacToe = null;
          table.trivia = null;
          table.drawGame = null;
          state.orders = state.orders.filter(
            (o) => !(o.branchId === branchId && o.tableNumber === tableNumber)
          );
        }
        broadcastState();
        return;
      }

      case 'cart:add': {
        const { branchId, tableNumber, item } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const addonSig = item.addons
          .map((a) => a.id)
          .sort()
          .join(',');
        const existing = table.cart.find(
          (c) =>
            c.menuItemId === item.menuItemId &&
            c.guestId === item.guestId &&
            c.portionLabel === item.portionLabel &&
            c.addons
              .map((a) => a.id)
              .sort()
              .join(',') === addonSig
        );
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          table.cart.push({
            ...item,
            id: `cart-${now}-${Math.random().toString(36).slice(2, 6)}`,
          });
        }
        if (table.status === 'occupied' || table.status === 'available') {
          table.status = 'ordering';
        }
        broadcastState();
        return;
      }

      case 'cart:update_qty': {
        const { branchId, tableNumber, cartItemId, delta } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const idx = table.cart.findIndex((c) => c.id === cartItemId);
        if (idx === -1) return;
        table.cart[idx].quantity += delta;
        if (table.cart[idx].quantity <= 0) {
          table.cart.splice(idx, 1);
        }
        broadcastState();
        return;
      }

      case 'cart:apply_offer': {
        const { branchId, tableNumber, offerId } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        table.appliedOfferId = offerId;
        broadcastState();
        return;
      }

      case 'order:submit': {
        const { branchId, tableNumber, notes } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || table.cart.length === 0) return;

        const orderItems: OrderItem[] = table.cart.map((c) => ({
          ...c,
          status: 'received',
        }));

        const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
        const orderNumber = state.nextOrderNumber++;
        const newOrder: KitchenOrder = {
          id: `ord-${orderNumber}-${now}`,
          orderNumber,
          branchId,
          tableNumber,
          tableSessionName: table.sessionName,
          items: orderItems,
          status: 'received',
          createdAt: now,
          updatedAt: now,
          subtotal,
          notes,
        };

        state.orders.unshift(newOrder);
        table.cart = [];
        table.status = 'preparing';
        state.branches[branchId].todayOrders += 1;

        // Award +20 points to unique guests in this order
        const guestIds = new Set(orderItems.map((i) => i.guestId));
        for (const gid of guestIds) {
          awardPoints(table, gid, 20);
        }

        // Deduct inventory for Kolkata or matching branch items
        for (const oi of orderItems) {
          const menu = state.menu.find((m) => m.id === oi.menuItemId);
          if (!menu) continue;
          for (const usage of menu.inventoryUsage) {
            const inv = state.inventory.find(
              (item) => item.id === usage.ingredientId && item.branchId === branchId
            );
            if (inv) {
              inv.remainingQty = Math.max(0, Number((inv.remainingQty - usage.units * 0.25 * oi.quantity).toFixed(1)));
              inv.remainingPct = Math.max(
                0,
                Math.round((inv.remainingQty / inv.capacityQty) * 100)
              );
            }
          }
        }

        broadcastState(`Order #${orderNumber} sent to kitchen for Table ${tableNumber}`, branchId);
        return;
      }

      case 'order:advance': {
        const { orderId, status } = event.payload;
        const order = state.orders.find((o) => o.id === orderId);
        if (!order) return;
        order.status = status;
        order.updatedAt = now;
        for (const item of order.items) {
          item.status = status;
        }
        const table = getTable(order.branchId, order.tableNumber);
        if (table) {
          if (status === 'preparing') table.status = 'preparing';
          if (status === 'ready') table.status = 'ready';
          if (status === 'served') table.status = 'serving';
        }
        broadcastState(
          `Order #${order.orderNumber} (Table ${order.tableNumber}) marked ${status}`,
          order.branchId
        );
        return;
      }

      case 'waiter:call': {
        const { branchId, tableNumber, guestName, reason } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const staffMember =
          state.staff.find((s) => s.id === table.assignedWaiterId) ||
          state.staff.find((s) => s.branchId === branchId);

        const reqId = `wr-${now}-${Math.random().toString(36).slice(2, 6)}`;
        state.waiterRequests.unshift({
          id: reqId,
          branchId,
          tableNumber,
          tableSessionName: table.sessionName,
          guestName,
          reason,
          status: 'pending',
          assignedStaffId: staffMember?.id || 'unassigned',
          assignedStaffName: staffMember?.name.split(' ')[0] || 'Staff',
          section: table.section,
          createdAt: now,
        });
        table.status = 'attention';
        broadcastState(
          `Table ${tableNumber} (${table.sessionName}): ${reason}`,
          branchId
        );
        return;
      }

      case 'waiter:update': {
        const { requestId, status, staffId } = event.payload;
        const req = state.waiterRequests.find((r) => r.id === requestId);
        if (!req) return;
        req.status = status;
        if (staffId) {
          const s = state.staff.find((st) => st.id === staffId);
          if (s) {
            req.assignedStaffId = s.id;
            req.assignedStaffName = s.name.split(' ')[0];
          }
        }
        const table = getTable(req.branchId, req.tableNumber);
        if (table && status === 'resolved') {
          table.status = 'serving';
        }
        broadcastState();
        return;
      }

      case 'game:ttt_start': {
        const { branchId, tableNumber, guestId, guestName } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        table.ticTacToe = {
          board: Array(9).fill(null),
          playerXId: guestId,
          playerXName: guestName,
          playerOId: null,
          playerOName: null,
          turn: 'X',
          winner: null,
        };
        awardPoints(table, guestId, 5);
        broadcastState();
        return;
      }

      case 'game:ttt_join': {
        const { branchId, tableNumber, guestId, guestName } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.ticTacToe) return;
        if (table.ticTacToe.playerXId === guestId) return;
        table.ticTacToe.playerOId = guestId;
        table.ticTacToe.playerOName = guestName;
        awardPoints(table, guestId, 5);
        broadcastState();
        return;
      }

      case 'game:ttt_move': {
        const { branchId, tableNumber, guestId, index } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.ticTacToe) return;
        const game = table.ticTacToe;
        if (game.winner || game.board[index] !== null) return;

        const isX = game.turn === 'X';
        if (isX && game.playerXId !== guestId) return;
        if (!isX) {
          if (!game.playerOId) {
            if (guestId === game.playerXId) return;
            game.playerOId = guestId;
            const g = table.guests.find((x) => x.id === guestId);
            game.playerOName = g?.name || 'Guest';
          } else if (game.playerOId !== guestId) {
            return;
          }
        }

        game.board[index] = game.turn;
        const winner = checkTicTacToeWinner(game.board);
        if (winner) {
          game.winner = winner;
          if (winner === 'X') awardPoints(table, game.playerXId, 25);
          if (winner === 'O' && game.playerOId) awardPoints(table, game.playerOId, 25);
        } else {
          game.turn = game.turn === 'X' ? 'O' : 'X';
        }
        broadcastState();
        return;
      }

      case 'game:trivia_start': {
        const { branchId, tableNumber, mode, opponentTableNumber } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const opponent =
          mode === 'versus'
            ? getTable(branchId, opponentTableNumber || 9)
            : undefined;

        const scores: Record<string, { name: string; points: number; answeredIndices: number[] }> =
          {};
        for (const g of table.guests) {
          scores[g.id] = { name: g.name, points: 0, answeredIndices: [] };
        }

        table.trivia = {
          active: true,
          mode,
          opponentTableNumber: opponent?.tableNumber,
          opponentSessionName: opponent?.sessionName || 'Foodies',
          questionIndex: 0,
          startedAt: now,
          endsAt: now + 60000,
          scores,
          opponentScore: mode === 'versus' ? 12 : 0,
          finished: false,
        };
        broadcastState();
        return;
      }

      case 'game:trivia_answer': {
        const { branchId, tableNumber, guestId, guestName, questionIndex, selectedIndex } =
          event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.trivia || table.trivia.finished) return;
        const trivia = table.trivia;
        const question = state.triviaBank[questionIndex];
        if (!question) return;

        if (!trivia.scores[guestId]) {
          trivia.scores[guestId] = { name: guestName, points: 0, answeredIndices: [] };
        }
        if (trivia.scores[guestId].answeredIndices.includes(questionIndex)) return;

        trivia.scores[guestId].answeredIndices.push(questionIndex);
        const correct = selectedIndex === question.correctIndex;
        if (correct) {
          trivia.scores[guestId].points += 10;
          awardPoints(table, guestId, 10);
        } else {
          awardPoints(table, guestId, 2);
        }

        if (questionIndex + 1 < state.triviaBank.length) {
          trivia.questionIndex = questionIndex + 1;
        } else {
          trivia.finished = true;
          trivia.active = false;
          const totalTablePts = Object.values(trivia.scores).reduce((s, v) => s + v.points, 0);
          if (trivia.mode === 'versus') {
            const won = totalTablePts >= trivia.opponentScore;
            trivia.winnerLabel = won
              ? `${table.sessionName} won (+100 pts)!`
              : `${trivia.opponentSessionName} edged ahead`;
            if (won) {
              for (const g of table.guests) {
                awardPoints(table, g.id, 25);
              }
            }
          } else {
            const leader = Object.values(trivia.scores).sort((a, b) => b.points - a.points)[0];
            trivia.winnerLabel = leader ? `${leader.name} leads with ${leader.points} pts` : 'Completed';
          }
        }
        broadcastState();
        return;
      }

      case 'game:draw_start': {
        const { branchId, tableNumber, drawerId, drawerName } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        const word = DRAW_PROMPTS[Math.floor(Math.random() * DRAW_PROMPTS.length)];
        const scores: Record<string, { name: string; points: number }> = {};
        for (const g of table.guests) {
          scores[g.id] = { name: g.name, points: 0 };
        }
        if (!scores[drawerId]) {
          scores[drawerId] = { name: drawerName, points: 0 };
        }
        table.drawGame = {
          phase: 'playing',
          round: 1,
          drawerId,
          drawerName,
          secretWord: word,
          maskedHint: makeMaskedHint(word),
          strokes: [],
          guesses: [],
          winnerGuestName: null,
          startedAt: now,
          endsAt: now + 75000,
          scores,
        };
        awardPoints(table, drawerId, 5);
        broadcastState();
        return;
      }

      case 'game:draw_stroke': {
        const { branchId, tableNumber, stroke } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.drawGame || table.drawGame.phase !== 'playing') return;
        if (!table.drawGame.strokes.some((s) => s.id === stroke.id)) {
          table.drawGame.strokes.push(stroke);
          broadcastState();
        }
        return;
      }

      case 'game:draw_undo': {
        const { branchId, tableNumber } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.drawGame || table.drawGame.phase !== 'playing') return;
        table.drawGame.strokes.pop();
        broadcastState();
        return;
      }

      case 'game:draw_clear': {
        const { branchId, tableNumber } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.drawGame || table.drawGame.phase !== 'playing') return;
        table.drawGame.strokes = [];
        broadcastState();
        return;
      }

      case 'game:draw_guess': {
        const { branchId, tableNumber, guestId, guestName, text } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.drawGame || table.drawGame.phase !== 'playing') return;
        const clean = text.trim();
        if (!clean) return;
        const dg = table.drawGame;
        const normalizedGuess = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedAnswer = dg.secretWord.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isCorrect = normalizedGuess === normalizedAnswer;

        dg.guesses.push({
          id: `dg-${now}-${Math.random().toString(36).slice(2, 6)}`,
          guestId,
          guestName,
          text: isCorrect ? `Guessed "${dg.secretWord}"!` : clean,
          correct: isCorrect,
          createdAt: now,
        });

        if (isCorrect) {
          dg.phase = 'round_summary';
          dg.winnerGuestName = guestName;
          if (!dg.scores[guestId]) {
            dg.scores[guestId] = { name: guestName, points: 0 };
          }
          dg.scores[guestId].points += 25;
          if (dg.scores[dg.drawerId]) {
            dg.scores[dg.drawerId].points += 15;
          }
          awardPoints(table, guestId, 25);
          awardPoints(table, dg.drawerId, 15);
          broadcastState(`${guestName} guessed "${dg.secretWord}" (+25 pts)!`, branchId);
        } else {
          broadcastState();
        }
        return;
      }

      case 'game:draw_next_round': {
        const { branchId, tableNumber } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table || !table.drawGame) return;
        const dg = table.drawGame;
        const guests = table.guests;
        const curIdx = guests.findIndex((g) => g.id === dg.drawerId);
        const nextGuest =
          guests.length > 0 ? guests[(curIdx + 1) % guests.length] : undefined;
        const nextWordCandidates = DRAW_PROMPTS.filter((w) => w !== dg.secretWord);
        const word =
          nextWordCandidates[Math.floor(Math.random() * nextWordCandidates.length)] ||
          DRAW_PROMPTS[0];

        dg.phase = 'playing';
        dg.round += 1;
        dg.drawerId = nextGuest?.id || dg.drawerId;
        dg.drawerName = nextGuest?.name || dg.drawerName;
        dg.secretWord = word;
        dg.maskedHint = makeMaskedHint(word);
        dg.strokes = [];
        dg.guesses = [];
        dg.winnerGuestName = null;
        dg.startedAt = now;
        dg.endsAt = now + 75000;
        broadcastState();
        return;
      }

      case 'bill:request': {
        const { branchId, tableNumber } = event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;
        table.billRequested = true;
        broadcastState(`Table ${tableNumber} (${table.sessionName}) requested the bill`, branchId);
        return;
      }

      case 'bill:pay': {
        const { branchId, tableNumber, splitMode, tipAmount, paymentMethod, guestId } =
          event.payload;
        const table = getTable(branchId, tableNumber);
        if (!table) return;

        const { allItems, subtotal, discount, tax, total } = calculateTableTotals(table, tipAmount);
        const pointsEarned = Math.max(20, Math.round(total / 25));

        const receipt: ReceiptRecord = {
          id: `rcp-${now}`,
          receiptNumber: `NAKI-${branchId.slice(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          branchId,
          tableNumber,
          tableSessionName: table.sessionName,
          items: allItems,
          subtotal,
          discount,
          tax,
          tipAmount,
          total,
          splitMode,
          paymentMethod,
          paidAt: now,
          pointsEarned,
        };

        table.lastReceipt = receipt;
        table.billRequested = false;
        table.status = 'serving';
        state.branches[branchId].todaySales += total;

        if (guestId) {
          awardPoints(table, guestId, pointsEarned);
        } else {
          for (const g of table.guests) {
            awardPoints(table, g.id, Math.round(pointsEarned / Math.max(1, table.guests.length)));
          }
        }

        // Mark all table orders as served
        for (const o of state.orders) {
          if (o.branchId === branchId && o.tableNumber === tableNumber) {
            o.status = 'served';
            o.updatedAt = now;
          }
        }

        broadcastState(
          `Payment received (₹${total}) for Table ${tableNumber} via ${paymentMethod}`,
          branchId
        );
        return;
      }

      case 'review:submit': {
        const {
          branchId,
          tableNumber,
          guestId,
          guestName,
          overall,
          food,
          service,
          cleanliness,
          comment,
        } = event.payload;
        const table = getTable(branchId, tableNumber);
        state.reviews.unshift({
          id: `rev-${now}`,
          branchId,
          tableNumber,
          tableSessionName: table?.sessionName || `Table ${tableNumber}`,
          guestName,
          overall,
          food,
          service,
          cleanliness,
          comment,
          createdAt: now,
        });
        if (table) {
          awardPoints(table, guestId, 10);
        }
        const branchReviews = state.reviews.filter((r) => r.branchId === branchId);
        if (branchReviews.length > 0) {
          const avg =
            branchReviews.reduce((s, r) => s + r.overall, 0) / branchReviews.length;
          state.branches[branchId].rating = Number(((state.branches[branchId].rating + avg) / 2).toFixed(1));
        }
        broadcastState(`Thank you ${guestName}! +10 loyalty points added.`, branchId);
        return;
      }

      case 'admin:toggle_offer': {
        const offer = state.offers.find((o) => o.id === event.payload.offerId);
        if (offer) {
          offer.active = !offer.active;
          broadcastState();
        }
        return;
      }

      case 'admin:update_pairings': {
        const item = state.menu.find((m) => m.id === event.payload.menuItemId);
        if (item) {
          item.recommendedIds = event.payload.recommendedIds;
          broadcastState();
        }
        return;
      }

      case 'admin:restock_inventory': {
        const inv = state.inventory.find((i) => i.id === event.payload.inventoryId);
        if (inv) {
          inv.remainingQty = inv.capacityQty;
          inv.remainingPct = 100;
          broadcastState(`Restocked ${inv.name} to 100%`, inv.branchId);
        }
        return;
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state:sync', payload: state } satisfies ServerEvent));

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as ClientEvent;
        handleClientEvent(parsed);
      } catch {
        // Ignore malformed payloads
      }
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TableSpace server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
