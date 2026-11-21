import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Clock,
  Edit3,
  Gamepad2,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShoppingBag,
  Star,
  Tag,
  Utensils,
  X,
} from 'lucide-react';
import type {
  ClientEvent,
  GuestMember,
  MenuItem,
  RestaurantState,
  TableSession,
  WaiterReason,
} from '../shared/types';
import { DishModal } from './guest/DishModal';
import { TableGamesPanel } from './guest/TableGamesPanel';
import { SmartBillingPanel } from './guest/SmartBillingPanel';

interface GuestExperienceProps {
  state: RestaurantState;
  table: TableSession;
  activeGuestName: string;
  onSelectGuestName: (name: string) => void;
  onOpenQrModal: () => void;
  sendEvent: (event: ClientEvent) => void;
}

type GuestTab = 'menu' | 'tracker' | 'games' | 'bill';

const WAITER_REASONS: WaiterReason[] = [
  'Need water',
  'Need cutlery',
  'Need assistance',
  'Need another order',
  'Need bill',
  'General help',
];

function formatElapsed(createdAt: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - createdAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const GuestExperience: React.FC<GuestExperienceProps> = ({
  state,
  table,
  activeGuestName,
  onSelectGuestName,
  onOpenQrModal,
  sendEvent,
}) => {
  const [activeTab, setActiveTab] = useState<GuestTab>('menu');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftSessionName, setDraftSessionName] = useState(table.sessionName);
  const [showCallWaiterModal, setShowCallWaiterModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeGuest: GuestMember = useMemo(() => {
    const found = table.guests.find(
      (g) => g.name.toLowerCase() === activeGuestName.toLowerCase()
    );
    return (
      found ||
      table.guests[0] || {
        id: 'guest-temp',
        name: activeGuestName || 'Guest',
        avatarColor: '#D97706',
        initials: (activeGuestName || 'G').slice(0, 2).toUpperCase(),
        loyaltyPoints: 250,
        joinedAt: Date.now(),
      }
    );
  }, [table.guests, activeGuestName]);

  const branch = state.branches[table.branchId];
  const tableOrders = useMemo(
    () =>
      state.orders
        .filter((o) => o.branchId === table.branchId && o.tableNumber === table.tableNumber)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.orders, table.branchId, table.tableNumber]
  );

  const tableRequests = useMemo(
    () =>
      state.waiterRequests.filter(
        (r) =>
          r.branchId === table.branchId &&
          r.tableNumber === table.tableNumber &&
          r.status !== 'resolved'
      ),
    [state.waiterRequests, table.branchId, table.tableNumber]
  );

  const assignedStaff = state.staff.find((s) => s.id === table.assignedWaiterId);

  const categories = [
    'All',
    'Sushi & Rolls',
    'Dim Sums & Gyoza',
    'Ramen & Mains',
    'Beverages & Matcha',
    'Desserts',
  ];
  const filteredMenu = useMemo(() => {
    return state.menu.filter((item) => {
      const catOk = categoryFilter === 'All' || item.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const searchOk =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.ingredients.some((ing) => ing.toLowerCase().includes(q));
      return catOk && searchOk;
    });
  }, [state.menu, categoryFilter, searchQuery]);

  // Cart grouping by guest
  const cartByGuest = useMemo(() => {
    const groups = new Map<string, { guestName: string; items: typeof table.cart }>();
    for (const item of table.cart) {
      const g = groups.get(item.guestId) || { guestName: item.guestName, items: [] };
      g.items.push(item);
      groups.set(item.guestId, g);
    }
    return Array.from(groups.values());
  }, [table.cart]);

  const cartItemCount = table.cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = table.cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  const activeOffers = state.offers.filter((o) => o.active);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftSessionName.trim()) {
      sendEvent({
        type: 'table:rename',
        payload: {
          branchId: table.branchId,
          tableNumber: table.tableNumber,
          sessionName: draftSessionName.trim(),
        },
      });
    }
    setEditingName(false);
  };

  const renderCartContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            Shared Table Cart
          </h3>
          <p className="text-xs text-zinc-500 font-mono-tabular">
            {table.guests.length} Guests · {cartItemCount} Items · ₹{cartTotal}
          </p>
        </div>
        {cartItemCount > 0 && (
          <span className="text-xs font-medium text-amber-700">Synced Live</span>
        )}
      </div>

      {/* Offer Picker */}
      {activeOffers.length > 0 && (
        <div className="py-3 border-b border-zinc-100">
          <label htmlFor="cart-offer-select" className="block text-xs font-medium text-zinc-500 mb-1">
            Apply Table Offer
          </label>
          <select
            id="cart-offer-select"
            value={table.appliedOfferId || ''}
            onChange={(e) =>
              sendEvent({
                type: 'cart:apply_offer',
                payload: {
                  branchId: table.branchId,
                  tableNumber: table.tableNumber,
                  offerId: e.target.value || null,
                },
              })
            }
            className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-800"
          >
            <option value="">No offer selected</option>
            {activeOffers.map((off) => (
              <option key={off.id} value={off.id}>
                {off.title} ({off.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Items grouped by guest */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {cartByGuest.length === 0 ? (
          <div className="py-8 text-center space-y-1">
            <ShoppingBag className="w-6 h-6 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-600">Table cart is empty</p>
            <p className="text-xs text-zinc-400">
              Select dishes as {activeGuest.name} or switch guest above.
            </p>
          </div>
        ) : (
          cartByGuest.map((group) => (
            <div key={group.guestName} className="space-y-2">
              <p className="text-xs font-semibold text-zinc-500">{group.guestName}</p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 text-sm bg-zinc-50 p-2.5 rounded-xl border border-zinc-100"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                      <p className="text-xs text-zinc-500">
                        {item.portionLabel}
                        {item.addons.length > 0 && ` · +${item.addons.map((a) => a.name).join(', ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-zinc-200 bg-white rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            sendEvent({
                              type: 'cart:update_qty',
                              payload: {
                                branchId: table.branchId,
                                tableNumber: table.tableNumber,
                                cartItemId: item.id,
                                delta: -1,
                              },
                            })
                          }
                          className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-semibold font-mono-tabular">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            sendEvent({
                              type: 'cart:update_qty',
                              payload: {
                                branchId: table.branchId,
                                tableNumber: table.tableNumber,
                                cartItemId: item.id,
                                delta: 1,
                              },
                            })
                          }
                          className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:bg-zinc-100"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-semibold font-mono-tabular text-zinc-900 w-12 text-right">
                        ₹{item.unitPrice * item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Send Order CTA */}
      <div className="pt-3 border-t border-zinc-200 space-y-2">
        <button
          type="button"
          disabled={cartItemCount === 0}
          onClick={() => {
            sendEvent({
              type: 'order:submit',
              payload: {
                branchId: table.branchId,
                tableNumber: table.tableNumber,
              },
            });
            setShowMobileCart(false);
            setActiveTab('tracker');
          }}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-500 transition-colors flex items-center justify-between"
        >
          <span>Send Order to Kitchen</span>
          <span className="font-mono-tabular">₹{cartTotal}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-10 space-y-6">
      {/* Table Identity Space Banner */}
      <section className="p-5 rounded-2xl bg-white border border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>{branch.name} · Where Bengal Meets Japan</span>
            <span aria-hidden="true">·</span>
            <span>Table {table.tableNumber}</span>
            <span aria-hidden="true">·</span>
            <span>{table.section}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize font-medium text-amber-700">{table.status}</span>
          </div>

          <div className="flex items-center gap-2.5">
            {editingName ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftSessionName}
                  onChange={(e) => setDraftSessionName(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-zinc-300 text-base font-bold text-zinc-900"
                  autoFocus
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium"
                >
                  Save
                </button>
              </form>
            ) : (
              <>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                  {table.sessionName}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setDraftSessionName(table.sessionName);
                    setEditingName(true);
                  }}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                  aria-label="Rename table session"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Guest Avatars (Click to switch active guest at this table) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-zinc-500 mr-1">Ordering as:</span>
            {table.guests.map((g) => {
              const isMe = g.id === activeGuest.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGuestName(g.name)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                    isMe
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                    style={{ backgroundColor: g.avatarColor }}
                  >
                    {g.initials}
                  </span>
                  <span>{g.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onOpenQrModal}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-600 hover:border-zinc-500 hover:text-zinc-900"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Join / Switch Table</span>
            </button>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowCallWaiterModal(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-amber-600 bg-amber-50 text-amber-950 text-sm font-semibold hover:bg-amber-100 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Bell className="w-4 h-4 text-amber-700" />
            <span>Call Waiter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bill')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Receipt className="w-4 h-4" />
            <span>Smart Bill</span>
          </button>
        </div>
      </section>

      {/* Desktop Sub-navigation Tabs */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-zinc-200/70 rounded-xl">
          {(
            [
              { id: 'menu', label: 'Explore Menu', icon: Utensils },
              { id: 'tracker', label: `Order Tracker (${tableOrders.length})`, icon: Clock },
              { id: 'games', label: 'Table Games & Rewards', icon: Gamepad2 },
              { id: 'bill', label: 'Split Bill & Pay', icon: Receipt },
            ] as { id: GuestTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-zinc-500 font-mono-tabular">
          {activeGuest.name}&apos;s Points: <strong className="text-zinc-900">{activeGuest.loyaltyPoints} pts</strong>
        </div>
      </div>

      {/* TAB 1: MENU & SHARED CART */}
      {activeTab === 'menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-5">
            {/* Digital Offers Strip */}
            {activeOffers.length > 0 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {activeOffers.map((offer) => {
                  const isApplied = table.appliedOfferId === offer.id;
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() =>
                        sendEvent({
                          type: 'cart:apply_offer',
                          payload: {
                            branchId: table.branchId,
                            tableNumber: table.tableNumber,
                            offerId: isApplied ? null : offer.id,
                          },
                        })
                      }
                      className={`shrink-0 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                        isApplied
                          ? 'border-amber-600 bg-amber-50'
                          : 'border-zinc-200 bg-white hover:border-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
                        <Tag className="w-3 h-3" />
                        <span>{offer.tag}</span>
                        {isApplied && <span className="text-emerald-700 ml-1">· Applied</span>}
                      </div>
                      <p className="text-xs font-medium text-zinc-900 mt-0.5">{offer.description}</p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Search + Category Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dishes, ingredients..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      categoryFilter === cat
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Dish Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredMenu.map((dish) => {
                const imgBroken = failedImages[dish.id];
                return (
                  <article
                    key={dish.id}
                    className="bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:border-zinc-300 transition-colors flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDish(dish)}
                      className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 flex-1 flex flex-col"
                    >
                      <div className="relative aspect-[4/3] w-full bg-zinc-100 overflow-hidden">
                        {!imgBroken ? (
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            referrerPolicy="no-referrer"
                            onError={() => setFailedImages((p) => ({ ...p, [dish.id]: true }))}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-500">
                            <Utensils className="w-7 h-7 mb-1.5" />
                            <span className="text-xs font-medium">{dish.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>{dish.category}</span>
                            {dish.highlight && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-amber-700">{dish.highlight}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 text-zinc-700 font-medium">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              {dish.rating}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-semibold text-zinc-900 leading-snug">
                              {dish.name}
                            </h3>
                            <span className="text-base font-bold text-zinc-900 font-mono-tabular shrink-0">
                              ₹{dish.price}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                            {dish.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            {dish.spiceLevel} Spice · {dish.prepMinutes} min
                          </span>
                          <span className="font-semibold text-zinc-900">Customize &amp; Add</span>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Desktop Sticky Shared Table Cart */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-20 bg-white rounded-2xl border border-zinc-200 p-5 h-[calc(100vh-7rem)]">
            {renderCartContent()}
          </aside>
        </div>
      )}

      {/* TAB 2: LIVE ORDER TRACKER & WAITER REQUESTS */}
      {activeTab === 'tracker' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Live Kitchen Order Status</h2>
            {tableOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white border border-zinc-200 text-center space-y-3">
                <Clock className="w-7 h-7 text-zinc-400 mx-auto" />
                <p className="text-sm text-zinc-600">
                  No orders sent to the kitchen yet for {table.sessionName}.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('menu')}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-medium"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              tableOrders.map((order) => {
                const steps = ['received', 'preparing', 'ready', 'served'] as const;
                const currentIdx = steps.indexOf(order.status);
                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500 font-mono-tabular">
                          Order #{order.orderNumber} · {formatElapsed(order.createdAt, now)} elapsed
                        </p>
                        <h3 className="text-base font-semibold text-zinc-900 mt-0.5 capitalize">
                          {order.status === 'received' && 'Order Received by Kitchen'}
                          {order.status === 'preparing' && 'Your Food Is Cooking'}
                          {order.status === 'ready' && 'Fresh & Ready for Pickup'}
                          {order.status === 'served' && 'Served at Your Table'}
                        </h3>
                      </div>
                      <span className="text-sm font-bold font-mono-tabular text-zinc-900">
                        ₹{order.subtotal}
                      </span>
                    </div>

                    {/* 4-Step Progress Bar */}
                    <div className="grid grid-cols-4 gap-2">
                      {steps.map((step, idx) => {
                        const done = idx <= currentIdx;
                        return (
                          <div key={step} className="space-y-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                done ? 'bg-amber-600' : 'bg-zinc-200'
                              }`}
                            />
                            <p
                              className={`text-xs capitalize flex items-center gap-1 ${
                                done ? 'font-semibold text-zinc-900' : 'text-zinc-400'
                              }`}
                            >
                              {done && <Check className="w-3 h-3 text-amber-600" />}
                              <span>{step === 'preparing' ? 'Cooking' : step}</span>
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Items in Order */}
                    <div className="pt-3 border-t border-zinc-100 divide-y divide-zinc-100 text-sm">
                      {order.items.map((item) => (
                        <div key={item.id} className="py-1.5 flex items-center justify-between">
                          <span>
                            {item.name} ×{item.quantity}
                            <span className="text-xs text-zinc-500 ml-2">({item.guestName})</span>
                          </span>
                          <span className="font-mono-tabular text-zinc-700">
                            ₹{item.unitPrice * item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Waiter Assistance Status & Quick Call */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900">Waiter Assistance</h2>
            <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
              <div className="text-sm text-zinc-600">
                Assigned Captain:{' '}
                <strong className="text-zinc-900">{assignedStaff?.name || 'Rahul Sen'}</strong> ·{' '}
                <span>{table.section}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {WAITER_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() =>
                      sendEvent({
                        type: 'waiter:call',
                        payload: {
                          branchId: table.branchId,
                          tableNumber: table.tableNumber,
                          guestName: activeGuest.name,
                          reason,
                        },
                      })
                    }
                    className="min-h-[44px] px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-amber-600 hover:bg-amber-50 text-xs font-medium text-zinc-800 text-left transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>

              {tableRequests.length > 0 && (
                <div className="pt-3 border-t border-zinc-100 space-y-2">
                  <p className="text-xs font-semibold text-zinc-500">Active Requests</p>
                  {tableRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-amber-950">{req.reason}</p>
                        <p className="text-amber-800">
                          Requested by {req.guestName} · Assigned to {req.assignedStaffName}
                        </p>
                      </div>
                      <span className="capitalize font-semibold text-amber-900">{req.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TABLE GAMES & REWARDS */}
      {activeTab === 'games' && (
        <TableGamesPanel
          table={table}
          activeGuest={activeGuest}
          triviaBank={state.triviaBank}
          sendEvent={sendEvent}
        />
      )}

      {/* TAB 4: SMART BILLING, SPLIT & PAYMENT */}
      {activeTab === 'bill' && (
        <SmartBillingPanel
          table={table}
          orders={tableOrders}
          menu={state.menu}
          offers={state.offers}
          activeGuest={activeGuest}
          tipDistribution={state.tipDistribution}
          restaurantName={state.restaurantName}
          branchName={branch.name}
          sendEvent={sendEvent}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Strictly <= 64px height to respect 15% sticky cap) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 backdrop-blur-md border-t border-zinc-200 grid grid-cols-4 items-center px-2"
        aria-label="Guest workspace tabs"
      >
        {(
          [
            { id: 'menu', label: 'Menu', icon: Utensils },
            { id: 'tracker', label: 'Track', icon: Clock },
            { id: 'games', label: 'Games', icon: Gamepad2 },
            { id: 'bill', label: 'Bill', icon: Receipt },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-amber-700' : 'text-zinc-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Floating Cart Trigger (only when items in cart on mobile menu tab) */}
      {activeTab === 'menu' && cartItemCount > 0 && !showMobileCart && (
        <button
          type="button"
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-20 right-4 z-40 min-h-[44px] px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-semibold shadow-lg flex items-center gap-2"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="font-mono-tabular">
            {cartItemCount} items · ₹{cartTotal}
          </span>
        </button>
      )}

      {/* Mobile Cart Sheet */}
      {showMobileCart && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
          <div className="w-full max-h-[82vh] bg-white rounded-t-3xl p-5 flex flex-col">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowMobileCart(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-zinc-500"
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderCartContent()}</div>
          </div>
        </div>
      )}

      {/* Dish Customization Modal */}
      {selectedDish && (
        <DishModal
          dish={selectedDish}
          allMenu={state.menu}
          activeGuest={activeGuest}
          onClose={() => setSelectedDish(null)}
          onAddToCart={(payload) =>
            sendEvent({
              type: 'cart:add',
              payload: {
                branchId: table.branchId,
                tableNumber: table.tableNumber,
                item: {
                  ...payload,
                  guestId: activeGuest.id,
                  guestName: activeGuest.name,
                },
              },
            })
          }
          onQuickAddRecommended={(rec) =>
            sendEvent({
              type: 'cart:add',
              payload: {
                branchId: table.branchId,
                tableNumber: table.tableNumber,
                item: {
                  menuItemId: rec.id,
                  name: rec.name,
                  guestId: activeGuest.id,
                  guestName: activeGuest.name,
                  portionLabel: rec.portions?.[0]?.label || 'Regular',
                  addons: [],
                  unitPrice: rec.price,
                  quantity: 1,
                },
              },
            })
          }
        />
      )}

      {/* Call Waiter Modal */}
      {showCallWaiterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">
                Call Waiter — Table {table.tableNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowCallWaiterModal(false)}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Select a reason and {assignedStaff?.name || 'your floor captain'} will be notified immediately.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WAITER_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    sendEvent({
                      type: 'waiter:call',
                      payload: {
                        branchId: table.branchId,
                        tableNumber: table.tableNumber,
                        guestName: activeGuest.name,
                        reason,
                      },
                    });
                    setShowCallWaiterModal(false);
                    setActiveTab('tracker');
                  }}
                  className="min-h-[44px] px-3 py-2 rounded-xl border border-zinc-200 hover:border-amber-600 hover:bg-amber-50 text-sm font-medium text-zinc-800 text-left transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
