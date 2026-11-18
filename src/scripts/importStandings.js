import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Standing from "../models/Standing.js";

// Sets the league table to a published snapshot (Group A, after the second round
// of matches). Run it again with new numbers whenever the club wants to load a
// whole table at once; the admin Table screen is the everyday way to update it.
//
//   node src/scripts/importStandings.js            # dry run: shows what would change, writes nothing
//   node src/scripts/importStandings.js --apply    # saves it
//
// A club already in the table (matched by name, ignoring "FC", "SC", "United"
// and similar) keeps its crest and has its numbers and position updated. A club
// that is not there yet is added, without a crest (upload one in the admin). A
// club in the table that is not in this snapshot is hidden from the public table,
// never deleted, so it can be shown again.

const APPLY = process.argv.includes("--apply");
const SEASON = "2026";

// Order is the table order. form is oldest to newest (W win, D draw, L loss).
// goals are "for:against" as published. points are as published.
const SNAPSHOT = [
  { clubName: "Sunshine Stars FC", played: 2, won: 1, drawn: 1, lost: 0, goalsFor: 3, goalsAgainst: 1, points: 4, form: ["W", "D"] },
  { clubName: "Rovers FC", played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 1, points: 3, form: ["W", "L"] },
  { clubName: "Remo Stars FC", played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2, points: 3, form: ["L", "W"] },
  { clubName: "Heartland FC", played: 2, won: 0, drawn: 2, lost: 0, goalsFor: 2, goalsAgainst: 2, points: 2, form: ["D", "D"] },
  { clubName: "Crown FC", played: 2, won: 0, drawn: 2, lost: 0, goalsFor: 2, goalsAgainst: 2, points: 2, form: ["D", "D"] },
  { clubName: "Edel FC", played: 2, won: 0, drawn: 2, lost: 0, goalsFor: 1, goalsAgainst: 1, points: 2, form: ["D", "D"] },
  { clubName: "Godswill Akpabio United", played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 1, form: ["D"] },
  { clubName: "Eko United FC", isEkoUnited: true, played: 1, won: 0, drawn: 1, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 1, form: ["D"] },
  { clubName: "Stormers SC", played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 0, goalsAgainst: 1, points: 1, form: ["L", "D"] },
];

// "Sunshine Stars FC" and "Sunshine Stars" are the same club.
const key = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["fc", "sc", "utd", "united", "football", "club"].includes(w))
    .join("");

function checkSnapshot() {
  for (const r of SNAPSHOT) {
    if (r.won + r.drawn + r.lost !== r.played) throw new Error(`${r.clubName}: W+D+L is not the games played`);
    if (r.won * 3 + r.drawn !== r.points) throw new Error(`${r.clubName}: points do not match wins and draws`);
  }
}

checkSnapshot();
await connectDB();

const existing = await Standing.find({ season: SEASON });
const byKey = new Map(existing.map((s) => [key(s.clubName), s]));
const used = new Set();

console.log(`Table for season ${SEASON}: ${existing.length} club(s) in the database now.\n`);
const plan = SNAPSHOT.map((row, i) => {
  const match = byKey.get(key(row.clubName));
  if (match) used.add(String(match._id));
  return { row, position: i + 1, match };
});

for (const { row, position, match } of plan) {
  const gd = row.goalsFor - row.goalsAgainst;
  const line = `${String(position).padStart(2)}. ${row.clubName.padEnd(24)} P${row.played} W${row.won} D${row.drawn} L${row.lost}  ${row.goalsFor}:${row.goalsAgainst} (${gd >= 0 ? "+" : ""}${gd})  ${String(row.points).padStart(2)} pts  ${row.form.join("")}`;
  if (!match) console.log(`${line}   NEW, no crest yet`);
  else console.log(`${line}   updates "${match.clubName}" (position ${match.position} -> ${position}, crest ${match.clubLogoUrl ? "kept" : "none"})`);
}

const leftOut = existing.filter((s) => !used.has(String(s._id)));
if (leftOut.length > 0) {
  console.log(`\nIn the database but not in this snapshot (will be hidden, not deleted):`);
  for (const s of leftOut) console.log(`  - ${s.clubName} (position ${s.position}, ${s.isActive ? "shown" : "already hidden"})`);
}

if (!APPLY) {
  console.log("\nDry run. Nothing was changed. Run again with --apply to save.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const { row, position, match } of plan) {
  const data = {
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    points: row.points,
    form: row.form,
    position,
    isActive: true,
    season: SEASON,
  };
  if (match) {
    if (row.isEkoUnited) data.isEkoUnited = true;
    await Standing.updateOne({ _id: match._id }, { $set: data });
  } else {
    await Standing.create({ clubName: row.clubName, isEkoUnited: Boolean(row.isEkoUnited), ...data });
  }
}
// Hidden clubs go to the bottom so the visible positions run 1 to 9.
let next = SNAPSHOT.length + 1;
for (const s of leftOut) await Standing.updateOne({ _id: s._id }, { $set: { isActive: false, position: next++ } });

console.log("\nSaved. The public table updates within an hour, or straight away after any edit in the admin.");
await mongoose.disconnect();
