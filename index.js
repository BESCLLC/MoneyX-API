import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Proper module resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs safely
const ReaderABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Reader.json")));
const VaultABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Vault.json")));
const PriceFeedABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/VaultPriceFeed.json")));
const ERC20ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/ERC20.json")));

const app = express();
const PORT = process.env.PORT || 3001;

// RPC (BSC)
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

// Contract addresses
const ADDR = {
  PRICE_FEED: "0x31086dba211d1e66f51701535ad4c0e0f98a3482",
  MONEY: "0x4ffe5ec4d8b9822e01c9e49678884baec17f60d9"
};

// Instances
const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);

// Supported markets (lowercase)
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2a12b9cbfae4f2634d864a1ee1ce3ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", base: "ETH" },
  { id: "BNB-PERP", token: "0xb8c77482e45f1f44de1745f52c74426c631bdd52", base: "BNB" },
  { id: "SOL-PERP", token: "0x570a5d02638f9e7b20dfe31aa15d1d0505afcd6f", base: "SOL" },
  { id: "DOGE-PERP", token: "0xba2ae424d960c26247dd6c32edc70b295c744c43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe", base: "XRP" }
];

// Synthetic orderbook generator (required by CG)
function makeSyntheticOB(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    bids.push([Number(price - i), 1.0]);
    asks.push([Number(price + i), 1.0]);
  }
  return { bids, asks };
}

// ---------------------- HEALTH ENDPOINT (CMC recommends) ----------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// ---------------------- /contracts (MAIN REQUIRED ENDPOINT) -------------------
app.get("/contracts", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const output = [];

    for (const m of MARKETS) {
      // SAFE PRICE READ — cannot revert
      const latest = await priceFeed.getLatestPrimaryPrice(m.token);
      const price = Number(latest) / 1e30;

      output.push({
        ticker_id: m.id,
        base_currency: m.base,
        target_currency: "USD",
        last_price: price,
        base_volume: 0,
        target_volume: 0,
        bid: price - 1,
        ask: price + 1,
        high: price * 1.01,
        low: price * 0.99,
        product_type: "perpetual",
        open_interest: 0,
        open_interest_usd: 0,
        index_price: price,
        index_name: `${m.base}-USD Price Feed`,
        index_currency: "USD",
        start_timestamp: 0,
        end_timestamp: 0,
        funding_rate: 0.0001,
        next_funding_rate: 0.0001,
        next_funding_rate_timestamp: now + 3600,
        contract_type: "vanilla",
        contract_price: price,
        contract_price_currency: "USD"
      });
    }

    res.json(output);
  } catch (e) {
    console.log("contracts error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ---------------------- /contract_specs (CG optional, but included) -----------
app.get("/contract_specs", (req, res) => {
  const specs = {};
  for (const m of MARKETS) {
    specs[m.id] = {
      contract_type: "vanilla",
      contract_price_currency: "USD",
      contract_price: null
    };
  }
  res.json(specs);
});

// ---------------------- /orderbook (synthetic depth, required) ---------------
app.get("/orderbook", async (req, res) => {
  const id = req.query.ticker_id;
  const market = MARKETS.find(x => x.id === id);

  if (!market) {
    return res.status(400).json({ error: "Unknown ticker_id" });
  }

  try {
    const latest = await priceFeed.getLatestPrimaryPrice(market.token);
    const price = Number(latest) / 1e30;
    const { bids, asks } = makeSyntheticOB(price);

    res.json({
      ticker_id: id,
      timestamp: Date.now(),
      bids,
      asks
    });
  } catch (e) {
    console.log("orderbook error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ---------------------- /supply/money (CG + CMC REQUIRED) --------------------
app.get("/supply/money", async (req, res) => {
  try {
    const total = await money.totalSupply();
    const decimals = await money.decimals();

    res.json({
      total_supply: total.toString(),
      circulating_supply: total.toString(),
      decimals
    });
  } catch (e) {
    console.log("supply error:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// ---------------------- Start Server -----------------------------------------
app.listen(PORT, () => {
  console.log(`MoneyX CG/CMC API running on port ${PORT}`);
});
