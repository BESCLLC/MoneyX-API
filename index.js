import express from "express";
import { ethers, formatUnits } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- SAFE JSON ---------------- */
const safeJson = (obj) =>
  JSON.parse(JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

/* ---------------- Load ABIs ---------------- */
const PriceFeedABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/VaultPriceFeed.json")));
const ERC20ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/ERC20.json")));
const VaultABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Vault.json")));

const app = express();
const PORT = process.env.PORT || 8080;

/* ---------------- Static Dir ---------------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- RPC ---------------- */
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

/* ---------------- ADDRESSES ---------------- */
const ADDR = {
  PRICE_FEED: "0x31086dBa211D1e66F51701535AD4C0e0f98A3482",
  MONEY: "0x4fFe5ec4D8B9822e01c9E49678884bAEc17F60D9",
  VAULT: "0xeB0E5E1a8500317A1B8fDd195097D5509Ef861de",
};

const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);
const vault = new ethers.Contract(ADDR.VAULT, VaultABI, provider);

/* ---------------- MARKETS ---------------- */
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", base: "ETH" },
  { id: "BNB-PERP", token: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", base: "BNB" },
  { id: "SOL-PERP", token: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", base: "SOL" },
  { id: "DOGE-PERP", token: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", base: "XRP" },
];

/* ---------------- ORDERBOOK ---------------- */
function makeOrderbook(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    const step = price * 0.0005 * i;
    bids.push([price - step, 1]);
    asks.push([price + step, 1]);
  }
  return { bids, asks };
}

/* ---------------- OPEN INTEREST ---------------- */
async function getOpenInterest(token) {
  const longOI = await vault.guaranteedUsd(token);
  const shortOI = await vault.globalShortSizes(token);
  return {
    long: Number(formatUnits(longOI, 30)),
    short: Number(formatUnits(shortOI, 30)),
    total: Number(formatUnits(longOI + shortOI, 30)),
  };
}

/* ---------------- SUBGRAPHS ---------------- */
const SUBGRAPHS = {
  STATS:
    "https://api.goldsky.com/api/public/project_clhjdosm96z2v49wghcvog65t/subgraphs/project_clhjdosm96z2v4/moneyx-stats/gn",
  RAW: "https://api.goldsky.com/api/public/project_clhjdosm96z2v49wghcvog65t/subgraphs/moneyx-raw/v1.0.0/gn",
  TRADES:
    "https://api.goldsky.com/api/public/project_clhjdosm96z2v49wghcvog65t/subgraphs/moneyx-trades/v1.0.1/gn",
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

/* ---------------- HIGH / LOW FIXED ---------------- */
async function getHighLow(token) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 86400;

  const q = `
    {
      priceCandles(
        first: 300,
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

  const highs = d.priceCandles.map((c) => Number(formatUnits(c.high, 30)));
  const lows = d.priceCandles.map((c) => Number(formatUnits(c.low, 30)));

  return { high: Math.max(...highs), low: Math.min(...lows) };
}

/* ---------------- FUNDING ---------------- */
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

  return Number(formatUnits(d.fundingRates[0].endFundingRate, 30));
}

/* ---------------- VOLUME FIXED ---------------- */
async function getPerMarket24hVolume(token) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 86400;
  const t = token.toLowerCase();

  const q = `
    {
      volumesA: hourlyVolumeByTokens(
        first: 500,
        where: { tokenA: "${t}", timestamp_gt: ${start} }
      ) { margin swap liquidation mint burn }
      volumesB: hourlyVolumeByTokens(
        first: 500,
        where: { tokenB: "${t}", timestamp_gt: ${start} }
      ) { margin swap liquidation mint burn }
    }
  `;

  const d = await gql(SUBGRAPHS.STATS, q);
  if (!d) return 0;

  let total = 0;
  const add = (r) => {
    total +=
      Number(formatUnits(r.margin || 0, 30)) +
      Number(formatUnits(r.swap || 0, 30)) +
      Number(formatUnits(r.liquidation || 0, 30)) +
      Number(formatUnits(r.mint || 0, 30)) +
      Number(formatUnits(r.burn || 0, 30));
  };

  d.volumesA?.forEach(add);
  d.volumesB?.forEach(add);

  return Math.round(total * 100) / 100;
}

/* ---------------- /contracts API ---------------- */
app.get("/contracts", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const out = [];

    for (const m of MARKETS) {
      const raw = await priceFeed.getPrimaryPrice(m.token, false);
      const price = Number(formatUnits(raw, 30));

      const oi = await getOpenInterest(m.token);
      const hl = await getHighLow(m.token);
      const funding = await getFundingRate(m.token);
      const volume24h = await getPerMarket24hVolume(m.token);

      const spread = price * 0.001;

      out.push({
        ticker_id: m.id,
        base_currency: m.base,
        target_currency: "USD",
        last_price: price,
        base_volume: volume24h,
        target_volume: volume24h,
        bid: price - spread,
        ask: price + spread,
        high: hl.high ?? price,
        low: hl.low ?? price,
        open_interest: oi.total,
        funding_rate: funding,
      });
    }

    res.json(safeJson(out));
  } catch (e) {
    console.error("/contracts error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

/* ---------------- Supply ---------------- */
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

/* ---------------- Healthcheck ---------------- */
app.get("/", (req, res) => {
  res.json({ status: "ok", name: "MoneyX API", t: Date.now() });
});

/* ---------------- Start ---------------- */
app.listen(PORT, () =>
  console.log(`🔥 MoneyX Market Data API running on ${PORT}`)
);
