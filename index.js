import express from "express";
import { ethers } from "ethers";
import ReaderABI from "./abi/Reader.json" assert {type: "json"};
import VaultABI from "./abi/Vault.json" assert {type: "json"};
import PriceFeedABI from "./abi/VaultPriceFeed.json" assert {type: "json"};
import ERC20ABI from "./abi/ERC20.json" assert {type: "json"};

const app = express();
const PORT = process.env.PORT || 3001;

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

// Contract addresses
const ADDR = {
  READER: "0x0963B6D4dE8F492c5ea0F37Fef4ABdc723Eb7A40",
  VAULT: "0xeB0E5E1a8500317A1B8fDd195097D5509Ef861de",
  PRICE_FEED: "0x31086dBa211D1e66F51701535AD4C0e0f98A3482",
  MONEY: "0x4fFe5ec4D8B9822e01c9E49678884bAEc17F60D9",
};

const priceFeed = new ethers.Contract(ADDR.PRICE_FEED, PriceFeedABI, provider);
const money = new ethers.Contract(ADDR.MONEY, ERC20ABI, provider);

// Supported perpetual markets
const MARKETS = [
  { id: "BTC-PERP", token: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", base: "BTC" },
  { id: "ETH-PERP", token: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", base: "ETH" },
  { id: "BNB-PERP", token: "0xB8c77482e45F1F44De1745F52C74426C631bDD52", base: "BNB" },
  { id: "SOL-PERP", token: "0x570A5d02638F9E7b20dfE31aA15d1d0505AFcD6f", base: "SOL" },
  { id: "DOGE-PERP", token: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43", base: "DOGE" },
  { id: "XRP-PERP", token: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", base: "XRP" },
];

function syntheticBook(price) {
  const bids = [], asks = [];
  for (let i = 1; i <= 50; i++) {
    bids.push([Number(price - i), 1.0]);
    asks.push([Number(price + i), 1.0]);
  }
  return { bids, asks };
}

// ---------------------- /contracts ----------------------
app.get("/contracts", async (req, res) => {
  try {
    const results = [];

    for (const m of MARKETS) {
      const p = await priceFeed.getPrice(m.token, false, false, false);
      const price = Number(p) / 1e30;
      const timestamp = Math.floor(Date.now() / 1000);

      results.push({
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
        next_funding_rate_timestamp: timestamp + 3600,
        contract_type: "vanilla",
        contract_price: price,
        contract_price_currency: "USD"
      });
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// ------------------- /contract_specs -------------------
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

// ---------------------- /orderbook ----------------------
app.get("/orderbook", async (req, res) => {
  const id = req.query.ticker_id;
  const market = MARKETS.find(m => m.id === id);
  if (!market) return res.status(400).json({ error: "Invalid ticker_id" });

  const p = await priceFeed.getPrice(market.token, false, false, false);
  const price = Number(p) / 1e30;

  const { bids, asks } = syntheticBook(price);

  res.json({
    ticker_id: id,
    timestamp: Date.now(),
    bids,
    asks
  });
});

// ---------------------- /supply/money -------------------
app.get("/supply/money", async (req, res) => {
  const total = await money.totalSupply();
  const decimals = await money.decimals();

  res.json({
    total_supply: total.toString(),
    circulating_supply: total.toString(),
    decimals
  });
});

// --------------------------------------------------------
app.listen(PORT, () => console.log("MoneyX CG/CMC API running on " + PORT));
