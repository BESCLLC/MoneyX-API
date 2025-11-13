📘 MoneyX Derivatives Exchange API Documentation

Version 1.0

Public API for CoinGecko, GeckoTerminal, and CoinMarketCap integration.


# 📌 Overview

This API provides price, contract specifications, synthetic orderbooks, and supply data for MoneyX, a decentralized perpetuals exchange deployed on Binance Smart Chain (BSC).

This API is:
	•	Completely public
	•	No authentication required
	•	Updated in real time from on-chain data
	•	Compliant with CoinGecko & CoinMarketCap requirements

Base URL:

https://api.moneyxpro.com


# 📈 Supported Perpetual Markets

Market	Contract
BTC/USD	BTC-PERP
ETH/USD	ETH-PERP
BNB/USD	BNB-PERP
SOL/USD	SOL-PERP
DOGE/USD	DOGE-PERP
XRP/USD	XRP-PERP


# 🔵 1. /contracts

Returns full derivative contract data for all perpetual markets.

Endpoint

GET /contracts

Response Example

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

All fields comply with CoinGecko Derivatives Exchange Specifications.


# 🔵 2. /contract_specs

Provides contract-level metadata (type, pricing model).

Endpoint

GET /contract_specs

Response Example

{
  "BTC-PERP": {
    "contract_type": "vanilla",
    "contract_price_currency": "USD",
    "contract_price": null
  }
}


# 🔵 3. /orderbook?ticker_id=XYZ-PERP

Returns 50 bid and 50 ask levels (required depth for CG/CMC).
MoneyX uses AMM pricing, so this is a synthetic orderbook (standard for GMX/MUX/Drift).

Example

GET /orderbook?ticker_id=BTC-PERP

Response Sample

{
  "ticker_id": "BTC-PERP",
  "timestamp": 1731459999000,
  "bids": [[103499, 1.0], [103498, 1.0], ...],
  "asks": [[103501, 1.0], [103502, 1.0], ...]
}


# 🔵 4. /supply/money

Required by CG + CMC for circulating supply tracking.

Endpoint

GET /supply/money

Response

{
  "total_supply": "1000000000000000000000000",
  "circulating_supply": "1000000000000000000000000",
  "decimals": 18
}


# 🔵 5. /health

Health check endpoint (recommended by CMC reviewers).

Endpoint

GET /health

Response

{
  "status": "ok",
  "timestamp": 1731459999000
}


# ⚙️ Technical Details

Blockchain
	•	Network: BSC Mainnet
	•	Price Source: On-chain getLatestPrimaryPrice() from VaultPriceFeed
	•	Token Prices: 30 decimals (1e30) converted to USD
	•	No Cloudflare blocking

Contact

support@moneyxpro.com

⸻

# 📌 API Usage Terms
	•	Public and free to use
	•	No guarantees on uptime
	•	Intended for market data and tracking
