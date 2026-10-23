import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Match from "../models/Match.js";
import Standing from "../models/Standing.js";

// Imports Eko United's fixtures from the league's published fixture list.
//
//   node src/scripts/importFixtures.js            # dry run: shows what it would add, writes nothing
//   node src/scripts/importFixtures.js --apply    # actually inserts the new fixtures
//
// The source is the plain text pulled out of the league PDF (pdftotext -raw),
// kept next to this script in ../../data/, so the import can be audited and
// re-run. Only fixtures involving Eko United become Match documents (the Match
// model is built around our games: home/away, our score vs theirs); the other
// clubs' games aren't stored. A fixture already in the database (same opponent,
// same calendar day in Lagos) is never touched or duplicated, only reported.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "../../data/conference-a-fixtures-2026-27.txt");
const APPLY = process.argv.includes("--apply");
// --offline: parse and print only, without touching the database (no duplicate
// check, no logo lookup). For checking the parser when the database is unreachable.
const OFFLINE = process.argv.includes("--offline");
const COMPETITION = "Nigeria National League";

const TEAM_NAMES = {
  "HEARTLAND FC": "Heartland FC",
  "CROWN FC": "Crown FC",
  "EDEL FC": "Edel FC",
  "SUNSHINE STARS FC": "Sunshine Stars FC",
  "REMO STARS FC": "Remo Stars FC",
  "ROVERS FC": "Rovers FC",
  "STORMERS SC": "Stormers SC",
  "GODSWILL AKPABIO UTD": "Godswill Akpabio United",
};

const VENUES = {
  "DAN ANYIAM STADIUM, OWERRI": "Dan Anyiam Stadium, Owerri",
  "AWKA TOWNSHIP STADIUM, AWKA": "Awka Township Stadium, Awka",
  "REMO STARS STADIUM, IKENNE": "Remo Stars Stadium, Ikenne",
  "M.K.O ABIOLA STADIUM, ABEOKUTA": "M.K.O Abiola Stadium, Abeokuta",
  "U.J. ESUENE STADIUM, CALABAR": "U.J. Esuene Stadium, Calabar",
  "U.J ESUENE STADIUM, CALABAR": "U.J. Esuene Stadium, Calabar",
  "AKURE TOWNSHIP STADIUM, AKURE": "Akure Township Stadium, Akure",
  "SOUN TOWNSHIP STADIUM, OGBOMOSO": "Soun Township Stadium, Ogbomoso",
  "MOBOLAJI JOHNSON STADIUM, LAGOS": "Mobolaji Johnson Stadium, Lagos",
  "UYO TOWNSHIP STADIUM, UYO": "Uyo Township Stadium, Uyo",
};

const titleCase = (s) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

// A loose key for matching club names across spellings ("Godswill Akpabio
// United" / "GODSWILL AKPABIO UTD", "Crown Fc" / "CROWN FC").
const key = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !["fc", "sc", "utd", "united", "football", "club"].includes(w))
    .join("");

// Lagos is UTC+1 all year (no daylight saving), so 4pm in Lagos is 15:00 UTC.
function lagosToDate(day, month, year, hour12, meridiem) {
  let hour = Number(hour12) % 12;
  if (meridiem.toLowerCase() === "pm") hour += 12;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 1, 0, 0));
}

const lagosDay = (date) =>
  new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);

function parseFixtures(text) {
  const rows = [];
  let matchday = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // The first header reads "S/N   MATCHDAY 1   DATE   TIME   VENUE".
    const md = line.match(/^(?:S\/N\s+)?MATCHDAY\s+(\d+)\b/i);
    if (md) {
      matchday = Number(md[1]);
      continue;
    }
    const m = line.match(
      /^(\d+)\s+(.+?)\s+VS\s+(.+?)(?:\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2})(am|pm)(?:\s+(.+))?)?$/i
    );
    if (!m) continue;
    const home = m[2].replace(/\(.*?\)/g, "").trim().toUpperCase();
    const away = m[3].replace(/\(.*?\)/g, "").trim().toUpperCase();
    rows.push({ matchday, home, away, date: m[4] ? m : null });
  }
  return rows;
}

const text = fs.readFileSync(SOURCE, "utf8");
const all = parseFixtures(text);
const ours = all.filter((r) => r.home === "EKO UTD FC" || r.away === "EKO UTD FC");
const byes = ours.filter((r) => r.home === "BYE" || r.away === "BYE");
const games = ours.filter((r) => r.home !== "BYE" && r.away !== "BYE");

console.log(`Parsed ${all.length} fixture rows across the league; ${games.length} involve Eko United (${byes.length} bye weeks: matchday ${byes.map((b) => b.matchday).join(", ")}).`);

if (!OFFLINE) await connectDB();

const [standings, existingMatches] = OFFLINE
  ? [[], []]
  : await Promise.all([
      Standing.find({ clubLogoUrl: { $exists: true, $ne: "" } }).lean(),
      Match.find().lean(),
    ]);

// Logos already uploaded by the club, from the league table and from earlier fixtures.
const logos = new Map();
for (const s of standings) logos.set(key(s.clubName), s.clubLogoUrl);
for (const m of existingMatches) if (m.opponentLogoUrl) logos.set(key(m.opponent), m.opponentLogoUrl);

const plan = games.map((g) => {
  const isHome = g.home === "EKO UTD FC";
  const opponentRaw = isHome ? g.away : g.home;
  const opponent = TEAM_NAMES[opponentRaw] || titleCase(opponentRaw);
  if (!g.date) throw new Error(`No date/venue for Eko fixture on matchday ${g.matchday}: ${g.home} vs ${g.away}`);
  const [, , , , dd, mm, yyyy, hh, ap, venueRaw] = g.date;
  const kickoff = lagosToDate(dd, mm, yyyy, hh, ap);
  const venueKey = (venueRaw || "").trim().toUpperCase();
  const venue = VENUES[venueKey] || (venueRaw ? titleCase(venueRaw.trim()) : undefined);
  const dup = existingMatches.find(
    (m) => key(m.opponent) === key(opponent) && lagosDay(new Date(m.kickoff)) === lagosDay(kickoff)
  );
  return {
    matchday: g.matchday,
    opponent,
    isHome,
    kickoff,
    venue,
    opponentLogoUrl: logos.get(key(opponent)),
    competition: `${COMPETITION} · Matchday ${g.matchday}`,
    dup,
  };
});

const fmt = (d) =>
  d.toLocaleString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

console.log("");
for (const p of plan) {
  let status = "NEW   ";
  if (p.dup) {
    const sameTime = new Date(p.dup.kickoff).getTime() === p.kickoff.getTime();
    status = sameTime ? "EXISTS" : "EXISTS (time differs, left untouched)";
  }
  console.log(
    `MD${String(p.matchday).padStart(2)}  ${p.isHome ? "H" : "A"}  ${p.opponent.padEnd(24)} ${fmt(p.kickoff).padEnd(26)} ${(p.venue || "").padEnd(34)} logo:${p.opponentLogoUrl ? "yes" : "no "}  ${status}`
  );
  if (p.dup && new Date(p.dup.kickoff).getTime() !== p.kickoff.getTime()) {
    console.log(`        in database: ${fmt(new Date(p.dup.kickoff))} at ${p.dup.venue || "(no venue)"}`);
  }
}

const fresh = plan.filter((p) => !p.dup);
console.log(`\n${fresh.length} new, ${plan.length - fresh.length} already in the database.`);

if (OFFLINE) {
  console.log("Offline parse only: nothing was compared with the database.");
} else if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to insert the new fixtures.");
} else if (fresh.length) {
  const inserted = await Match.insertMany(
    fresh.map(({ opponent, opponentLogoUrl, competition, venue, kickoff, isHome }) => ({
      opponent,
      opponentLogoUrl,
      competition,
      venue,
      kickoff,
      isHome,
      status: "upcoming",
    }))
  );
  console.log(`Inserted ${inserted.length} fixtures.`);
}

if (!OFFLINE) await mongoose.disconnect();
process.exit(0);
