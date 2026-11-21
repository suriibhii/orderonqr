import React, { useEffect, useState } from 'react';
import { QrCode, Users, X, Check, Copy } from 'lucide-react';
import QRCode from 'qrcode';
import type { BranchId, ClientEvent, RestaurantState } from '../shared/types';

interface QrTableModalProps {
  open: boolean;
  onClose: () => void;
  state: RestaurantState;
  currentBranchId: BranchId;
  currentTableNumber: number;
  onSelectSession: (branchId: BranchId, tableNumber: number, guestName: string) => void;
  sendEvent: (event: ClientEvent) => void;
}

const AVATAR_COLORS = ['#D97706', '#0F766E', '#3730A3', '#9F1239', '#15803D', '#1E293B'];

function ScannableQrImage({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: 224,
      margin: 1,
      color: { dark: '#18181B', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value]);

  if (!dataUrl) {
    return (
      <div className="w-28 h-28 bg-white rounded-lg border border-zinc-200 shrink-0 animate-pulse" />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Scannable QR code for ${value}`}
      className="w-28 h-28 bg-white p-1.5 rounded-lg border border-zinc-200 shrink-0 object-contain"
    />
  );
}

export const QrTableModal: React.FC<QrTableModalProps> = ({
  open,
  onClose,
  state,
  currentBranchId,
  currentTableNumber,
  onSelectSession,
  sendEvent,
}) => {
  const [branchId, setBranchId] = useState<BranchId>(currentBranchId);
  const [tableNumber, setTableNumber] = useState<number>(currentTableNumber);
  const [guestName, setGuestName] = useState('Surbhi');
  const [sessionName, setSessionName] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const branchTables = Object.values(state.tables)
    .filter((t) => t.branchId === branchId)
    .sort((a, b) => a.tableNumber - b.tableNumber);

  const selectedTable = state.tables[`${branchId}:${tableNumber}`] || branchTables[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrPayload = `${origin}/?branch=${branchId}&table=${tableNumber}&role=guest`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(qrPayload).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanGuest = guestName.trim() || 'Guest';
    sendEvent({
      type: 'table:join',
      payload: {
        branchId,
        tableNumber,
        sessionName: sessionName.trim() || undefined,
        guestName: cleanGuest,
        avatarColor,
      },
    });
    onSelectSession(branchId, tableNumber, cleanGuest);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-amber-600" />
            <h2 id="qr-modal-title" className="text-lg font-semibold text-zinc-900">
              Scan Table QR &amp; Create Session Identity
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleJoin} className="p-6 overflow-y-auto space-y-6">
          {/* Branch & Table QR Preview */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="flex items-center gap-4">
              <ScannableQrImage value={qrPayload} />
              <div className="space-y-1">
                <p className="text-xs font-medium text-zinc-500">
                  {state.branches[branchId].name} · {selectedTable?.section}
                </p>
                <p className="text-base font-semibold text-zinc-900">
                  Table {tableNumber} — {selectedTable?.sessionName}
                </p>
                <p className="text-xs text-zinc-500 font-mono-tabular">
                  {selectedTable?.guests.length || 0} active guests · Capacity {selectedTable?.capacity}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-800 hover:bg-zinc-100 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link' : 'Copy Table Link'}</span>
            </button>
          </div>

          {/* Branch Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-800">Select Branch</label>
            <div className="grid grid-cols-3 gap-2">
              {(['chandannagar', 'kolkata', 'serampore'] as BranchId[]).map((bId) => (
                <button
                  key={bId}
                  type="button"
                  onClick={() => setBranchId(bId)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap truncate ${
                    branchId === bId
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {state.branches[bId].city}
                </button>
              ))}
            </div>
          </div>

          {/* Table Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-800">Select Table QR</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {branchTables.map((t) => (
                <button
                  key={t.tableNumber}
                  type="button"
                  onClick={() => {
                    setTableNumber(t.tableNumber);
                    setSessionName(
                      t.sessionName === `Table ${t.tableNumber}` ? '' : t.sessionName
                    );
                  }}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    tableNumber === t.tableNumber
                      ? 'border-amber-600 bg-amber-50/70 text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold font-mono-tabular">
                      T{t.tableNumber}
                    </span>
                    <span className="text-xs text-zinc-500 capitalize">{t.status}</span>
                  </div>
                  <p className="text-xs text-zinc-600 truncate mt-0.5">{t.sessionName}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Existing Guests Quick Switch */}
          {selectedTable && selectedTable.guests.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                <Users className="w-4 h-4 text-zinc-500" />
                <span>Already at Table {tableNumber} (tap to act as guest)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTable.guests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      onSelectSession(branchId, tableNumber, g.name);
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 bg-white hover:border-zinc-400 text-sm text-zinc-800 transition-colors"
                  >
                    <span
                      className="w-6 h-6 rounded-full text-[11px] font-semibold text-white flex items-center justify-center shrink-0"
                      style={{ backgroundColor: g.avatarColor }}
                    >
                      {g.initials}
                    </span>
                    <span className="font-medium">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Join or Rename Table Space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="guest-name-input" className="block text-sm font-medium text-zinc-800 mb-1.5">
                Your Name / Nickname
              </label>
              <input
                id="guest-name-input"
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Surbhi"
                className="w-full h-11 px-3.5 rounded-lg border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <div>
              <label htmlFor="session-name-input" className="block text-sm font-medium text-zinc-800 mb-1.5">
                Table Session Name (Optional)
              </label>
              <input
                id="session-name-input"
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={selectedTable?.sessionName || 'e.g. The Avengers'}
                className="w-full h-11 px-3.5 rounded-lg border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 mr-1">Avatar color</span>
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className="w-7 h-7 rounded-full flex items-center justify-center border-2 transition-transform"
                  style={{
                    backgroundColor: color,
                    borderColor: avatarColor === color ? '#18181B' : 'transparent',
                  }}
                  aria-label={`Select color ${color}`}
                >
                  {avatarColor === color && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              Join Table {tableNumber}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
