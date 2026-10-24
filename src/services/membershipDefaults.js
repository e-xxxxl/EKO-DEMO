import MembershipTier from "../models/MembershipTier.js";
import MembershipContent from "../models/MembershipContent.js";

// Starting content, taken from the club's "Official Membership & Sponsorship
// Tier Framework". Written into the database the first time the page or the
// admin asks for it, after which everything is edited in the admin panel.
const DEFAULT_TIERS = [
  {
    slug: "platinum-corporate",
    name: "Platinum Corporate",
    audience: "For companies and brands",
    price: "₦10,000,000",
    tagline: "Put your brand at the heart of the club.",
    badge: "Partner",
    displayOrder: 1,
    perks: [
      "A dedicated private executive suite on matchdays, with guest tickets included",
      "Your company logo placed prominently across official club assets",
      "Strategic corporate logo display on the club's official website",
      "Rights to sponsor and brand matchday halftime entertainment and shows",
      "Exclusive Adopt a Club CSR partnership with a club Community Social Responsibility project",
      "Adopt-a-Talent Initiative: directly fund youth development, elite gear, player education and athlete welfare through a transparent framework",
      "Customised corporate jerseys and official club merchandise",
      "High-level B2B events and networking",
    ],
  },
  {
    slug: "platinum-member",
    name: "Platinum Member",
    audience: "For individuals",
    price: "₦5,000,000",
    tagline: "Your own private suite and a place in club history.",
    badge: "Founders",
    displayOrder: 2,
    perks: [
      "An exclusive private executive suite for home matchdays",
      "5 extra matchday tickets in the same private suite",
      "3 official jerseys (Home, Away and Third) plus official club merchandise",
      "Invitations to official club events, B2B networking sessions and an exclusive training ground experience with players and staff",
      "Founding Members status: eternalised in club history, with recognition on the official club website",
      "Platinum Founders Circle: a numbered membership card and permanent recognition on the club's Founders Wall",
      "20% off all official merchandise and a subscription to the official club newsletter",
    ],
  },
  {
    slug: "diamond-member",
    name: "Diamond Member",
    audience: "For individuals",
    price: "₦2,000,000",
    period: "per year",
    tagline: "Matchday in a shared private suite, with your guests.",
    displayOrder: 3,
    perks: [
      "Matchday seating in a shared private suite, with full matchday refreshments",
      "2 extra tickets in the shared suite for your guests",
      "2 official club jerseys (Home and Away) plus official club merchandise",
      "Invitations to official club events and networking forums",
      "10% off official merchandise and a subscription to the official club newsletter",
    ],
  },
  {
    slug: "gold-member",
    name: "Gold Member",
    audience: "For individuals",
    price: "₦500,000",
    period: "per year",
    tagline: "The executive suite experience, and your own club jersey.",
    displayOrder: 4,
    perks: [
      "Entry to the shared executive suite on home matchdays",
      "1 official club jersey of your choice",
      "Selected official club merchandise",
      "A subscription to the official club newsletter",
    ],
  },
];

const DEFAULT_CONTENT = {
  key: "membership",
  eyebrow: "Official Membership",
  title: "Be part of The Uga Boys",
  intro:
    "From your own seat on matchday to your name on the club's Founders Wall, there is a membership package for every kind of supporter and every kind of partner. Choose yours below and apply in a minute.",
  galleryHeading: "Life as a member",
  gallery: [],
};

export async function ensureTiers() {
  if ((await MembershipTier.estimatedDocumentCount()) === 0) {
    await MembershipTier.insertMany(DEFAULT_TIERS);
  }
}

export async function getContent() {
  let doc = await MembershipContent.findOne({ key: "membership" });
  if (!doc) {
    try {
      doc = await MembershipContent.create(DEFAULT_CONTENT);
    } catch {
      doc = await MembershipContent.findOne({ key: "membership" });
    }
  }
  return doc;
}
