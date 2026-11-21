import React, { useMemo, useState } from 'react';
import { Bell, Check, MapPin, Navigation, Users, ArrowUpRight } from 'lucide-react';
import type { BranchId, ClientEvent, RestaurantState, TableStatus } from '../shared/types';

interface WaiterFloorViewProps {
  state: RestaurantState;
  branchId: BranchId;
  onBranchChange: (branchId: BranchId) => void;
  onInspectGuestTable: (branchId: BranchId, tableNumber: number) => void;
  sendEvent: (event: ClientEvent) => void;
}

const STATUS_META: Record<
  TableStatus,
  { label: string; cardClass: string; textClass: string }
> = {
  available: {
    label: 'Available',
    cardClass: 'bg-emerald-50/70 border-emerald-200',
    textClass: 'text-emerald-800',
  },
  occupied: {
    label: 'Occupied',
    cardClass: 'bg-amber-50/70 border-amber-200',
    textClass: 'text-amber-800',
  },
  ordering: {
    label: 'Ordering',
    cardClass: 'bg-amber-50 border-amber-300',
    textClass: 'text-amber-900',
  },
  preparing: {
    label: 'Cooking',
    cardClass: 'bg-orange-50 border-orange-300',
    textClass: 'text-orange-900',
  },
  ready: {
    label: 'Food Ready',
    cardClass: 'bg-sky-50 border-sky-300',
    textClass: 'text-sky-900',
  },
  serving: {
    label: 'Serving',
    cardClass: 'bg-blue-50/70 border-blue-200',
    textClass: 'text-blue-900',
  },
  cleaning: {
    label: 'Cleaning',
    cardClass: 'bg-purple-50/70 border-purple-200',
    textClass: 'text-purple-900',
  },
  attention: {
    label: 'Needs Attention',
    cardClass: 'bg-rose-50 border-rose-300',
    textClass: 'text-rose-900',
  },
};

export const WaiterFloorView: React.FC<WaiterFloorViewProps> = ({
  state,
  branchId,
  onBranchChange,
  onInspectGuestTable,
  sendEvent,
}) => {
  const [selectedTableNum, setSelectedTableNum] = useState<number>(6);

  const tables = useMemo(
    () =>
      Object.values(state.tables)
        .filter((t) => t.branchId === branchId)
        .sort((a, b) => a.tableNumber - b.tableNumber),
    [state.tables, branchId]
  );

  const selectedTable = tables.find((t) => t.tableNumber === selectedTableNum) || tables[0];

  const requests = useMemo(
    () =>
      state.waiterRequests
        .filter((r) => r.branchId === branchId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.waiterRequests, branchId]
  );

  const branchStaff = useMemo(
    () => state.staff.filter((s) => s.branchId === branchId),
    [state.staff, branchId]
  );

  const assignedCaptain = branchStaff.find((s) => s.id === selectedTable?.assignedWaiterId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <p className="text-xs font-medium text-zinc-500">
            {state.branches[branchId].name} · Real-Time Operations
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Live Floor Map &amp; Waiter Routing
          </h1>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-200/70">
          {(['chandannagar', 'kolkata', 'serampore'] as BranchId[]).map((bId) => (
            <button
              key={bId}
              type="button"
              onClick={() => onBranchChange(bId)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                branchId === bId ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {state.branches[bId].city}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Spatial Floor Map + Selected Table Inspector */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">
                Restaurant Floor View
              </h2>
              <span className="text-xs text-zinc-500">
                Tap any table to route staff or update status
              </span>
            </div>

            {/* Interactive Floor Grid */}
            <div className="relative rounded-2xl bg-zinc-50 border border-zinc-200 p-4 sm:p-5">
              {/* Kitchen Pass & Host Desk Anchors */}
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 pb-3 mb-4 border-b border-dashed border-zinc-300">
                <span>Tatami Alcove (Tables 1–2)</span>
                <span>Sushi Pass &amp; Matcha Bar</span>
                <span>Lantern Patio (Tables 5, 8, 9)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tables.map((t) => {
                  const meta = STATUS_META[t.status];
                  const isSelected = selectedTable?.tableNumber === t.tableNumber;
                  const waiter = branchStaff.find((s) => s.id === t.assignedWaiterId);
                  return (
                    <button
                      key={t.tableNumber}
                      type="button"
                      onClick={() => setSelectedTableNum(t.tableNumber)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[116px] ${
                        meta.cardClass
                      } ${isSelected ? 'ring-2 ring-zinc-900' : 'hover:border-zinc-400'}`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-bold font-mono-tabular text-zinc-900">
                          Table {t.tableNumber}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-zinc-500">
                          {t.guests.length}/{t.capacity}
                        </span>
                      </div>

                      <div className="my-1.5">
                        <p className="text-xs font-semibold text-zinc-900 truncate">
                          {t.sessionName}
                        </p>
                        <p className={`text-[11px] font-semibold mt-0.5 ${meta.textClass}`}>
                          {meta.label}
                        </p>
                      </div>

                      <p className="text-[11px] text-zinc-500 truncate">
                        {t.section} · {waiter?.name.split(' ')[0] || 'Staff'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Table Control Strip */}
            {selectedTable && (
              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        Route: Main Pass → {selectedTable.section} → Table {selectedTable.tableNumber}
                      </span>
                    </div>
                    <p className="text-base font-semibold text-zinc-900 mt-0.5">
                      Table {selectedTable.tableNumber} — {selectedTable.sessionName}
                    </p>
                    <p className="text-xs text-zinc-600">
                      Assigned Staff: <strong>{assignedCaptain?.name || 'Floor Team'}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onInspectGuestTable(branchId, selectedTable.tableNumber)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Open Guest View</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(
                    [
                      'available',
                      'occupied',
                      'serving',
                      'cleaning',
                      'attention',
                    ] as TableStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() =>
                        sendEvent({
                          type: 'table:status',
                          payload: {
                            branchId,
                            tableNumber: selectedTable.tableNumber,
                            status: st,
                          },
                        })
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selectedTable.status === st
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {STATUS_META[st].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Waiter Service Queue + Staff Roster */}
        <div className="lg:col-span-5 space-y-5">
          {/* Waiter Calls */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-semibold text-zinc-900">
                  Waiter Service Requests
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-zinc-500">
                {requests.filter((r) => r.status !== 'resolved').length} open
              </span>
            </div>

            {requests.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center">
                No pending table service calls.
              </p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      req.status === 'pending'
                        ? 'border-amber-300 bg-amber-50/70'
                        : req.status === 'accepted'
                        ? 'border-sky-200 bg-sky-50/50'
                        : 'border-zinc-200 bg-zinc-50 opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          Table {req.tableNumber} — {req.tableSessionName}
                        </p>
                        <p className="text-xs text-zinc-700 mt-0.5">
                          {req.reason} · Requested by {req.guestName}
                        </p>
                        <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-1">
                          <Navigation className="w-3 h-3" />
                          <span>
                            {req.section} · Assigned: {req.assignedStaffName}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs font-semibold capitalize text-zinc-800">
                        {req.status}
                      </span>
                    </div>

                    {req.status !== 'resolved' && (
                      <div className="flex items-center gap-2 pt-1">
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() =>
                              sendEvent({
                                type: 'waiter:update',
                                payload: { requestId: req.id, status: 'accepted' },
                              })
                            }
                            className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800"
                          >
                            Accept &amp; Route
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            sendEvent({
                              type: 'waiter:update',
                              payload: { requestId: req.id, status: 'resolved' },
                            })
                          }
                          className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-800 text-xs font-medium hover:bg-zinc-100 inline-flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Served</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Staff Monitoring */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-600" />
              <h2 className="text-base font-semibold text-zinc-900">Active Floor Staff</h2>
            </div>

            <div className="divide-y divide-zinc-100">
              {branchStaff.map((member) => {
                const openCount = requests.filter(
                  (r) => r.assignedStaffId === member.id && r.status !== 'resolved'
                ).length;
                return (
                  <div key={member.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-semibold text-zinc-900">{member.name}</p>
                      <p className="text-xs text-zinc-500">
                        {member.role} · {member.section}
                      </p>
                    </div>
                    <div className="text-right text-xs font-mono-tabular">
                      <p className="text-zinc-800">
                        Tables {member.assignedTables.join(', ')}
                      </p>
                      <p className={openCount > 0 ? 'text-amber-700 font-semibold' : 'text-zinc-400'}>
                        {openCount} open calls
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
