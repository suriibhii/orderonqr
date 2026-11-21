export type BranchId = 'chandannagar' | 'kolkata' | 'serampore';

export type TableStatus =
  | 'available'
  | 'occupied'
  | 'ordering'
  | 'preparing'
  | 'ready'
  | 'serving'
  | 'cleaning'
  | 'attention';

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'served';

export type WaiterReason =
  | 'Need water'
  | 'Need cutlery'
  | 'Need assistance'
  | 'Need another order'
  | 'Need bill'
  | 'General help';

export type WaiterRequestStatus = 'pending' | 'accepted' | 'resolved';

export type SplitMode = 'equal' | 'by_person' | 'by_item' | 'custom';

export type PaymentMethod = 'UPI' | 'Card' | 'Bank Transfer' | 'Cash Confirmation';

export interface DishPortion {
  label: string;
  priceDelta: number;
}

export interface DishAddon {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category:
    | 'Sushi & Rolls'
    | 'Dim Sums & Gyoza'
    | 'Ramen & Mains'
    | 'Beverages & Matcha'
    | 'Desserts';
  price: number;
  description: string;
  ingredients: string[];
  isVeg: boolean;
  allergens: string[];
  spiceLevel: 'Mild' | 'Medium' | 'Hot' | 'None';
  rating: number;
  reviewCount: number;
  highlight?: 'Bestseller' | 'Customer Favourite' | 'New' | "Today's Deal";
  imageUrl: string;
  portions?: DishPortion[];
  addons: DishAddon[];
  recommendedIds: string[];
  prepMinutes: number;
  inventoryUsage: { ingredientId: string; units: number }[];
}

export interface GuestMember {
  id: string;
  name: string;
  avatarColor: string;
  initials: string;
  loyaltyPoints: number;
  joinedAt: number;
}

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  guestId: string;
  guestName: string;
  portionLabel: string;
  addons: DishAddon[];
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export interface OrderItem extends CartItem {
  status: OrderStatus;
}

export interface KitchenOrder {
  id: string;
  orderNumber: number;
  branchId: BranchId;
  tableNumber: number;
  tableSessionName: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  subtotal: number;
  notes?: string;
}

export interface WaiterRequest {
  id: string;
  branchId: BranchId;
  tableNumber: number;
  tableSessionName: string;
  guestName: string;
  reason: WaiterReason;
  status: WaiterRequestStatus;
  assignedStaffId: string;
  assignedStaffName: string;
  section: string;
  createdAt: number;
}

export interface StaffMember {
  id: string;
  branchId: BranchId;
  name: string;
  role: 'Server' | 'Senior Captain' | 'Runner';
  active: boolean;
  assignedTables: number[];
  section: string;
}

export interface InventoryItem {
  id: string;
  branchId: BranchId;
  name: string;
  unit: string;
  remainingPct: number;
  remainingQty: number;
  capacityQty: number;
  reorderThresholdPct: number;
}

export interface OfferRule {
  id: string;
  title: string;
  tag: 'HAPPY HOUR' | 'GAME BONUS' | 'COMBO' | 'RETURNING';
  description: string;
  discountType: 'percent' | 'flat' | 'points';
  value: number;
  active: boolean;
  code: string;
}

export interface ReviewEntry {
  id: string;
  branchId: BranchId;
  tableNumber: number;
  tableSessionName: string;
  guestName: string;
  overall: number;
  food: number;
  service: number;
  cleanliness: number;
  comment: string;
  createdAt: number;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string;
  branchId: BranchId;
  tableNumber: number;
  tableSessionName: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  tipAmount: number;
  total: number;
  splitMode: SplitMode;
  paymentMethod: PaymentMethod;
  paidAt: number;
  pointsEarned: number;
}

export interface TicTacToeState {
  board: (string | null)[];
  playerXId: string;
  playerXName: string;
  playerOId: string | null;
  playerOName: string | null;
  turn: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
}

export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface TriviaSessionState {
  active: boolean;
  mode: 'table' | 'versus';
  opponentTableNumber?: number;
  opponentSessionName?: string;
  questionIndex: number;
  startedAt: number;
  endsAt: number;
  scores: Record<string, { name: string; points: number; answeredIndices: number[] }>;
  opponentScore: number;
  finished: boolean;
  winnerLabel?: string;
}

export interface DrawStrokePoint {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export interface DrawStroke {
  id: string;
  color: string;
  size: number;
  points: DrawStrokePoint[];
}

export interface DrawGuess {
  id: string;
  guestId: string;
  guestName: string;
  text: string;
  correct: boolean;
  createdAt: number;
}

export interface DrawGameState {
  phase: 'playing' | 'round_summary';
  round: number;
  drawerId: string;
  drawerName: string;
  secretWord: string;
  maskedHint: string;
  strokes: DrawStroke[];
  guesses: DrawGuess[];
  winnerGuestName: string | null;
  startedAt: number;
  endsAt: number;
  scores: Record<string, { name: string; points: number }>;
}

export interface TableSession {
  branchId: BranchId;
  tableNumber: number;
  section: string;
  capacity: number;
  x: number;
  y: number;
  status: TableStatus;
  sessionName: string;
  assignedWaiterId: string;
  guests: GuestMember[];
  cart: CartItem[];
  appliedOfferId: string | null;
  billRequested: boolean;
  lastReceipt: ReceiptRecord | null;
  ticTacToe: TicTacToeState | null;
  trivia: TriviaSessionState | null;
  drawGame: DrawGameState | null;
}

export interface BranchInfo {
  id: BranchId;
  name: string;
  city: string;
  address: string;
  todaySales: number;
  todayOrders: number;
  avgPrepMinutes: number;
  rating: number;
}

export interface RestaurantState {
  restaurantName: string;
  activeBranchId: BranchId;
  branches: Record<BranchId, BranchInfo>;
  menu: MenuItem[];
  offers: OfferRule[];
  tables: Record<string, TableSession>; // key: `${branchId}:${tableNumber}`
  orders: KitchenOrder[];
  waiterRequests: WaiterRequest[];
  staff: StaffMember[];
  inventory: InventoryItem[];
  reviews: ReviewEntry[];
  triviaBank: TriviaQuestion[];
  nextOrderNumber: number;
  tipDistribution: { kitchenPct: number; servicePct: number };
}

export type ClientEvent =
  | { type: 'state:request' }
  | {
      type: 'table:join';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        sessionName?: string;
        guestName: string;
        avatarColor: string;
      };
    }
  | {
      type: 'table:rename';
      payload: { branchId: BranchId; tableNumber: number; sessionName: string };
    }
  | {
      type: 'table:status';
      payload: { branchId: BranchId; tableNumber: number; status: TableStatus };
    }
  | {
      type: 'cart:add';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        item: Omit<CartItem, 'id'>;
      };
    }
  | {
      type: 'cart:update_qty';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        cartItemId: string;
        delta: number;
      };
    }
  | {
      type: 'cart:apply_offer';
      payload: { branchId: BranchId; tableNumber: number; offerId: string | null };
    }
  | {
      type: 'order:submit';
      payload: { branchId: BranchId; tableNumber: number; notes?: string };
    }
  | {
      type: 'order:advance';
      payload: { orderId: string; status: OrderStatus };
    }
  | {
      type: 'waiter:call';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestName: string;
        reason: WaiterReason;
      };
    }
  | {
      type: 'waiter:update';
      payload: { requestId: string; status: WaiterRequestStatus; staffId?: string };
    }
  | {
      type: 'game:ttt_start';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        guestName: string;
      };
    }
  | {
      type: 'game:ttt_join';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        guestName: string;
      };
    }
  | {
      type: 'game:ttt_move';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        index: number;
      };
    }
  | {
      type: 'game:trivia_start';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        mode: 'table' | 'versus';
        opponentTableNumber?: number;
      };
    }
  | {
      type: 'game:trivia_answer';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        guestName: string;
        questionIndex: number;
        selectedIndex: number;
      };
    }
  | {
      type: 'game:draw_start';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        drawerId: string;
        drawerName: string;
      };
    }
  | {
      type: 'game:draw_stroke';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        stroke: DrawStroke;
      };
    }
  | {
      type: 'game:draw_undo';
      payload: { branchId: BranchId; tableNumber: number };
    }
  | {
      type: 'game:draw_clear';
      payload: { branchId: BranchId; tableNumber: number };
    }
  | {
      type: 'game:draw_guess';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        guestName: string;
        text: string;
      };
    }
  | {
      type: 'game:draw_next_round';
      payload: { branchId: BranchId; tableNumber: number };
    }
  | {
      type: 'bill:request';
      payload: { branchId: BranchId; tableNumber: number };
    }
  | {
      type: 'bill:pay';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        splitMode: SplitMode;
        tipAmount: number;
        paymentMethod: PaymentMethod;
        guestId?: string;
      };
    }
  | {
      type: 'review:submit';
      payload: {
        branchId: BranchId;
        tableNumber: number;
        guestId: string;
        guestName: string;
        overall: number;
        food: number;
        service: number;
        cleanliness: number;
        comment: string;
      };
    }
  | {
      type: 'admin:toggle_offer';
      payload: { offerId: string };
    }
  | {
      type: 'admin:update_pairings';
      payload: { menuItemId: string; recommendedIds: string[] };
    }
  | {
      type: 'admin:restock_inventory';
      payload: { inventoryId: string };
    };

export type ServerEvent =
  | { type: 'state:sync'; payload: RestaurantState }
  | { type: 'toast:info'; payload: { message: string; branchId?: BranchId } };
