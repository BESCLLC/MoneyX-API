import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs
const PriceFeedABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/VaultPriceFeed.json")));
const ERC20ABI     = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/ERC20.json")));
const VaultABI     = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Vault.json")));

const app = express();
const PORT = process.env.PORT || 8080;

// Serve public folder (for contract-specs.html)
app.use(express.static(path.join(__dirname, "public")));

// BSC RPC
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

// Contract addresses
const ADDR = {
  PRICE_FEED: "0x31086dBa211D1e66F51701535AD4C0e0f98A3482",
  MONEY:      "0x4fFe5ec4D8B9822e01c9E49678884bAEc17F60D9",
  VAULT:      "0xeB0E5E1a8500317A1B8fDd195097D5509Ef861de"
};

const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money     = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);
const vault     = new ethers.Contract(ADDR.VAULT, VaultABI, provider);

// Market mapping
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", base: "ETH" },
  { id: "BNB-PERP", token: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", base: "BNB" },
  { id: "SOL-PERP", token: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", base: "SOL" },
  { id: "DOGE-PERP", token: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", base: "XRP" },
];

// Synthetic orderbook
function makeOB(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    bids.push([price - i, 1]);
    asks.push([price + i, 1]);
  }
  return { bids, asks };
}

// REAL ON-CHAIN OPEN INTEREST
async function getOpenInterest(token) {
  const longOI  = await vault.guaranteedUsd(token);
  const shortOI = await vault.globalShortSizes(token);

  return {
    long: Number(longOI) / 1e30,
    short: Number(shortOI) / 1e30
  };
}

// CONTRACTS — MAIN CMC/CG ENDPOINT
app.get("/contracts", async (req, res) => {
  try {
    const now = Math.floor(Date.now() / 1000);
    const out = [];

    for (const m of MARKETS) {
      const raw = await priceFeed.getPrimaryPrice(m.token, false);
      const price = Number(raw) / 1e30;

      // Pull live OI
      const oi = await getOpenInterest(m.token);
      const openInterestUsd = oi.long + oi.short;

      out.push({
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

        // REAL VALUES
        open_interest: openInterestUsd,
        open_interest_usd: openInterestUsd,

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

    res.json(out);
  } catch (e) {
    console.error("CONTRACTS ERROR:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// CONTRACT SPECS JSON
app.get("/contract_specs", (req, res) => {
  const out = {};
  for (const m of MARKETS) {
    out[m.id] = {
      contract_type: "vanilla",
      contract_price_currency: "USD",
      contract_price: null
    };
  }
  res.json(out);
});

// CONTRACT SPECS HTML PAGE
app.get("/contract-specs.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/contract-specs.html"));
});

// ORDERBOOK
app.get("/orderbook", async (req, res) => {
  const id = req.query.ticker_id;
  const m = MARKETS.find(x => x.id === id);
  if (!m) return res.status(400).json({ error: "Unknown ticker_id" });

  const raw = await priceFeed.getPrimaryPrice(m.token, false);
  const price = Number(raw) / 1e30;

  const { bids, asks } = makeOB(price);

  res.json({
    ticker_id: id,
    timestamp: Date.now(),
    bids,
    asks
  });
});

// SUPPLY
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
    res.status(500).json({ error: e.toString() });
  }
});

// HEALTHCHECK
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    name: "MoneyX CG/CMC API",
    timestamp: Date.now()
  });
});

app.listen(PORT, () =>
  console.log(`MoneyX CG/CMC API running on port ${PORT}`)
);
