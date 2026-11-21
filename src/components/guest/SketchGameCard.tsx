import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Eraser,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  PenTool,
  Send,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ClientEvent,
  DrawStroke,
  DrawStrokePoint,
  GuestMember,
  TableSession,
} from '../../shared/types';

interface SketchGameCardProps {
  table: TableSession;
  activeGuest: GuestMember;
  sendEvent: (event: ClientEvent) => void;
}

const BRUSH_COLORS = [
  { label: 'Charcoal', hex: '#18181B' },
  { label: 'Saffron', hex: '#D97706' },
  { label: 'Chilli', hex: '#DC2626' },
  { label: 'Mint', hex: '#16A34A' },
  { label: 'Cobalt', hex: '#2563EB' },
];

const BRUSH_SIZES = [
  { label: 'Fine', size: 3 },
  { label: 'Medium', size: 7 },
  { label: 'Bold', size: 14 },
];

function playSynthTone(type: 'stroke' | 'win', muted: boolean) {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'stroke') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.06);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.06);
        gain.gain.setValueAtTime(0.06, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.32);
      });
    }
  } catch {
    // Ignore audio context restriction errors
  }
}

export const SketchGameCard: React.FC<SketchGameCardProps> = ({
  table,
  activeGuest,
  sendEvent,
}) => {
  const drawGame = table.drawGame;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentStrokeRef = useRef<DrawStroke | null>(null);
  const isDrawingRef = useRef(false);
  const lastPhaseRef = useRef<string | null>(null);

  const [brushColor, setBrushColor] = useState('#18181B');
  const [brushSize, setBrushSize] = useState(7);
  const [guessText, setGuessText] = useState('');
  const [hideSecret, setHideSecret] = useState(false);
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isDrawer = drawGame ? drawGame.drawerId === activeGuest.id : false;

  useEffect(() => {
    if (!drawGame || drawGame.phase !== 'playing') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [drawGame]);

  // Play win chime when transitioning into round_summary
  useEffect(() => {
    if (drawGame?.phase === 'round_summary' && lastPhaseRef.current === 'playing') {
      playSynthTone('win', muted);
    }
    lastPhaseRef.current = drawGame?.phase ?? null;
  }, [drawGame?.phase, muted]);

  const drawSmoothStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: DrawStroke, width: number, height: number) => {
      if (stroke.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const mx = ((curr.x + next.x) / 2) * width;
        const my = ((curr.y + next.y) / 2) * height;
        ctx.quadraticCurveTo(curr.x * width, curr.y * height, mx, my);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x * width, last.y * height);
      ctx.stroke();
      ctx.restore();
    },
    []
  );

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Subtle sketchbook dot grid
    ctx.fillStyle = '#E4E4E7';
    for (let x = 20; x < rect.width; x += 24) {
      for (let y = 20; y < rect.height; y += 24) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    const strokes = drawGame?.strokes || [];
    for (const s of strokes) {
      drawSmoothStroke(ctx, s, rect.width, rect.height);
    }
    if (currentStrokeRef.current) {
      drawSmoothStroke(ctx, currentStrokeRef.current, rect.width, rect.height);
    }
  }, [drawGame?.strokes, drawSmoothStroke]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas, expanded]);

  useEffect(() => {
    window.addEventListener('resize', redrawCanvas);
    return () => window.removeEventListener('resize', redrawCanvas);
  }, [redrawCanvas]);

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): DrawStrokePoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawGame || drawGame.phase !== 'playing' || !isDrawer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    playSynthTone('stroke', muted);
    const pt = getNormalizedPoint(e);
    currentStrokeRef.current = {
      id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      color: brushColor,
      size: brushSize,
      points: [pt],
    };
    redrawCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const pt = getNormalizedPoint(e);
    const pts = currentStrokeRef.current.points;
    const prev = pts[pts.length - 1];
    // Thin out overly dense points for smooth minimal payload
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.006) {
      pts.push(pt);
      redrawCanvas();
    }
  };

  const finishStroke = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke.points.length > 0) {
      sendEvent({
        type: 'game:draw_stroke',
        payload: {
          branchId: table.branchId,
          tableNumber: table.tableNumber,
          stroke,
        },
      });
    }
  };

  const remainingSec =
    drawGame?.phase === 'playing' ? Math.max(0, Math.ceil((drawGame.endsAt - now) / 1000)) : 0;

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessText.trim()) return;
    sendEvent({
      type: 'game:draw_guess',
      payload: {
        branchId: table.branchId,
        tableNumber: table.tableNumber,
        guestId: activeGuest.id,
        guestName: activeGuest.name,
        text: guessText.trim(),
      },
    });
    setGuessText('');
  };

  return (
    <div
      className={
        expanded
          ? 'fixed inset-0 z-50 bg-white p-4 sm:p-6 flex flex-col justify-between overflow-y-auto'
          : 'p-5 rounded-2xl bg-white border border-zinc-200 space-y-4'
      }
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 mb-0.5">
            <PenTool className="w-4 h-4 text-amber-600" />
            <span>Table Sketch &amp; Guess · Live Synced</span>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">
            Guess the Dish
            {drawGame && (
              <span className="ml-2 text-xs font-normal text-zinc-500 font-mono-tabular">
                Round {drawGame.round}
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {drawGame?.phase === 'playing' && (
            <span className="text-sm font-semibold text-amber-700 font-mono-tabular mr-1">
              {remainingSec}s
            </span>
          )}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            aria-label={muted ? 'Unmute game sound' : 'Mute game sound'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {drawGame && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              aria-label={expanded ? 'Exit fullscreen sketchpad' : 'Expand sketchpad'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* TITLE SCREEN */}
      {!drawGame && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center py-4">
          <div className="md:col-span-5 flex items-center justify-center p-6 rounded-2xl bg-zinc-50 border border-zinc-200">
            <svg viewBox="0 0 180 120" className="w-44 h-28" aria-hidden="true">
              <rect x="12" y="10" width="156" height="100" rx="10" fill="#FFFFFF" stroke="#E4E4E7" strokeWidth="2" />
              <path
                d="M38 78 C55 40, 88 38, 108 66 C118 80, 134 55, 146 42"
                fill="none"
                stroke="#D97706"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="62" cy="74" r="14" fill="none" stroke="#18181B" strokeWidth="3" />
              <path d="M126 30 L144 48 L136 56 L118 38 Z" fill="#18181B" />
              <polygon points="118,38 112,52 126,46" fill="#D97706" />
            </svg>
          </div>
          <div className="md:col-span-7 space-y-3">
            <h4 className="text-base font-semibold text-zinc-900">
              Sketch a dish on your phone. Tablemates guess live.
            </h4>
            <p className="text-sm text-zinc-600 leading-relaxed">
              One guest gets a secret dish prompt (like <em>Miso Ramen</em> or <em>Prawn Tempura Roll</em>) and draws it on the shared canvas. Everyone else at {table.sessionName} races to type the answer.
            </p>
            <p className="text-xs text-zinc-500">
              Correct guess: +25 loyalty pts · Sketcher bonus: +15 loyalty pts
            </p>
            <button
              type="button"
              onClick={() =>
                sendEvent({
                  type: 'game:draw_start',
                  payload: {
                    branchId: table.branchId,
                    tableNumber: table.tableNumber,
                    drawerId: activeGuest.id,
                    drawerName: activeGuest.name,
                  },
                })
              }
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
            >
              Start Sketch Match (+5 pts)
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE PLAY / ROUND SUMMARY */}
      {drawGame && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1">
          {/* Canvas & Brush Controls (Left 8 cols) */}
          <div className="lg:col-span-8 space-y-3">
            {/* Prompt / Hint Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm">
              {isDrawer ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Your secret dish:</span>
                  <strong className="text-zinc-900 tracking-wide">
                    {hideSecret ? '••••••••••' : drawGame.secretWord}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setHideSecret((h) => !h)}
                    className="p-1 rounded text-zinc-500 hover:text-zinc-900"
                    aria-label={hideSecret ? 'Show secret word' : 'Hide secret word'}
                  >
                    {hideSecret ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {drawGame.drawerName} is sketching:
                  </span>
                  <span className="font-mono-tabular font-bold tracking-widest text-zinc-900">
                    {drawGame.phase === 'round_summary'
                      ? drawGame.secretWord
                      : drawGame.maskedHint}
                  </span>
                </div>
              )}

              <span className="text-xs text-zinc-500">
                {isDrawer ? 'Draw without letters or numbers' : 'Type your guess on the right'}
              </span>
            </div>

            {/* Canvas Container */}
            <div className="relative rounded-2xl border border-zinc-300 overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                className={`w-full block touch-none select-none ${
                  expanded ? 'h-[54vh]' : 'h-[290px] sm:h-[340px]'
                } ${isDrawer && drawGame.phase === 'playing' ? 'cursor-crosshair' : 'cursor-default'}`}
              />

              {drawGame.phase === 'round_summary' && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-zinc-900 p-6 text-center space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Dish Guessed
                  </p>
                  <h4 className="text-2xl font-bold text-zinc-900">{drawGame.secretWord}</h4>
                  <p className="text-sm text-zinc-600">
                    {drawGame.winnerGuestName} guessed it right (+25 pts) · {drawGame.drawerName} (+15 pts)
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'game:draw_next_round',
                        payload: {
                          branchId: table.branchId,
                          tableNumber: table.tableNumber,
                        },
                      })
                    }
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-colors"
                  >
                    Next Round (Rotate Sketcher)
                  </button>
                </div>
              )}
            </div>

            {/* Brush Toolbar (only active for Sketcher) */}
            {isDrawer && drawGame.phase === 'playing' && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  {BRUSH_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setBrushColor(c.hex)}
                      aria-label={`Brush color ${c.label}`}
                      className="w-8 h-8 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: brushColor === c.hex ? '#18181B' : '#E4E4E7',
                        transform: brushColor === c.hex ? 'scale(1.12)' : 'scale(1)',
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setBrushColor('#FFFFFF')}
                    aria-label="Eraser"
                    className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 ${
                      brushColor === '#FFFFFF'
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Erase</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {BRUSH_SIZES.map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => setBrushSize(b.size)}
                      className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium ${
                        brushSize === b.size
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-700'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'game:draw_undo',
                        payload: { branchId: table.branchId, tableNumber: table.tableNumber },
                      })
                    }
                    className="min-h-[34px] px-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'game:draw_clear',
                        payload: { branchId: table.branchId, tableNumber: table.tableNumber },
                      })
                    }
                    className="min-h-[34px] px-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Guesses & Round Scores (4 cols) */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4 h-full">
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
              <p className="text-xs font-semibold text-zinc-500">Sketch &amp; Guess Scoreboard</p>
              <div className="flex flex-wrap gap-3 text-xs">
                {Object.values(drawGame.scores).map((s) => (
                  <span key={s.name} className="font-mono-tabular text-zinc-800">
                    {s.name}: <strong>{s.points}</strong>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[170px] max-h-[240px] overflow-y-auto p-3 rounded-xl border border-zinc-200 bg-white space-y-2">
              {drawGame.guesses.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-6">
                  {isDrawer
                    ? 'Switch active guest above (e.g. Riya) to test guessing your own sketch!'
                    : 'No guesses yet. Take the first shot!'}
                </p>
              ) : (
                drawGame.guesses.map((g) => (
                  <div
                    key={g.id}
                    className={`text-xs px-2.5 py-1.5 rounded-lg ${
                      g.correct
                        ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200'
                        : 'bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <span className="font-semibold">{g.guestName}: </span>
                    <span>{g.text}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleGuessSubmit} className="flex items-center gap-2">
              <input
                type="text"
                disabled={isDrawer || drawGame.phase !== 'playing'}
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                placeholder={
                  isDrawer
                    ? 'You are sketching...'
                    : 'Guess the dish (e.g. Miso Ramen)'
                }
                className="flex-1 h-11 px-3 rounded-xl border border-zinc-200 text-sm text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={isDrawer || drawGame.phase !== 'playing' || !guessText.trim()}
                className="min-h-[44px] px-3.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-500 inline-flex items-center gap-1.5"
                aria-label="Send guess"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
