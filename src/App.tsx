import React, { useEffect, useState } from 'react';
import { QrCode, X } from 'lucide-react';
import { useRestaurantSocket } from './hooks/useRestaurantSocket';
import { GuestExperience } from './components/GuestExperience';
import { KitchenDisplay } from './components/KitchenDisplay';
import { WaiterFloorView } from './components/WaiterFloorView';
import { OwnerDashboard } from './components/OwnerDashboard';
import { QrTableModal } from './components/QrTableModal';
import type { BranchId } from './shared/types';

type WorkspaceRole = 'guest' | 'kitchen' | 'floor' | 'owner';

export default function App() {
  const { state, error, toast, dismissToast, sendEvent } = useRestaurantSocket();
  const [role, setRole] = useState<WorkspaceRole>('guest');
  const [branchId, setBranchId] = useState<BranchId>('chandannagar');
  const [tableNumber, setTableNumber] = useState<number>(6);
  const [activeGuestName, setActiveGuestName] = useState<string>('Surbhi');
  const [qrModalOpen, setQrModalOpen] = useState(false);

  // Support optional URL deep-link ?branch=chandannagar&table=6&role=guest
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b = params.get('branch') as BranchId | null;
    const t = Number(params.get('table'));
    const r = params.get('role') as WorkspaceRole | null;
    if (b && (b === 'chandannagar' || b === 'kolkata' || b === 'serampore')) setBranchId(b);
    if (t && !Number.isNaN(t)) setTableNumber(t);
    if (r && (r === 'guest' || r === 'kitchen' || r === 'floor' || r === 'owner')) setRole(r);
  }, []);

  if (error && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-zinc-200 p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-zinc-900">Unable to connect to TableSpace</h1>
          <p className="text-sm text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <header className="h-16 border-b border-zinc-200 bg-white px-6 flex items-center justify-between">
          <div className="h-5 w-28 bg-zinc-200 rounded animate-pulse" />
          <div className="h-9 w-24 bg-zinc-200 rounded-lg animate-pulse" />
        </header>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <div className="h-28 bg-white rounded-2xl border border-zinc-200 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="h-64 bg-white rounded-2xl border border-zinc-200 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl border border-zinc-200 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl border border-zinc-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const activeTable =
    state.tables[`${branchId}:${tableNumber}`] ||
    state.tables[`${branchId}:6`] ||
    Object.values(state.tables)[0];

  const navItems: { id: WorkspaceRole; label: string }[] = [
    { id: 'guest', label: 'Guest Table' },
    { id: 'kitchen', label: 'Kitchen Display' },
    { id: 'floor', label: 'Waiter & Floor' },
    { id: 'owner', label: 'Owner Dashboard' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b bg-white/95 border-zinc-200 text-zinc-900 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setRole('guest')}
            className="text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
          >
            Naki Saki
          </button>

          {/* Zone 2: 4 single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Primary workspaces">
            {navItems.map((item) => {
              const active = role === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRole(item.id)}
                  className={`py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-zinc-900 text-zinc-900'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR</span>
            </button>
          </div>
        </div>

        {/* Mobile Role Switcher Strip */}
        <div className="md:hidden px-4 pb-2.5 flex items-center gap-4 overflow-x-auto border-t border-zinc-100">
          {navItems.map((item) => {
            const active = role === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRole(item.id)}
                className={`pt-2 pb-1 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 ${
                  active
                    ? 'border-zinc-900 text-zinc-900'
                    : 'border-transparent text-zinc-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Live Event Notification Toast */}
      {toast && (
        <div
          role="status"
          className="fixed top-20 right-4 z-50 max-w-sm bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-lg border border-zinc-700 flex items-center justify-between gap-3 text-xs font-medium"
        >
          <span>{toast}</span>
          <button
            type="button"
            onClick={dismissToast}
            className="text-zinc-400 hover:text-white p-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace Viewport */}
      <main>
        {role === 'guest' && activeTable && (
          <GuestExperience
            state={state}
            table={activeTable}
            activeGuestName={activeGuestName}
            onSelectGuestName={setActiveGuestName}
            onOpenQrModal={() => setQrModalOpen(true)}
            sendEvent={sendEvent}
          />
        )}

        {role === 'kitchen' && (
          <KitchenDisplay
            state={state}
            branchId={branchId}
            onBranchChange={setBranchId}
            sendEvent={sendEvent}
          />
        )}

        {role === 'floor' && (
          <WaiterFloorView
            state={state}
            branchId={branchId}
            onBranchChange={setBranchId}
            onInspectGuestTable={(bId, tNum) => {
              setBranchId(bId);
              setTableNumber(tNum);
              const t = state.tables[`${bId}:${tNum}`];
              if (t && t.guests[0]) setActiveGuestName(t.guests[0].name);
              setRole('guest');
            }}
            sendEvent={sendEvent}
          />
        )}

        {role === 'owner' && (
          <OwnerDashboard
            state={state}
            branchId={branchId}
            onBranchChange={setBranchId}
            sendEvent={sendEvent}
          />
        )}
      </main>

      <QrTableModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        state={state}
        currentBranchId={branchId}
        currentTableNumber={tableNumber}
        onSelectSession={(bId, tNum, gName) => {
          setBranchId(bId);
          setTableNumber(tNum);
          setActiveGuestName(gName);
          setRole('guest');
        }}
        sendEvent={sendEvent}
      />
    </div>
  );
}
