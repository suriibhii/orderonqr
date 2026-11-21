import React, { useEffect, useState } from 'react';
import { Trophy, Gamepad2, Users, Award, RotateCcw } from 'lucide-react';
import type { ClientEvent, GuestMember, TableSession, TriviaQuestion } from '../../shared/types';
import { SketchGameCard } from './SketchGameCard';

interface TableGamesPanelProps {
  table: TableSession;
  activeGuest: GuestMember;
  triviaBank: TriviaQuestion[];
  sendEvent: (event: ClientEvent) => void;
}

export const TableGamesPanel: React.FC<TableGamesPanelProps> = ({
  table,
  activeGuest,
  triviaBank,
  sendEvent,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!table.trivia?.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [table.trivia?.active]);

  const ttt = table.ticTacToe;
  const trivia = table.trivia;
  const remainingSec = trivia?.active
    ? Math.max(0, Math.ceil((trivia.endsAt - now) / 1000))
    : 0;

  const currentQuestion =
    trivia && triviaBank[trivia.questionIndex] ? triviaBank[trivia.questionIndex] : null;

  const sortedLeaderboard = trivia
    ? Object.values(trivia.scores).sort((a, b) => b.points - a.points)
    : [];

  const nextLoyaltyMilestone = Math.ceil((activeGuest.loyaltyPoints + 1) / 500) * 500;
  const ptsAway = Math.max(0, nextLoyaltyMilestone - activeGuest.loyaltyPoints);
  const progressPct = Math.min(100, Math.round(((activeGuest.loyaltyPoints % 500) / 500) * 100));

  return (
    <div className="space-y-6">
      {/* Gamified Loyalty Progress */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
            <Award className="w-4 h-4" />
            <span>{activeGuest.name}&apos;s Loyalty Rewards</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 font-mono-tabular">
              {activeGuest.loyaltyPoints.toLocaleString()} pts
            </span>
            <span className="text-xs text-zinc-500">
              {ptsAway} points away from ₹100 table discount
            </span>
          </div>
          <div className="w-full max-w-sm h-2 rounded-full bg-zinc-100 overflow-hidden mt-2">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-zinc-600 shrink-0">
          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
            <p className="font-medium text-zinc-900 font-mono-tabular">+20 pts</p>
            <p className="text-zinc-500">Ordering</p>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
            <p className="font-medium text-zinc-900 font-mono-tabular">+5 pts</p>
            <p className="text-zinc-500">Playing</p>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
            <p className="font-medium text-zinc-900 font-mono-tabular">+25 pts</p>
            <p className="text-zinc-500">Winning</p>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-100">
            <p className="font-medium text-zinc-900 font-mono-tabular">+10 pts</p>
            <p className="text-zinc-500">Reviewing</p>
          </div>
        </div>
      </div>

      {/* Real-Time Collaborative Sketch & Guess Game */}
      <SketchGameCard table={table} activeGuest={activeGuest} sendEvent={sendEvent} />

      {/* 2-Column Games Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tic-Tac-Toe Multiplayer at Table */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col justify-between space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-1">
                <Gamepad2 className="w-4 h-4 text-amber-600" />
                <span>Table {table.tableNumber} Live Multiplayer</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">Tic-Tac-Toe</h3>
            </div>
            <button
              type="button"
              onClick={() =>
                sendEvent({
                  type: 'game:ttt_start',
                  payload: {
                    branchId: table.branchId,
                    tableNumber: table.tableNumber,
                    guestId: activeGuest.id,
                    guestName: activeGuest.name,
                  },
                })
              }
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{ttt ? 'New Match' : 'Start Match'}</span>
            </button>
          </div>

          {ttt ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-200">
                <span className={ttt.turn === 'X' && !ttt.winner ? 'font-semibold text-zinc-900' : 'text-zinc-600'}>
                  X: {ttt.playerXName}
                </span>
                <span className="text-xs text-zinc-400">vs</span>
                {ttt.playerOName ? (
                  <span className={ttt.turn === 'O' && !ttt.winner ? 'font-semibold text-amber-700' : 'text-zinc-600'}>
                    O: {ttt.playerOName}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={ttt.playerXId === activeGuest.id}
                    onClick={() =>
                      sendEvent({
                        type: 'game:ttt_join',
                        payload: {
                          branchId: table.branchId,
                          tableNumber: table.tableNumber,
                          guestId: activeGuest.id,
                          guestName: activeGuest.name,
                        },
                      })
                    }
                    className="text-xs font-semibold text-amber-700 hover:underline disabled:text-zinc-400 disabled:no-underline"
                  >
                    {ttt.playerXId === activeGuest.id ? 'Waiting for O...' : `Join as O (${activeGuest.name})`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {ttt.board.map((cell, idx) => {
                  const canMove =
                    !ttt.winner &&
                    cell === null &&
                    ((ttt.turn === 'X' && ttt.playerXId === activeGuest.id) ||
                      (ttt.turn === 'O' &&
                        (ttt.playerOId === activeGuest.id ||
                          (!ttt.playerOId && ttt.playerXId !== activeGuest.id))));

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!canMove}
                      onClick={() =>
                        sendEvent({
                          type: 'game:ttt_move',
                          payload: {
                            branchId: table.branchId,
                            tableNumber: table.tableNumber,
                            guestId: activeGuest.id,
                            index: idx,
                          },
                        })
                      }
                      className={`h-18 rounded-xl border text-2xl font-bold font-display transition-colors flex items-center justify-center ${
                        cell === 'X'
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : cell === 'O'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : canMove
                          ? 'bg-white border-zinc-300 hover:border-zinc-500 cursor-pointer'
                          : 'bg-zinc-50 border-zinc-200 cursor-default'
                      }`}
                    >
                      {cell}
                    </button>
                  );
                })}
              </div>

              <div className="text-center text-sm font-medium">
                {ttt.winner === 'draw' && <span className="text-zinc-700">Match drawn! Start a rematch.</span>}
                {ttt.winner === 'X' && (
                  <span className="text-emerald-700">{ttt.playerXName} wins (+25 pts)!</span>
                )}
                {ttt.winner === 'O' && (
                  <span className="text-emerald-700">{ttt.playerOName} wins (+25 pts)!</span>
                )}
                {!ttt.winner && (
                  <span className="text-zinc-500">
                    Turn: {ttt.turn === 'X' ? ttt.playerXName : ttt.playerOName || 'Any tablemate'} (switch active guest above to play both sides)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-zinc-500">
                Challenge anyone sitting at {table.sessionName} while your food cooks.
              </p>
              <button
                type="button"
                onClick={() =>
                  sendEvent({
                    type: 'game:ttt_start',
                    payload: {
                      branchId: table.branchId,
                      tableNumber: table.tableNumber,
                      guestId: activeGuest.id,
                      guestName: activeGuest.name,
                    },
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
              >
                Start Tic-Tac-Toe (+5 pts)
              </button>
            </div>
          )}
        </div>

        {/* Food Trivia & Table vs Table Challenge */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col justify-between space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-1">
                <Trophy className="w-4 h-4 text-amber-600" />
                <span>60-Second Quick Quiz</span>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Food Trivia &amp; Table Challenge
              </h3>
            </div>
            {trivia?.active && (
              <span className="text-sm font-semibold text-amber-700 font-mono-tabular">
                {remainingSec}s
              </span>
            )}
          </div>

          {!trivia ? (
            <div className="py-6 space-y-4">
              <p className="text-sm text-zinc-600 leading-relaxed">
                Compete against your own tablemates or challenge <strong>Table 9 — Sushi Lovers</strong> in a 60-second Japanese culinary trivia sprint for 100 bonus reward points.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    sendEvent({
                      type: 'game:trivia_start',
                      payload: {
                        branchId: table.branchId,
                        tableNumber: table.tableNumber,
                        mode: 'table',
                      },
                    })
                  }
                  className="min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 flex items-center justify-center gap-2"
                >
                  <Users className="w-4 h-4" />
                  <span>Play With Table</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    sendEvent({
                      type: 'game:trivia_start',
                      payload: {
                        branchId: table.branchId,
                        tableNumber: table.tableNumber,
                        mode: 'versus',
                        opponentTableNumber: table.tableNumber === 9 ? 6 : 9,
                      },
                    })
                  }
                  className="min-h-[46px] px-4 py-2.5 rounded-xl border border-amber-600 bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4 text-amber-700" />
                  <span>Challenge Table {table.tableNumber === 9 ? 6 : 9}</span>
                </button>
              </div>
            </div>
          ) : trivia.finished ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900">
                  {trivia.winnerLabel || 'Quiz Complete'}
                </p>
                {trivia.mode === 'versus' && (
                  <p className="text-xs text-amber-800 mt-1 font-mono-tabular">
                    {table.sessionName}: {sortedLeaderboard.reduce((s, x) => s + x.points, 0)} pts vs{' '}
                    {trivia.opponentSessionName}: {trivia.opponentScore} pts
                  </p>
                )}
              </div>

              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl">
                {sortedLeaderboard.map((entry, idx) => (
                  <div key={entry.name} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-900">
                      {idx + 1}. {entry.name}
                    </span>
                    <span className="font-mono-tabular text-zinc-700">{entry.points} pts</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  sendEvent({
                    type: 'game:trivia_start',
                    payload: {
                      branchId: table.branchId,
                      tableNumber: table.tableNumber,
                      mode: trivia.mode,
                      opponentTableNumber: trivia.opponentTableNumber,
                    },
                  })
                }
                className="w-full min-h-[44px] rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
              >
                Play Another Round
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trivia.mode === 'versus' && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900">
                  <span>
                    Table {table.tableNumber} ({table.sessionName})
                  </span>
                  <span>vs</span>
                  <span>
                    Table {trivia.opponentTableNumber} ({trivia.opponentSessionName})
                  </span>
                </div>
              )}

              {currentQuestion && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-zinc-500 font-mono-tabular">
                    Question {trivia.questionIndex + 1} of {triviaBank.length}
                  </p>
                  <p className="text-base font-medium text-zinc-900 leading-snug">
                    {currentQuestion.prompt}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {currentQuestion.options.map((opt, idx) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          sendEvent({
                            type: 'game:trivia_answer',
                            payload: {
                              branchId: table.branchId,
                              tableNumber: table.tableNumber,
                              guestId: activeGuest.id,
                              guestName: activeGuest.name,
                              questionIndex: trivia.questionIndex,
                              selectedIndex: idx,
                            },
                          })
                        }
                        className="min-h-[44px] px-4 py-2.5 rounded-xl border border-zinc-200 text-left text-sm font-medium text-zinc-800 hover:border-zinc-900 hover:bg-zinc-50 transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-zinc-600 pt-1">
                {sortedLeaderboard.map((entry) => (
                  <span key={entry.name} className="font-mono-tabular">
                    {entry.name}: {entry.points} pts
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
