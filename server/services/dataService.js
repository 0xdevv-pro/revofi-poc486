
const { randomUUID } = require("crypto");

// Mock database
const db = {
  users: [
    {
      id: "u1",
      name: "Alice Johnson",
      email: "alice@example.com",
      balance: 2500,
      status: "active",
    },
    {
      id: "u2",
      name: "Bob Smith",
      email: "bob@example.com",
      balance: 1200,
      status: "active",
    },
  ],

  cryptos: [
    { id: "c1", symbol: "BTC", name: "Bitcoin", price: 67000 },
    { id: "c2", symbol: "ETH", name: "Ethereum", price: 3400 },
    { id: "c3", symbol: "SOL", name: "Solana", price: 180 },
  ],

  goods: [
    { id: "g1", name: "Premium Headphones", price: 199, stock: 25 },
    { id: "g2", name: "Smart Watch", price: 299, stock: 12 },
    { id: "g3", name: "Wireless Charger", price: 39, stock: 50 },
  ],

  cards: [],
  banks: [],
  purchaseHistory: [],
  rewardHistory: [],
};

// Shared helpers
function clone(data) {
  return structuredClone(data);
}

function findUser(userId) {
  return db.users.find((user) => user.id === userId);
}

function createEntry(collection, data, requiredFields) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("A valid data object is required");
  }

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null ||
        data[field] === "") {
      throw new Error(`${field} is required`);
    }
  }

  const entry = {
    ...data,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  collection.push(entry);
  return clone(entry);
}

function getHistory(collection, userId, options = {}) {
  const { page = 1, limit = 10 } = options;

  if (!Number.isInteger(Number(page)) || Number(page) < 1) {
    throw new Error("page must be a positive integer");
  }

  if (!Number.isInteger(Number(limit)) ||
      Number(limit) < 1 || Number(limit) > 100) {
    throw new Error("limit must be between 1 and 100");
  }

  const filtered = collection
    .filter((item) => !userId || item.userId === userId)
    .sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

  const start = (Number(page) - 1) * Number(limit);

  return {
    data: clone(filtered.slice(start, start + Number(limit))),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / Number(limit)),
    },
  };
}

// 1. Users
async function getUsers(options = {}) {
  const { search = "", status } = options;
  const keyword = String(search).toLowerCase();

  return clone(
    db.users.filter((user) =>
      (!keyword ||
        user.name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword)) &&
      (!status || user.status === status)
    )
  );
}

// 2. Cryptocurrencies
async function getCryptos(options = {}) {
  const { search = "", minPrice, maxPrice } = options;
  const keyword = String(search).toLowerCase();

  return clone(
    db.cryptos.filter((crypto) =>
      (!keyword ||
        crypto.name.toLowerCase().includes(keyword) ||
        crypto.symbol.toLowerCase().includes(keyword)) &&
      (minPrice === undefined || crypto.price >= Number(minPrice)) &&
      (maxPrice === undefined || crypto.price <= Number(maxPrice))
    )
  );
}

// 3. Goods
async function getGoods(options = {}) {
  const { search = "", minPrice, maxPrice, inStock } = options;
  const keyword = String(search).toLowerCase();

  return clone(
    db.goods.filter((good) =>
      (!keyword || good.name.toLowerCase().includes(keyword)) &&
      (minPrice === undefined || good.price >= Number(minPrice)) &&
      (maxPrice === undefined || good.price <= Number(maxPrice)) &&
      (inStock !== true || good.stock > 0)
    )
  );
}

// 4. Cards
async function getCards(userId) {
  return clone(
    db.cards.filter((card) => !userId || card.userId === userId)
  );
}

// 5. Add card
async function postCard(data) {
  if (!findUser(data?.userId)) {
    throw new Error("User not found");
  }

  if (typeof data.cardNumber !== "string" ||
      !/^\d{12,19}$/.test(data.cardNumber)) {
    throw new Error("Card number must contain 12–19 digits");
  }

  // Store only a masked card number in this mock service.
  const { cardNumber, ...safeData } = data;

  return createEntry(db.cards, {
    ...safeData,
    last4: cardNumber.slice(-4),
  }, ["userId", "last4"]);
}

// 6. Banks
async function getBanks(userId) {
  return clone(
    db.banks.filter((bank) => !userId || bank.userId === userId)
  );
}

// 7. Add bank
async function postBank(data) {
  if (!findUser(data?.userId)) {
    throw new Error("User not found");
  }

  if (typeof data.accountNumber !== "string" ||
      data.accountNumber.length < 4) {
    throw new Error("A valid account number is required");
  }

  // Avoid retaining full account numbers in mock records.
  const { accountNumber, ...safeData } = data;

  return createEntry(db.banks, {
    ...safeData,
    accountLast4: accountNumber.slice(-4),
  }, ["userId", "accountLast4", "bankName"]);
}

// 8. Purchase history
async function getPurchaseHistory(userId, options = {}) {
  return getHistory(db.purchaseHistory, userId, options);
}

// 9. Create purchase
async function postPurchaseHistory(data) {
  if (!findUser(data?.userId)) {
    throw new Error("User not found");
  }

  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    throw new Error("Purchase amount must be positive");
  }

  const good = db.goods.find((item) => item.id === data.goodId);

  if (!good) {
    throw new Error("Good not found");
  }

  if (!Number.isInteger(data.quantity) || data.quantity < 1) {
    throw new Error("Quantity must be a positive integer");
  }

  if (good.stock < data.quantity) {
    throw new Error("Insufficient stock");
  }

  if (Math.abs(data.amount - good.price * data.quantity) > 0.000001) {
    throw new Error("Purchase amount does not match item price");
  }

  // Update inventory only after validation.
  good.stock -= data.quantity;

  return createEntry(db.purchaseHistory, {
    userId: data.userId,
    goodId: good.id,
    goodName: good.name,
    quantity: data.quantity,
    amount: data.amount,
    status: "completed",
    transactionRef: randomUUID(),
  }, ["userId", "goodId", "amount"]);
}

// 10. Reward history
async function getRewardHistory(userId, options = {}) {
  return getHistory(db.rewardHistory, userId, options);
}

// 11. Create reward
async function postRewardHistory(data) {
  if (!findUser(data?.userId)) {
    throw new Error("User not found");
  }

  if (!Number.isFinite(data.points) ||
      !Number.isInteger(data.points) || data.points <= 0) {
    throw new Error("Reward points must be a positive integer");
  }

  const user = findUser(data.userId);

  // Keep user balance and reward history synchronized.
  user.balance += data.points;

  return createEntry(db.rewardHistory, {
    userId: data.userId,
    points: data.points,
    reason: data.reason || "Purchase reward",
    status: "credited",
    balanceAfter: user.balance,
  }, ["userId", "points"]);
}

module.exports = {
  getUsers,
  getCryptos,
  getGoods,
  getCards,
  postCard,
  getBanks,
  postBank,
  getPurchaseHistory,
  postPurchaseHistory,
  getRewardHistory,
  postRewardHistory,
};
