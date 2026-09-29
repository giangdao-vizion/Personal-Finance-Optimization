/**
 * Unit checks for cloudOverwriteWouldShrink logic (mirrors app.js helpers).
 * Run: node scripts/test-cloud-shrink-guard.mjs
 */

function isRowDeleted(row) {
  return !!(row && typeof row.deletedAt === "number" && row.deletedAt > 0);
}

function summarizePayloadCoverage(payload) {
  var p = payload || {};
  var liveExpenses = 0;
  var monthKeys = {};
  Object.keys(p.days || {}).forEach(function (dk) {
    var shard = p.days[dk];
    if (!shard || !Array.isArray(shard.expenses)) return;
    var hasLive = false;
    for (var i = 0; i < shard.expenses.length; i++) {
      if (!isRowDeleted(shard.expenses[i])) {
        liveExpenses += 1;
        hasLive = true;
      }
    }
    if (hasLive && dk.length >= 7) monthKeys[dk.slice(0, 7)] = true;
  });
  Object.keys(p.months || {}).forEach(function (mk) {
    var m = p.months[mk];
    if (!m || typeof m !== "object") return;
    if (typeof m.deletedAt === "number" && m.deletedAt > 0) return;
    if ((typeof m.income === "number" && m.income > 0) || monthKeys[mk]) {
      monthKeys[mk] = true;
    }
  });
  return {
    liveExpenses: liveExpenses,
    monthCount: Object.keys(monthKeys).length,
    monthKeys: monthKeys,
  };
}

function cloudOverwriteWouldShrink(localPayload, remotePayload) {
  if (!remotePayload) return false;
  var local = summarizePayloadCoverage(localPayload);
  var remote = summarizePayloadCoverage(remotePayload);
  if (remote.liveExpenses <= 0 && remote.monthCount <= 0) return false;
  var missingMonths = 0;
  Object.keys(remote.monthKeys).forEach(function (mk) {
    if (!local.monthKeys[mk]) missingMonths += 1;
  });
  if (missingMonths > 0) return true;
  if (local.liveExpenses < remote.liveExpenses) return true;
  if (local.monthCount < remote.monthCount) return true;
  return false;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var remoteRich = {
  days: {
    "2026-01-01": { expenses: [{ id: "a", amount: 1 }, { id: "b", amount: 2 }] },
    "2026-02-01": { expenses: [{ id: "c", amount: 3 }] },
  },
  months: { "2026-01": { income: 1 }, "2026-02": { income: 1 } },
};

var localPoor = {
  days: { "2026-02-01": { expenses: [{ id: "c", amount: 3 }] } },
  months: { "2026-02": { income: 1 } },
};

var localEqual = JSON.parse(JSON.stringify(remoteRich));
var localEmpty = { days: {}, months: {} };

assert(cloudOverwriteWouldShrink(localPoor, remoteRich) === true, "poor vs rich should shrink");
assert(cloudOverwriteWouldShrink(localEqual, remoteRich) === false, "equal should not shrink");
assert(cloudOverwriteWouldShrink(localEmpty, remoteRich) === true, "empty vs rich should shrink");
assert(cloudOverwriteWouldShrink(remoteRich, null) === false, "no remote = no shrink");
assert(cloudOverwriteWouldShrink(remoteRich, localEmpty) === false, "rich over empty = ok");

console.log("ok: cloud shrink guard tests passed");
