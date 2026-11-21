import React, { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import type { BranchId, ClientEvent, OrderStatus, RestaurantState } from '../shared/types';

interface KitchenDisplayProps {
  state: RestaurantState;
  branchId: BranchId;
  onBranchChange: (branchId: BranchId) => void;
  sendEvent: (event: ClientEvent) => void;
}

function formatTimer(createdAt: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - createdAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const NEXT_STATUS: Record<OrderStatus, { label: string; next: OrderStatus } | null> = {
  received: { label: 'Start Preparing', next: 'preparing' },
  preparing: { label: 'Mark Ready', next: 'ready' },
  ready: { label: 'Mark Served', next: 'served' },
  served: null,
};

export const KitchenDisplay: React.FC<KitchenDisplayProps> = ({
  state,
  branchId,
  onBranchChange,
  sendEvent,
}) => {
  const [statusFilter, setStatusFilter] = useState<'active' | OrderStatus>('active');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const branchOrders = useMemo(() => {
    return state.orders
      .filter((o) => o.branchId === branchId)
      .filter((o) => (statusFilter === 'active' ? o.status !== 'served' : o.status === statusFilter))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [state.orders, branchId, statusFilter]);

  const counts = useMemo(() => {
    const all = state.orders.filter((o) => o.branchId === branchId);
    return {
      active: all.filter((o) => o.status !== 'served').length,
      received: all.filter((o) => o.status === 'received').length,
      preparing: all.filter((o) => o.status === 'preparing').length,
      ready: all.filter((o) => o.status === 'ready').length,
      served: all.filter((o) => o.status === 'served').length,
    };
  }, [state.orders, branchId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* KDS Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <ChefHat className="w-4 h-4 text-amber-600" />
            <span>Kitchen Display System · {state.branches[branchId].name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Live Digital Tickets
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-200/70">
            {(['chandannagar', 'kolkata', 'serampore'] as BranchId[]).map((bId) => (
              <button
                key={bId}
                type="button"
                onClick={() => onBranchChange(bId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  branchId === bId
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {state.branches[bId].city}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="inline-flex items-center p-1 rounded-xl bg-zinc-200/70 overflow-x-auto">
            {(
              [
                { id: 'active', label: `Active (${counts.active})` },
                { id: 'received', label: `Received (${counts.received})` },
                { id: 'preparing', label: `Preparing (${counts.preparing})` },
                { id: 'ready', label: `Ready (${counts.ready})` },
                { id: 'served', label: `Served (${counts.served})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket Grid */}
      {branchOrders.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-zinc-200 bg-white space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-base font-semibold text-zinc-900">Kitchen Queue Clear</p>
          <p className="text-sm text-zinc-500">
            New guest orders from any table QR session will appear here immediately.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {branchOrders.map((order) => {
            const elapsedMs = now - order.createdAt;
            const isUrgent = order.status !== 'served' && elapsedMs > 8 * 60 * 1000;
            const action = NEXT_STATUS[order.status];

            const statusTextClass =
              order.status === 'received'
                ? 'text-sky-700'
                : order.status === 'preparing'
                ? 'text-amber-700'
                : order.status === 'ready'
                ? 'text-emerald-700'
                : 'text-zinc-500';

            return (
              <article
                key={order.id}
                className={`rounded-2xl bg-white border p-5 flex flex-col justify-between space-y-4 ${
                  isUrgent ? 'border-amber-500 ring-1 ring-amber-200' : 'border-zinc-200'
                }`}
              >
                <div className="space-y-4">
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-zinc-900 font-mono-tabular">
                          Order #{order.orderNumber}
                        </span>
                        {isUrgent && (
                          <span className="text-xs font-semibold text-amber-700">
                            Priority
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Table {order.tableNumber} · {order.tableSessionName}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 text-sm font-bold font-mono-tabular text-zinc-900">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{formatTimer(order.createdAt, now)}</span>
                      </div>
                      <p className={`text-xs font-semibold capitalize mt-0.5 ${statusTextClass}`}>
                        {order.status}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <ul className="divide-y divide-zinc-100">
                    {order.items.map((item) => (
                      <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-zinc-900">
                            <span className="font-mono-tabular text-amber-700 mr-2">
                              {item.quantity}×
                            </span>
                            {item.name}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.portionLabel}
                            {item.addons.length > 0 && ` · +${item.addons.map((a) => a.name).join(', ')}`}
                            {item.notes && ` · Note: ${item.notes}`}
                          </p>
                        </div>
                        <span className="text-xs text-zinc-500 shrink-0">{item.guestName}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Ticket Actions */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                  <span className="text-xs text-zinc-500 font-mono-tabular">
                    {order.items.reduce((s, i) => s + i.quantity, 0)} items
                  </span>
                  {action ? (
                    <button
                      type="button"
                      onClick={() =>
                        sendEvent({
                          type: 'order:advance',
                          payload: { orderId: order.id, status: action.next },
                        })
                      }
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                        action.next === 'ready'
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-zinc-900 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">Completed</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
