import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  PackageCheck,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import type { BranchId, ClientEvent, RestaurantState } from '../shared/types';

interface OwnerDashboardProps {
  state: RestaurantState;
  branchId: BranchId;
  onBranchChange: (branchId: BranchId) => void;
  sendEvent: (event: ClientEvent) => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({
  state,
  branchId,
  onBranchChange,
  sendEvent,
}) => {
  const branch = state.branches[branchId];
  const [editingPairingDishId, setEditingPairingDishId] = useState<string>('prawn-tempura-roll');

  const branchTables = useMemo(
    () => Object.values(state.tables).filter((t) => t.branchId === branchId),
    [state.tables, branchId]
  );

  const activeTablesCount = branchTables.filter((t) => t.status !== 'available' && t.status !== 'cleaning').length;
  const pendingOrdersCount = state.orders.filter(
    (o) => o.branchId === branchId && o.status !== 'served'
  ).length;
  const aov = branch.todayOrders > 0 ? Math.round(branch.todaySales / branch.todayOrders) : 0;

  const branchInventory = state.inventory.filter((i) => i.branchId === branchId);
  const displayInventory =
    branchInventory.length > 0
      ? branchInventory
      : state.inventory.filter((i) => i.branchId === 'chandannagar');

  const branchReviews = state.reviews.filter((r) => r.branchId === branchId);
  const selectedPairingDish =
    state.menu.find((m) => m.id === editingPairingDishId) || state.menu[0];

  const togglePairing = (targetId: string) => {
    if (!selectedPairingDish) return;
    const current = selectedPairingDish.recommendedIds;
    const next = current.includes(targetId)
      ? current.filter((x) => x !== targetId)
      : [...current, targetId];
    sendEvent({
      type: 'admin:update_pairings',
      payload: { menuItemId: selectedPairingDish.id, recommendedIds: next },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Multi-Branch Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>{state.restaurantName} · Multi-Branch Management</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-0.5">
            {branch.name}
          </h1>
          <p className="text-xs text-zinc-500">{branch.address}</p>
        </div>

        <div className="inline-flex items-center p-1 rounded-xl bg-zinc-200/70 self-start">
          {(['chandannagar', 'kolkata', 'serampore'] as BranchId[]).map((bId) => (
            <button
              key={bId}
              type="button"
              onClick={() => onBranchChange(bId)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                branchId === bId
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {state.branches[bId].city}
            </button>
          ))}
        </div>
      </div>

      {/* 7 KPI Cards Strip */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: "Today's Sales", value: `₹${branch.todaySales.toLocaleString()}` },
          { label: 'Orders', value: String(branch.todayOrders) },
          { label: 'Avg Order Value', value: `₹${aov}` },
          { label: 'Active Tables', value: `${activeTablesCount}/${branchTables.length}` },
          { label: 'Pending Orders', value: String(pendingOrdersCount) },
          { label: 'Avg Prep Time', value: `${branch.avgPrepMinutes} min` },
          { label: 'Customer Rating', value: `${branch.rating} ★` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1"
          >
            <p className="text-xs text-zinc-500 truncate">{kpi.label}</p>
            <p className="text-xl font-bold text-zinc-900 font-mono-tabular">{kpi.value}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inventory Alerts (Left 6 cols) */}
        <section className="lg:col-span-6 p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">
                Real-Time Inventory &amp; Stock Alerts
              </h2>
              <p className="text-xs text-zinc-500">
                Automatically deducted when kitchen orders are placed
              </p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100">
            {displayInventory.map((inv) => {
              const isLow = inv.remainingPct <= inv.reorderThresholdPct;
              return (
                <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 truncate">
                        {inv.name}
                      </span>
                      {isLow && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Low Stock</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[180px] h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isLow ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${inv.remainingPct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-600 font-mono-tabular">
                        {inv.remainingPct}% ({inv.remainingQty} {inv.unit})
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'admin:restock_inventory',
                        payload: { inventoryId: inv.id },
                      })
                    }
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Restock</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Offers & Smart Recommendations Configurator (Right 6 cols) */}
        <section className="lg:col-span-6 space-y-6">
          {/* Digital Offers */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-600" />
              <h2 className="text-base font-semibold text-zinc-900">
                Active Digital Offers
              </h2>
            </div>

            <div className="divide-y divide-zinc-100">
              {state.offers.map((offer) => (
                <div key={offer.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900">
                      {offer.title}{' '}
                      <span className="text-xs font-mono-tabular text-zinc-500 ml-1">
                        ({offer.code})
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{offer.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'admin:toggle_offer',
                        payload: { offerId: offer.id },
                      })
                    }
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                      offer.active
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-300'
                    }`}
                  >
                    {offer.active ? 'Active' : 'Paused'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Configurable Smart Recommendations */}
          <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h2 className="text-base font-semibold text-zinc-900">
                  Smart Pairing Rules
                </h2>
              </div>

              <select
                value={editingPairingDishId}
                onChange={(e) => setEditingPairingDishId(e.target.value)}
                aria-label="Select dish to configure pairings"
                className="h-9 px-2.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-800 bg-zinc-50"
              >
                {state.menu.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-zinc-500">
              Select dishes suggested under &ldquo;Pairs well with&rdquo; when guests open{' '}
              <strong>{selectedPairingDish?.name}</strong>:
            </p>

            <div className="flex flex-wrap gap-2">
              {state.menu
                .filter((m) => m.id !== selectedPairingDish?.id)
                .map((candidate) => {
                  const active = selectedPairingDish?.recommendedIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => togglePairing(candidate.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-amber-50 border-amber-600 text-amber-950 font-semibold'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400'
                      }`}
                    >
                      {candidate.name}
                    </button>
                  );
                })}
            </div>
          </div>
        </section>
      </div>

      {/* Guest Feedback & Reviews */}
      <section className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900">
            Recent Guest Reviews — {branch.city}
          </h2>
          <span className="text-xs text-zinc-500 font-mono-tabular">
            {branchReviews.length} reviews
          </span>
        </div>

        {branchReviews.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">
            No reviews submitted at this branch yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branchReviews.map((rev) => (
              <div key={rev.id} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">
                      {rev.guestName} · Table {rev.tableNumber} ({rev.tableSessionName})
                    </p>
                    <p className="text-xs text-zinc-500 font-mono-tabular">
                      Food {rev.food}/5 · Service {rev.service}/5 · Cleanliness {rev.cleanliness}/5
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm font-bold text-zinc-900 font-mono-tabular">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>{rev.overall}.0</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-700 leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
