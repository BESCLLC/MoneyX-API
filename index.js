import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Proper module path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs safely (no Node warnings)
const ReaderABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Reader.json")));
const VaultABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/Vault.json")));
const PriceFeedABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/VaultPriceFeed.json")));
const ERC20ABI = JSON.parse(fs.readFileSync(path.join(__dirname, "abi/ERC20.json")));

const app = express();
const PORT = process.env.PORT || 3001;

// RPC
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

// Addresses
const ADDR = {
  READER: "0x0963B6D4dE8F492c5ea0F37Fef4ABdc723Eb7A40",
  VAULT: "0xeB0E5E1a8500317A1B8fDd195097D5509Ef861de",
  PRICE_FEED: "0x31086dBa211D1e66F51701535AD4C0e0f98A3482",
  MONEY: "0x4fFe5ec4D8B9822e01c9E49678884bAEc17F60D9",
};

// Contract instances
const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);

// Markets
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2a12b9cbfae4f2634d864a1ee1ce3ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170ed0880ac9a755fd29b2688956bd959f933f8", base: "ETH" },
  { id: "BNB-PERP", token: "0xb8c77482e45f1f44de1745f52c74426c631bdd52", base: "BNB" },
  { id: "SOL-PERP", token: "0x570a5d02638f9e7b20dfe31aa15d1d0505afcd6f", base: "SOL" },
  { id: "DOGE-PERP", token: "0xba2ae424d960c26247dd6c32edc70b295c744c43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe", base: "XRP" }
];

// Synthetic orderbook
function makeOB(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    bids.push([Number(price - i), 1.0]);
    asks.push([Number(price + i), 1.0]);
  }
  return { bids, asks };
}

// /contracts
app.get("/contracts", async (req, res) => {
  try {
    const output = [];
    const now = Math.floor(Date.now() / 1000);

    for (const m of MARKETS) {
      const p = await priceFeed.getPrice(m.token, false, false, false);
      const price = Number(p) / 1e30;

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
    res.status(500).json({ error: e.toString() });
  }
});

// /contract_specs
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

// /orderbook
app.get("/orderbook", async (req, res) => {
  const id = req.query.ticker_id;
  const market = MARKETS.find(m => m.id === id);

  if (!market) return res.status(400).json({ error: "Unknown ticker_id" });

  const p = await priceFeed.getPrice(market.token, false, false, false);
  const price = Number(p) / 1e30;

  const { bids, asks } = makeOB(price);

  res.json({
    ticker_id: id,
    timestamp: Date.now(),
    bids,
    asks
  });
});

// /supply/money
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

app.listen(PORT, () =>
  console.log(`MoneyX CG/CMC API running on port ${PORT}`)
);
