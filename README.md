📘 MoneyX Derivatives Exchange — Public API Documentation

Version 1.0
For CoinGecko, GeckoTerminal & CoinMarketCap integration

📄 Public API Docs
https://github.com/BESCLLC/MoneyX-API/edit/main/README.md

Stats Url
https://stats.moneyxpro.com


🔗 API Endpoints (Quick Links)

Contracts
https://api.moneyxpro.com/contracts

Contract Specs
https://api.moneyxpro.com/contract_specs

Orderbook (example)
https://api.moneyxpro.com/orderbook?ticker_id=BTC-PERP

Supply (MONEY)
https://api.moneyxpro.com/supply/money

Healthcheck
https://api.moneyxpro.com/health


📌 Overview

MoneyX is a decentralized derivatives (perpetual futures) exchange deployed on BNB Smart Chain.
This API is built specifically to meet the official CoinGecko and CoinMarketCap Derivatives Exchange specifications.

This API is:
	•	🔓 Completely public
	•	🔑 No authentication required
	•	⚡ Updated live from on-chain price feeds
	•	✔️ Fully compliant with CG/CMC formatting requirements
	•	📡 Hosted at: https://api.moneyxpro.com


📈 Supported Perpetual Markets

Market	Ticker
BTC/USD	BTC-PERP
ETH/USD	ETH-PERP
BNB/USD	BNB-PERP
SOL/USD	SOL-PERP
DOGE/USD	DOGE-PERP
XRP/USD	XRP-PERP


🔵 1. GET /contracts

Returns full derivative contract data for all markets.

Endpoint:
GET https://api.moneyxpro.com/contracts

Response Example:

[
  {
    "ticker_id": "BTC-PERP",
    "base_currency": "BTC",
    "target_currency": "USD",
    "last_price": 103500,
    "base_volume": 0,
    "target_volume": 0,
    "bid": 103499,
    "ask": 103501,
    "high": 104000,
    "low": 102000,
    "product_type": "perpetual",
    "open_interest": 0,
    "open_interest_usd": 0,
    "index_price": 103500,
    "index_name": "BTC-USD Price Feed",
    "index_currency": "USD",
    "start_timestamp": 0,
    "end_timestamp": 0,
    "funding_rate": 0.0001,
    "next_funding_rate": 0.0001,
    "next_funding_rate_timestamp": 1731540000,
    "contract_type": "vanilla",
    "contract_price": 103500,
    "contract_price_currency": "USD"
  }
]

✔️ All mandatory fields included
✔️ Perfect match to CG Derivatives Standard

🔵 2. GET /contract_specs

Contract-level metadata (type, pricing model, currency).

Endpoint:
GET https://api.moneyxpro.com/contract_specs

Response Example:

{
  "BTC-PERP": {
    "contract_type": "vanilla",
    "contract_price_currency": "USD",
    "contract_price": null
  }
}


🔵 3. GET /orderbook?ticker_id=XYZ-PERP

Required 50/50 synthetic orderbook.

Example:
GET https://api.moneyxpro.com/orderbook?ticker_id=BTC-PERP

Response:

{
  "ticker_id": "BTC-PERP",
  "timestamp": 1731459999000,
  "bids": [[103499, 1.0], [103498, 1.0], ...],
  "asks": [[103501, 1.0], [103502, 1.0], ...]
}

✔️ 50 bids and 50 asks
✔️ Required timestamp included
✔️ Standard format used across GMX/MUX/Drift integrations


🔵 4. GET /supply/money

Required for circulating supply tracking.

Endpoint:
GET https://api.moneyxpro.com/supply/money

Response Example:

{
  "total_supply": "1000000000000000000000000",
  "circulating_supply": "1000000000000000000000000",
  "decimals": 18
}


🔵 5. GET /health

Health check endpoint.

Endpoint:
GET https://api.moneyxpro.com/health

Response:

{
  "status": "ok",
  "timestamp": 1731459999000
}


🛠 Technical Details
	•	Network: Binance Smart Chain (BSC Mainnet)
	•	Price Source:
VaultPriceFeed.getPrimaryPrice() — 30-decimal oracle pricing
	•	Orderbook: Synthetic AMM-based depth
	•	Uptime: 24/7 (Railway hosting)
	•	No Cloudflare blocking — compatible with CoinGecko polling
	•	Polling frequency tested: 30s, 1m, 5m, 30m


📌 Reviewer Notes

Please read before evaluating:
	•	MoneyX is a derivatives-only AMM-based perpetuals exchange (GMX-style).
	•	Orderbooks are synthetic, which is standard for perpetual AMM DEXs.
	•	All mandatory fields from CG Derivatives API Standard (2024) are implemented.
	•	All endpoints are public, no-rate-limit, no-auth.
	•	Supply endpoint supports 30-minute polling without restriction.


📨 Contact

support@moneyxpro.com


📜 API Usage Terms
	•	Free and public
	•	No uptime guarantees
	•	Intended for market tracking and analytics
