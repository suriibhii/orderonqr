import React, { useMemo, useState } from 'react';
import { Receipt, CreditCard, Star, CheckCircle2, Split, Heart } from 'lucide-react';
import type {
  ClientEvent,
  GuestMember,
  KitchenOrder,
  MenuItem,
  OfferRule,
  PaymentMethod,
  SplitMode,
  TableSession,
} from '../../shared/types';

interface SmartBillingPanelProps {
  table: TableSession;
  orders: KitchenOrder[];
  menu: MenuItem[];
  offers: OfferRule[];
  activeGuest: GuestMember;
  tipDistribution: { kitchenPct: number; servicePct: number };
  restaurantName: string;
  branchName: string;
  sendEvent: (event: ClientEvent) => void;
}

export const SmartBillingPanel: React.FC<SmartBillingPanelProps> = ({
  table,
  orders,
  menu,
  offers,
  activeGuest,
  tipDistribution,
  restaurantName,
  branchName,
  sendEvent,
}) => {
  const [splitMode, setSplitMode] = useState<SplitMode>('by_person');
  const [tipPct, setTipPct] = useState<number | 'custom'>(10);
  const [customTip, setCustomTip] = useState('100');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  // Review state
  const [overallRating, setOverallRating] = useState(5);
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [cleanRating, setCleanRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const allItems = useMemo(() => orders.flatMap((o) => o.items), [orders]);
  const subtotal = useMemo(
    () => allItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [allItems]
  );

  const appliedOffer = table.appliedOfferId
    ? offers.find((o) => o.id === table.appliedOfferId && o.active)
    : undefined;

  const discount = useMemo(() => {
    if (!appliedOffer || subtotal === 0) return 0;
    if (appliedOffer.discountType === 'flat') {
      return Math.min(subtotal, appliedOffer.value);
    }
    if (appliedOffer.discountType === 'percent') {
      const bevTotal = allItems
        .filter((i) => menu.find((m) => m.id === i.menuItemId)?.category === 'Beverages & Matcha')
        .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const basis = bevTotal > 0 ? bevTotal : subtotal;
      return Math.round((basis * appliedOffer.value) / 100);
    }
    return 0;
  }, [appliedOffer, subtotal, allItems, menu]);

  const afterDiscount = Math.max(0, subtotal - discount);
  const tax = Math.round(afterDiscount * 0.05);
  const tipAmount =
    tipPct === 'custom'
      ? Math.max(0, Number(customTip) || 0)
      : Math.round((afterDiscount * tipPct) / 100);
  const grandTotal = afterDiscount + tax + tipAmount;

  const guestBreakdowns = useMemo(() => {
    const map = new Map<string, { guestName: string; itemsTotal: number; itemCount: number }>();
    for (const g of table.guests) {
      map.set(g.id, { guestName: g.name, itemsTotal: 0, itemCount: 0 });
    }
    for (const item of allItems) {
      const existing = map.get(item.guestId) || {
        guestName: item.guestName,
        itemsTotal: 0,
        itemCount: 0,
      };
      existing.itemsTotal += item.unitPrice * item.quantity;
      existing.itemCount += item.quantity;
      map.set(item.guestId, existing);
    }
    return Array.from(map.entries()).map(([guestId, val]) => {
      const shareRatio = subtotal > 0 ? val.itemsTotal / subtotal : 0;
      const proportionalTotal = Math.round(grandTotal * shareRatio);
      return { guestId, ...val, proportionalTotal };
    });
  }, [table.guests, allItems, subtotal, grandTotal]);

  const equalShare =
    table.guests.length > 0 ? Math.round(grandTotal / table.guests.length) : grandTotal;

  const selectedItemsTotal = useMemo(() => {
    const pickedSubtotal = allItems
      .filter((i) => selectedItemIds.includes(i.id))
      .reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    if (subtotal === 0) return 0;
    return Math.round((pickedSubtotal / subtotal) * grandTotal);
  }, [allItems, selectedItemIds, subtotal, grandTotal]);

  const toggleItemSelect = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (table.lastReceipt) {
    const rcp = table.lastReceipt;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Digital Receipt */}
        <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-5">
          <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Payment Confirmed · {rcp.paymentMethod}</span>
              </div>
              <h3 className="text-xl font-bold text-zinc-900">Digital Receipt</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {restaurantName} · {branchName}
              </p>
            </div>
            <div className="text-right text-xs text-zinc-500 font-mono-tabular">
              <p>{rcp.receiptNumber}</p>
              <p>Table {rcp.tableNumber}</p>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 text-sm">
            {rcp.items.map((item) => (
              <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-zinc-900">
                    {item.name} ×{item.quantity}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2">({item.guestName})</span>
                </div>
                <span className="font-mono-tabular text-zinc-800">
                  ₹{item.unitPrice * item.quantity}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-200 space-y-1.5 text-sm">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal</span>
              <span className="font-mono-tabular">₹{rcp.subtotal}</span>
            </div>
            {rcp.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Offer Discount</span>
                <span className="font-mono-tabular">-₹{rcp.discount}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>GST (5%)</span>
              <span className="font-mono-tabular">₹{rcp.tax}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Staff Tip</span>
              <span className="font-mono-tabular">₹{rcp.tipAmount}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-zinc-900 pt-2 border-t border-zinc-100">
              <span>Total Paid</span>
              <span className="font-mono-tabular">₹{rcp.total}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
            <span>Loyalty points earned from this meal</span>
            <span className="font-bold font-mono-tabular">+{rcp.pointsEarned} pts</span>
          </div>
        </div>

        {/* Post-Meal Feedback & Review */}
        <div className="p-6 rounded-2xl bg-white border border-zinc-200 space-y-5">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">How was your experience?</h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              Share quick feedback for {branchName} and earn +10 loyalty points.
            </p>
          </div>

          {reviewSubmitted ? (
            <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <Heart className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                <span>Thank you, {activeGuest.name}! Your review is live on the Owner Dashboard.</span>
              </div>
              {overallRating >= 4 && (
                <p className="text-xs text-emerald-700">
                  Loved your visit? Your rating qualifies for a VIP returning guest voucher on your next scan.
                </p>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendEvent({
                  type: 'review:submit',
                  payload: {
                    branchId: table.branchId,
                    tableNumber: table.tableNumber,
                    guestId: activeGuest.id,
                    guestName: activeGuest.name,
                    overall: overallRating,
                    food: foodRating,
                    service: serviceRating,
                    cleanliness: cleanRating,
                    comment: comment.trim() || 'Great dining experience!',
                  },
                });
                setReviewSubmitted(true);
              }}
              className="space-y-4"
            >
              {[
                { label: 'Overall Experience', value: overallRating, set: setOverallRating },
                { label: 'Food Quality', value: foodRating, set: setFoodRating },
                { label: 'Table Service', value: serviceRating, set: setServiceRating },
                { label: 'Cleanliness', value: cleanRating, set: setCleanRating },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-800">{row.label}</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => row.set(star)}
                        className="p-1.5 rounded hover:bg-zinc-100"
                        aria-label={`Rate ${row.label} ${star} stars`}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            star <= row.value
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-zinc-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <label htmlFor="review-comment" className="block text-sm font-medium text-zinc-800 mb-1.5">
                  Short Feedback
                </label>
                <textarea
                  id="review-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell the chef or floor captain what stood out..."
                  className="w-full p-3 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <button
                type="submit"
                className="w-full min-h-[46px] rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors"
              >
                Submit Review (+10 pts)
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (allItems.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-zinc-200 text-center space-y-2">
        <Receipt className="w-8 h-8 text-zinc-400 mx-auto" />
        <h3 className="text-base font-semibold text-zinc-900">No Active Orders Yet</h3>
        <p className="text-sm text-zinc-500 max-w-md mx-auto">
          Once your table sends items to the kitchen, your itemized smart bill and 4-way split options will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Split Selector & Itemized Ownership */}
      <div className="lg:col-span-7 space-y-5">
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Split className="w-4 h-4 text-amber-600" />
              <h3 className="text-base font-semibold text-zinc-900">Smart Bill Splitting</h3>
            </div>
            {!table.billRequested ? (
              <button
                type="button"
                onClick={() =>
                  sendEvent({
                    type: 'bill:request',
                    payload: { branchId: table.branchId, tableNumber: table.tableNumber },
                  })
                }
                className="px-3.5 py-1.5 rounded-lg border border-zinc-300 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap"
              >
                Notify Staff: Request Bill
              </button>
            ) : (
              <span className="text-xs font-medium text-amber-700">Bill Requested</span>
            )}
          </div>

          {/* 4 Split Modes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { id: 'equal', label: 'Equal Split' },
                { id: 'by_person', label: 'By Person' },
                { id: 'by_item', label: 'By Item' },
                { id: 'custom', label: 'Custom' },
              ] as { id: SplitMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSplitMode(m.id)}
                className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap ${
                  splitMode === m.id
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Split Details */}
          {splitMode === 'equal' && (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Split evenly across {Math.max(1, table.guests.length)} guests
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono-tabular">
                  ₹{grandTotal} ÷ {Math.max(1, table.guests.length)}
                </p>
              </div>
              <span className="text-xl font-bold text-zinc-900 font-mono-tabular">
                ₹{equalShare} each
              </span>
            </div>
          )}

          {splitMode === 'by_person' && (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl">
              {guestBreakdowns.map((gb) => (
                <div key={gb.guestId} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-zinc-900">{gb.guestName}</p>
                    <p className="text-xs text-zinc-500 font-mono-tabular">
                      {gb.itemCount} items · Base ₹{gb.itemsTotal}
                    </p>
                  </div>
                  <span className="font-semibold text-zinc-900 font-mono-tabular">
                    ₹{gb.proportionalTotal}
                  </span>
                </div>
              ))}
            </div>
          )}

          {splitMode === 'by_item' && (
            <div className="space-y-3">
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl">
                {allItems.map((item) => {
                  const checked = selectedItemIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className="px-4 py-2.5 flex items-center justify-between text-sm cursor-pointer hover:bg-zinc-50"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItemSelect(item.id)}
                          className="w-4 h-4 accent-zinc-900"
                        />
                        <div>
                          <span className="font-medium text-zinc-900">
                            {item.name} ×{item.quantity}
                          </span>
                          <span className="text-xs text-zinc-500 ml-2">({item.guestName})</span>
                        </div>
                      </div>
                      <span className="font-mono-tabular text-zinc-700">
                        ₹{item.unitPrice * item.quantity}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm">
                <span className="font-medium text-zinc-700">Your selected share (incl. tax &amp; tip)</span>
                <span className="text-base font-bold text-zinc-900 font-mono-tabular">
                  ₹{selectedItemsTotal}
                </span>
              </div>
            </div>
          )}

          {splitMode === 'custom' && (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl">
              {table.guests.map((g) => (
                <div key={g.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-zinc-900">{g.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-zinc-500">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={customAmounts[g.id] ?? String(equalShare)}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({ ...prev, [g.id]: e.target.value }))
                      }
                      className="w-24 h-9 px-2.5 rounded-lg border border-zinc-300 text-sm text-right font-mono-tabular"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Tip, Summary & Digital Payment */}
      <div className="lg:col-span-5 space-y-5">
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 space-y-5">
          {/* Tip Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-900">Add Staff Tip</span>
              <span className="text-xs text-zinc-500">
                {tipDistribution.kitchenPct}% Kitchen · {tipDistribution.servicePct}% Service
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([5, 10, 15, 'custom'] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setTipPct(pct)}
                  className={`min-h-[40px] rounded-xl border text-xs font-semibold font-mono-tabular transition-colors ${
                    tipPct === pct
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  {pct === 'custom' ? 'Custom' : `${pct}%`}
                </button>
              ))}
            </div>
            {tipPct === 'custom' && (
              <input
                type="number"
                min={0}
                value={customTip}
                onChange={(e) => setCustomTip(e.target.value)}
                placeholder="Enter tip amount in ₹"
                className="w-full h-10 px-3 rounded-xl border border-zinc-300 text-sm font-mono-tabular"
              />
            )}
          </div>

          {/* Bill Breakdown */}
          <div className="space-y-2 text-sm border-t border-zinc-100 pt-4">
            <div className="flex justify-between text-zinc-600">
              <span>Items Subtotal</span>
              <span className="font-mono-tabular">₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Offer ({appliedOffer?.code})</span>
                <span className="font-mono-tabular">-₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Taxes (5% GST)</span>
              <span className="font-mono-tabular">₹{tax}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Tip</span>
              <span className="font-mono-tabular">₹{tipAmount}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-zinc-900 pt-2 border-t border-zinc-200">
              <span>Total Payable</span>
              <span className="font-mono-tabular">₹{grandTotal}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2.5 border-t border-zinc-100 pt-4">
            <span className="text-sm font-semibold text-zinc-900 block">Payment Method</span>
            <div className="grid grid-cols-2 gap-2">
              {(['UPI', 'Card', 'Bank Transfer', 'Cash Confirmation'] as PaymentMethod[]).map(
                (pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentMethod(pm)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                      paymentMethod === pm
                        ? 'border-amber-600 bg-amber-50 text-amber-950 font-semibold'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {pm}
                  </button>
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              sendEvent({
                type: 'bill:pay',
                payload: {
                  branchId: table.branchId,
                  tableNumber: table.tableNumber,
                  splitMode,
                  tipAmount,
                  paymentMethod,
                  guestId: activeGuest.id,
                },
              })
            }
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>Complete Payment · ₹{grandTotal}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
