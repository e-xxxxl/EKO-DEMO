// Pure number-crunching for the admin Ticketing screens: no database calls in
// here, so it can be tested with plain objects. The routes in
// routes/admin/tickets.js fetch the rows and pass them in.
//
// Words used throughout:
//   sold        tickets that exist (a ticket is only made once an order is paid
//               or free-claimed), so this is also the number issued
//   revenue     money actually taken for those tickets, after any referral discount
//   free        tickets whose category costs nothing
//   checked in  tickets already scanned or ticked at the gate

export const ref8 = (id) => String(id).slice(-8).toUpperCase();

export function paymentMethod(order) {
  if (order.paymentProvider === "paystack") return "Paystack";
  if (order.paymentProvider === "flutterwave") return "Flutterwave";
  if (Number(order.totalAmount) === 0) return "Free";
  return "Offline";
}

// What each line of an order really brought in. A referral discount is taken
// off the whole order, so it is shared out across the lines in proportion to
// what each line would have cost. A free order has nothing to share.
export function lineNets(order) {
  const gross = order.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const subtotal = typeof order.subtotalAmount === "number" ? order.subtotalAmount : gross;
  const factor = subtotal > 0 ? Number(order.totalAmount) / subtotal : 0;
  return order.items.map((i) => {
    const lineGross = i.unitPrice * i.quantity;
    return { ref: String(i.ref), quantity: i.quantity, gross: lineGross, net: Math.round(lineGross * factor) };
  });
}

const emptyCategory = (t) => ({
  _id: String(t._id),
  name: t.name,
  price: t.price,
  isActive: t.isActive,
  capacity: t.quantityAvailable,
  sold: 0,
  checkedIn: 0,
  revenue: 0,
  discount: 0,
  orders: 0,
});

// Everything about one match: totals, a row per category, and how the money
// arrived. `counts` is [{ _id: ticketTypeId, sold, used }].
export function buildOverview({ match, types, counts, paidOrders, pendingOrders }) {
  const cats = new Map(types.map((t) => [String(t._id), emptyCategory(t)]));
  for (const c of counts) {
    const cat = cats.get(String(c._id));
    if (cat) {
      cat.sold = c.sold;
      cat.checkedIn = c.used;
    }
  }

  const methods = new Map();
  const bump = (method, orderId, net, tickets) => {
    const m = methods.get(method) || { method, orders: new Set(), tickets: 0, amount: 0 };
    m.orders.add(orderId);
    m.tickets += tickets;
    m.amount += net;
    methods.set(method, m);
  };

  const paidOrderIds = new Set();
  for (const order of paidOrders) {
    const method = paymentMethod(order);
    for (const line of lineNets(order)) {
      const cat = cats.get(line.ref);
      if (!cat) continue; // a line for another match
      cat.revenue += line.net;
      cat.discount += line.gross - line.net;
      cat.orders += 1;
      paidOrderIds.add(String(order._id));
      bump(method, String(order._id), line.net, line.quantity);
    }
  }

  let pendingOrdersCount = 0;
  let pendingTickets = 0;
  let pendingAmount = 0;
  for (const order of pendingOrders) {
    let counted = false;
    for (const line of lineNets(order)) {
      if (!cats.has(line.ref)) continue;
      counted = true;
      pendingTickets += line.quantity;
      pendingAmount += line.net;
    }
    if (counted) pendingOrdersCount += 1;
  }

  const categories = [...cats.values()].map((c) => ({
    ...c,
    remaining: Math.max(0, c.capacity - c.sold),
    free: c.price === 0,
  }));

  const sum = (key) => categories.reduce((s, c) => s + c[key], 0);
  const sold = sum("sold");
  const totals = {
    sold,
    capacity: sum("capacity"),
    remaining: sum("remaining"),
    checkedIn: sum("checkedIn"),
    notYetIn: sold - sum("checkedIn"),
    revenue: sum("revenue"),
    discount: sum("discount"),
    freeTickets: categories.filter((c) => c.free).reduce((s, c) => s + c.sold, 0),
    paidTickets: categories.filter((c) => !c.free).reduce((s, c) => s + c.sold, 0),
    orders: paidOrderIds.size,
    pendingOrders: pendingOrdersCount,
    pendingTickets,
    pendingAmount,
  };

  const paymentMethods = [...methods.values()]
    .map((m) => ({ method: m.method, orders: m.orders.size, tickets: m.tickets, amount: m.amount }))
    .sort((a, b) => b.amount - a.amount || b.tickets - a.tickets);

  return {
    match: {
      _id: String(match._id),
      opponent: match.opponent,
      kickoff: match.kickoff,
      venue: match.venue,
      competition: match.competition,
      status: match.status,
    },
    totals,
    categories,
    paymentMethods,
  };
}

// One row per home match that has tickets set up. `ticketCounts` is
// [{ _id: matchId, sold, used }]; `paidOrders` the paid ticket orders.
export function buildMatchesSummary({ matches, types, ticketCounts, paidOrders }) {
  const typeToMatch = new Map(types.map((t) => [String(t._id), String(t.match)]));
  const byMatch = new Map(
    matches.map((m) => [
      String(m._id),
      {
        _id: String(m._id),
        opponent: m.opponent,
        kickoff: m.kickoff,
        venue: m.venue,
        competition: m.competition,
        status: m.status,
        categories: 0,
        capacity: 0,
        sold: 0,
        checkedIn: 0,
        revenue: 0,
      },
    ])
  );
  for (const t of types) {
    const row = byMatch.get(String(t.match));
    if (!row) continue;
    row.categories += 1;
    row.capacity += t.quantityAvailable;
  }
  for (const c of ticketCounts) {
    const row = byMatch.get(String(c._id));
    if (row) {
      row.sold = c.sold;
      row.checkedIn = c.used;
    }
  }
  for (const order of paidOrders) {
    for (const line of lineNets(order)) {
      const row = byMatch.get(typeToMatch.get(line.ref));
      if (row) row.revenue += line.net;
    }
  }
  return [...byMatch.values()]
    .filter((r) => r.categories > 0)
    .map((r) => ({ ...r, remaining: Math.max(0, r.capacity - r.sold) }));
}

// An order as the admin sees it: who, what, how it was paid, and its tickets.
export function orderView(order, { typeMap, matchMap, tickets }) {
  const items = order.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.unitPrice * i.quantity,
  }));
  const gross = items.reduce((s, i) => s + i.lineTotal, 0);
  const firstType = typeMap.get(String(order.items[0]?.ref));
  const match = firstType ? matchMap.get(String(firstType.match)) : null;
  return {
    _id: String(order._id),
    ref: ref8(order._id),
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone || "",
    marketingConsent: Boolean(order.marketingConsent),
    items,
    subtotal: typeof order.subtotalAmount === "number" ? order.subtotalAmount : gross,
    discount: order.discountAmount || 0,
    total: order.totalAmount,
    paymentMethod: order.status === "paid" ? paymentMethod(order) : order.paymentProvider ? paymentMethod(order) : "Not paid",
    paymentReference: order.paymentReference || "",
    referralCode: order.referralCode || "",
    referralOwner: order.referralOwner || "",
    matchId: match ? String(match._id) : null,
    matchLabel: match ? `vs ${match.opponent}` : "",
    tickets: (tickets || []).map((t) => ({
      code: t.code,
      ticketTypeName: t.ticketTypeName,
      used: Boolean(t.used),
      usedAt: t.usedAt || null,
      usedBy: t.usedBy || "",
    })),
  };
}
