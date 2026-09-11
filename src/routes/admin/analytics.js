import { Router } from "express";
import Match from "../../models/Match.js";
import Order from "../../models/Order.js";
import Ticket from "../../models/Ticket.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// This is the one admin view that combines match results with money (ticket
// and shop revenue) across every role's scope, so it's super_admin-only:
// shop_manager/ticket_manager already see their own scoped orders on
// /admin/orders, and content_editor already sees match records on
// /admin/matches; this page is the cross-cutting rollup, not a duplicate of
// either.
router.use(requireAuth, requireRole("super_admin"));

router.get("/overview", async (_req, res, next) => {
  try {
    const finishedMatches = await Match.find({ status: "finished", isActive: true }).sort({
      kickoff: -1,
    });

    let wins = 0,
      draws = 0,
      losses = 0,
      goalsFor = 0,
      goalsAgainst = 0;
    const scorerCounts = {};

    for (const m of finishedMatches) {
      if (m.score?.eko != null && m.score?.opponent != null) {
        goalsFor += m.score.eko;
        goalsAgainst += m.score.opponent;
        if (m.score.eko > m.score.opponent) wins++;
        else if (m.score.eko < m.score.opponent) losses++;
        else draws++;
      }
      for (const e of m.events || []) {
        if (e.type === "goal" && e.player) {
          scorerCounts[e.player] = (scorerCounts[e.player] || 0) + 1;
        }
      }
    }

    const topScorers = Object.entries(scorerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([player, goals]) => ({ player, goals }));

    const [ticketOrders, shopOrders, totalTickets, usedTickets] = await Promise.all([
      Order.find({ type: "ticket", status: "paid" }),
      Order.find({ type: "shop", status: "paid" }),
      Ticket.countDocuments(),
      Ticket.countDocuments({ used: true }),
    ]);

    const ticketRevenue = ticketOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const ticketsSold = ticketOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );

    const shopRevenue = shopOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const productCounts = {};
    for (const o of shopOrders) {
      for (const i of o.items) {
        productCounts[i.name] = (productCounts[i.name] || 0) + i.quantity;
      }
    }
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));

    const recentOrders = [...ticketOrders, ...shopOrders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((o) => ({
        _id: o._id,
        type: o.type,
        customerName: o.customerName,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
      }));

    res.json({
      season: {
        played: wins + draws + losses,
        wins,
        draws,
        losses,
        goalsFor,
        goalsAgainst,
      },
      topScorers,
      tickets: {
        revenue: ticketRevenue,
        sold: ticketsSold,
        totalIssued: totalTickets,
        checkedIn: usedTickets,
      },
      shop: {
        revenue: shopRevenue,
        orders: shopOrders.length,
        topProducts,
      },
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
