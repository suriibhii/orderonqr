import React, { useState } from 'react';
import { X, Plus, Minus, Utensils, Star, AlertCircle } from 'lucide-react';
import type { DishAddon, GuestMember, MenuItem } from '../../shared/types';

interface DishModalProps {
  dish: MenuItem | null;
  allMenu: MenuItem[];
  activeGuest: GuestMember;
  onClose: () => void;
  onAddToCart: (payload: {
    menuItemId: string;
    name: string;
    portionLabel: string;
    addons: DishAddon[];
    unitPrice: number;
    quantity: number;
    notes?: string;
  }) => void;
  onQuickAddRecommended: (item: MenuItem) => void;
}

export const DishModal: React.FC<DishModalProps> = ({
  dish,
  allMenu,
  activeGuest,
  onClose,
  onAddToCart,
  onQuickAddRecommended,
}) => {
  const [selectedPortionIdx, setSelectedPortionIdx] = useState(
    dish?.portions ? Math.max(0, dish.portions.findIndex((p) => p.priceDelta === 0)) : 0
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  if (!dish) return null;

  const portions = dish.portions && dish.portions.length > 0 ? dish.portions : [{ label: 'Regular', priceDelta: 0 }];
  const activePortion = portions[selectedPortionIdx] || portions[0];
  const selectedAddons = dish.addons.filter((a) => selectedAddonIds.includes(a.id));
  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const unitPrice = Math.max(0, dish.price + activePortion.priceDelta + addonsTotal);
  const lineTotal = unitPrice * quantity;

  const recommendedDishes = dish.recommendedIds
    .map((id) => allMenu.find((m) => m.id === id))
    .filter((m): m is MenuItem => Boolean(m));

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    onAddToCart({
      menuItemId: dish.id,
      name: dish.name,
      portionLabel: activePortion.label,
      addons: selectedAddons,
      unitPrice,
      quantity,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dish-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Dish Header Photo */}
        <div className="relative h-56 sm:h-64 bg-zinc-100 shrink-0">
          {!imgFailed ? (
            <img
              src={dish.imageUrl}
              alt={dish.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-500">
              <Utensils className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">{dish.name}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Close dish details"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-5 right-5 text-white">
            <div className="flex items-center gap-2 text-xs text-zinc-200 mb-1">
              <span>{dish.isVeg ? 'Vegetarian' : 'Non-Veg'}</span>
              <span aria-hidden="true">·</span>
              <span>{dish.spiceLevel} Spice</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {dish.rating} ({dish.reviewCount})
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{dish.prepMinutes} min</span>
            </div>
            <h2 id="dish-modal-title" className="text-xl sm:text-2xl font-bold tracking-tight">
              {dish.name}
            </h2>
          </div>
        </div>

        {/* Scrollable Details */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-2">
            <p className="text-sm text-zinc-700 leading-relaxed">{dish.description}</p>
            <p className="text-xs text-zinc-500">
              Ingredients: {dish.ingredients.join(', ')}
            </p>
            {dish.allergens.length > 0 && (
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Contains allergens: {dish.allergens.join(', ')}</span>
              </p>
            )}
          </div>

          {/* Portion Options */}
          {portions.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900">Portion Size</span>
                <span className="text-xs text-zinc-500">Required</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {portions.map((p, idx) => {
                  const pPrice = dish.price + p.priceDelta;
                  const active = idx === selectedPortionIdx;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedPortionIdx(idx)}
                      className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                        active
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="text-sm font-mono-tabular">₹{pPrice}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {dish.addons.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-900">Customize Add-ons</span>
                <span className="text-xs text-zinc-500">Optional</span>
              </div>
              <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
                {dish.addons.map((addon) => {
                  const checked = selectedAddonIds.includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      className="min-h-[46px] px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAddon(addon.id)}
                          className="w-4 h-4 accent-zinc-900 rounded"
                        />
                        <span className="text-sm text-zinc-800">{addon.name}</span>
                      </div>
                      <span className="text-sm text-zinc-600 font-mono-tabular">+₹{addon.price}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Pairings */}
          {recommendedDishes.length > 0 && (
            <div className="space-y-2.5">
              <span className="text-sm font-semibold text-zinc-900 block">
                Pairs well with
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {recommendedDishes.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 bg-zinc-50"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-medium text-zinc-900 truncate">{rec.name}</p>
                      <p className="text-xs text-zinc-500 font-mono-tabular">₹{rec.price}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAddRecommended(rec)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-xs font-medium text-zinc-900 hover:bg-zinc-100 whitespace-nowrap shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kitchen Note */}
          <div>
            <label htmlFor="dish-note-input" className="block text-sm font-semibold text-zinc-900 mb-1.5">
              Special Kitchen Instructions
            </label>
            <input
              id="dish-note-input"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Less spicy, serve extra hot..."
              className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
          </div>
        </div>

        {/* Sticky Footer CTA */}
        <div className="px-5 py-4 border-t border-zinc-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center border border-zinc-300 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-9 text-center text-sm font-semibold font-mono-tabular">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-700 hover:bg-zinc-100"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-between"
          >
            <span className="truncate">Add for {activeGuest.name}</span>
            <span className="font-mono-tabular ml-2 shrink-0">₹{lineTotal}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
