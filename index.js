import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* --------------------------------------------------
   SAFE JSON (Fixes BigInt serialization)
-------------------------------------------------- */
const safeJson = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

/* --------------------------------------------------
   Load ABIs
-------------------------------------------------- */
const PriceFeedABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/VaultPriceFeed.json")));
const ERC20ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/ERC20.json")));
const VaultABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Vault.json")));

const app = express();
const PORT = process.env.PORT || 8080;

/* --------------------------------------------------
   Serve /public (critical for CG)
-------------------------------------------------- */
app.use(express.static(path.join(__dirname, "public")));

/* --------------------------------------------------
   BSC RPC
-------------------------------------------------- */
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

/* --------------------------------------------------
   CONTRACT ADDRESSES
-------------------------------------------------- */
const ADDR = {
  PRICE_FEED: "0x31086dBa211D1e66F51701535AD4C0e0f98A3482",
  MONEY: "0x4fFe5ec4D8B9822e01c9E49678884bAEc17F60D9",
  VAULT: "0xeB0E5E1a8500317A1B8fDd195097D5509Ef861de",
};

const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);
const vault = new ethers.Contract(ADDR.VAULT, VaultABI, provider);

/* --------------------------------------------------
   SUPPORTED PERP MARKETS
-------------------------------------------------- */
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", base: "ETH" },
  { id: "BNB-PERP", token: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", base: "BNB" },
  { id: "SOL-PERP", token: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", base: "SOL" },
  { id: "DOGE-PERP", token: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", base: "XRP" },
];

/* --------------------------------------------------
   Synthetic Orderbook
-------------------------------------------------- */
function makeOrderbook(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    const step = price * 0.0005 * i;
    bids.push([price - step, 1]);
    asks.push([price + step, 1]);
  }
  return { bids, asks };
}

/* --------------------------------------------------
   On-chain Open Interest — FULLY RESTORED EXACTLY AS YOU HAD IT
-------------------------------------------------- */
async function getOpenInterest(token) {
  const longOI = await vault.guaranteedUsd(token);
  const shortOI = await vault.globalShortSizes(token);

  return {
    long: Number(longOI) / 1e30,
    short: Number(shortOI) / 1e30,
    total: (Number(longOI) + Number(shortOI)) / 1e30,
  };
}

/* --------------------------------------------------
   SUBGRAPH ENDPOINTS
-------------------------------------------------- */
const SUBGRAPHS = {
  STATS: "https://api.goldsky.com/api/public/project_clhjdosm96z2v49wghcvog65t/subgraphs/project_clhjdosm96z2v4/moneyx-stats/gn",
  TRADES: "https://api.goldsky.com/api/public/project_clhjdosm96z2v49wghcvog65t/subgraphs/moneyx-trades/v1.0.1/gn",
};

async function gql(endpoint, query) {
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const j = await r.json();
    return j.data;
  } catch (e) {
    console.error("GraphQL error:", e);
    return null;
  }
}

/* --------------------------------------------------
   FIXED: REAL PER-MARKET 24H VOLUME (tokenA OR tokenB) — ONLY CHANGE
-------------------------------------------------- */
async function getPerMarket24hVolume(token) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 24 * 3600;
  const tokenLower = token.toLowerCase();

  const q = `
    {
      volumesA: hourlyVolumeByTokens(
        first: 500,
        where: { tokenA: "${tokenLower}", timestamp_gt: ${start} }
      ) {
        margin swap liquidation mint burn
      }
      volumesB: hourlyVolumeByTokens(
        first: 500,
        where: { tokenB: "${tokenLower}", timestamp_gt: ${start} }
      ) {
        margin swap liquidation mint burn
      }
    }
  `;

  const d = await gql(SUBGRAPHS.TRADES, q);
  if (!d) return 0;

  let total = 0;
  const add = (r) => {
    total += Number(r.margin || 0) / 1e30 +
             Number(r.swap || 0) / 1e30 +
             Number(r.liquidation || 0) / 1e30 +
             Number(r.mint || 0) / 1e30 +
             Number(r.burn || 0) / 1e30;
  };

  d.volumesA?.forEach(add);
  d.volumesB?.forEach(add);

  return Math.round(total * 100) / 100;
}

/* --------------------------------------------------
   24H HIGH / LOW (from PriceCandles)
-------------------------------------------------- */
async function getHighLow(token) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 24 * 3600;

  const q = `
    {
      priceCandles(
        first: 500,
        orderBy: timestamp,
        orderDirection: desc,
        where: { token: "${token.toLowerCase()}", timestamp_gt: ${start} }
      ) {
        high
        low
      }
    }
  `;

  const d = await gql(SUBGRAPHS.STATS, q);
  if (!d?.priceCandles?.length) return { high: null, low: null };

  const highs = d.priceCandles.map((c) => Number(c.high));
  const lows = d.priceCandles.map((c) => Number(c.low));

  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/* --------------------------------------------------
   FUNDING RATE
-------------------------------------------------- */
async function getFundingRate(token) {
  const q = `
    {
      fundingRates(
        first: 1,
        orderBy: timestamp,
        orderDirection: desc,
        where: { token: "${token.toLowerCase()}" }
      ) {
        endFundingRate
      }
    }
  `;
  const d = await gql(SUBGRAPHS.STATS, q);
  if (!d?.fundingRates?.length) return 0;

  return Number(d.fundingRates[0].endFundingRate) / 1e30;
}

/* ==================================================
   MAIN CMC/CG ENDPOINT — /contracts
================================================== */
app.get("/contracts", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const out = [];

    for (const m of MARKETS) {
      const raw = await priceFeed.getPrimaryPrice(m.token, false);
      const price = Number(raw) / 1e30;

      const oi = await getOpenInterest(m.token);
      const hl = await getHighLow(m.token);
      const funding = await getFundingRate(m.token);
      const volume24h = await getPerMarket24hVolume(m.token);  // ← FIXED, REAL VOLUME

      const spread = price * 0.001; // 0.1%

      out.push({
        ticker_id: m.id,
        base_currency: m.base,
        target_currency: "USD",

        last_price: price,
        base_volume: volume24h,
        target_volume: volume24h,

        bid: price - spread,
        ask: price + spread,

        high: hl.high ?? price * 1.01,
        low: hl.low ?? price * 0.99,

        product_type: "perpetual",

        open_interest: oi.total,
        open_interest_usd: oi.total,

        index_price: price,
        index_name: `${m.base}-USD Price Feed`,
        index_currency: "USD",

        funding_rate: funding,
        next_funding_rate: funding,
        next_funding_rate_timestamp: now + 3600,

        contract_type: "vanilla",
        contract_price: price,
        contract_price_currency: "USD",
      });
    }

    res.json(safeJson(out));
  } catch (e) {
    console.error("/contracts error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

/* ==================================================
   /contract_specs
================================================== */
app.get("/contract_specs", (req, res) => {
  const out = {};
  for (const m of MARKETS) {
    out[m.id] = {
      contract_type: "vanilla",
      contract_price_currency: "USD",
      contract_price: null,
    };
  }
  res.json(safeJson(out));
});

/* ==================================================
   PUBLIC HTML for CMC/CG
================================================== */
app.get("/contract-specs.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/contract-specs.html"));
});

/* ==================================================
   ORDERBOOK
================================================== */
app.get("/orderbook", async (req, res) => {
  const id = req.query.ticker_id;
  const m = MARKETS.find((x) => x.id === id);

  if (!m) return res.status(400).json({ error: "Unknown ticker_id" });

  const raw = await priceFeed.getPrimaryPrice(m.token, false);
  const price = Number(raw) / 1e30;

  const { bids, asks } = makeOrderbook(price);

  res.json(safeJson({ ticker_id: id, timestamp: Date.now(), bids, asks }));
});

/* ==================================================
   MONEY SUPPLY
================================================== */
app.get("/supply/money", async (req, res) => {
  try {
    const total = await money.totalSupply();
    const decimals = await money.decimals();

    res.json(
      safeJson({
        total_supply: total.toString(),
        circulating_supply: total.toString(),
        decimals,
      })
    );
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

/* ==================================================
   HEALTHCHECK
================================================== */
app.get("/", (req, res) => {
  res.json(safeJson({ status: "ok", name: "MoneyX CG/CMC API", timestamp: Date.now() }));
});

/* ==================================================
   START SERVER
================================================== */
app.listen(PORT, () =>
  console.log(`MoneyX Market Data API running on port ${PORT} – VOLUME FIXED`)
);
