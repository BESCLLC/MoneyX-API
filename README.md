📘 MoneyX Perpetual Exchange — Public Market Data API

Version 1.0
For CoinGecko, CoinMarketCap & GeckoTerminal Integration

📄 Documentation
https://github.com/BESCLLC/MoneyX-API/README.md

📊 Stats Dashboard
https://stats.moneyxpro.com

🌐 Base API URL
https://api.moneyxpro.com


🔗 Available Endpoints

Feature	Endpoint
Contracts	https://api.moneyxpro.com/contracts
Contract Specs	https://api.moneyxpro.com/contract_specs
Orderbook	https://api.moneyxpro.com/orderbook?ticker_id=BTC-PERP
MONEY Supply	https://api.moneyxpro.com/supply/money
Healthcheck	https://api.moneyxpro.com/health

All endpoints require:
	•	❌ No API key
	•	❌ No authentication
	•	🔓 Fully public
	•	⚡ Updated directly from on-chain data


📌 Overview

MoneyX is a decentralized perpetual futures exchange deployed on the Binance Smart Chain (BSC).
This API is designed to fully comply with:
	•	CoinGecko Derivatives Exchange Standard (2024)
	•	CoinMarketCap Derivatives Exchange Format
	•	GeckoTerminal Market Aggregation Requirements

This API provides real-time derivatives market data:
	•	Oracle index prices (30-decimals)
	•	Synthetic orderbook depth
	•	Open interest (long + short)
	•	24h high, low & volume (from subgraph)
	•	Funding rates
	•	Contract metadata


📈 Supported Perpetual Markets

Market	Ticker
BTC / USD	BTC-PERP
ETH / USD	ETH-PERP
BNB / USD	BNB-PERP
SOL / USD	SOL-PERP
DOGE / USD	DOGE-PERP
XRP / USD	XRP-PERP

All markets are indexed via:
VaultPriceFeed.getPrimaryPrice()
(30-decimal oracle from GMX-architecture)


🔵 1. GET /contracts

Returns complete derivative contract data for all MoneyX perpetual markets.

Endpoint:

GET https://api.moneyxpro.com/contracts

Example Response

[
  {
    "ticker_id": "BTC-PERP",
    "base_currency": "BTC",
    "target_currency": "USD",
    "last_price": 103500.12,
    "base_volume": 2584921,
    "target_volume": 2584921,
    "bid": 103499.12,
    "ask": 103501.12,
    "high": 104200.45,
    "low": 102000.01,
    "product_type": "perpetual",
    "open_interest": 142.45,
    "open_interest_usd": 142.45,
    "index_price": 103500.12,
    "index_name": "BTC-USD Price Feed",
    "index_currency": "USD",
    "funding_rate": 0.0001,
    "next_funding_rate": 0.0001,
    "next_funding_rate_timestamp": 1731540000,
    "contract_type": "vanilla",
    "contract_price": 103500.12,
    "contract_price_currency": "USD"
  }
]

✔️ Fully Meets CMC/CG Requirements

Includes:
	•	Open interest
	•	Prices
	•	Funding
	•	Volume
	•	24h high/low
	•	Contract metadata


🔵 2. GET /contract_specs

Metadata describing each derivative contract.

Endpoint:

GET https://api.moneyxpro.com/contract_specs

Example Response

{
  "BTC-PERP": {
    "contract_type": "vanilla",
    "contract_price_currency": "USD",
    "contract_price": null
  }
}


🔵 3. GET /orderbook?ticker_id=

Synthetic GMX-style 50/50 orderbook for market depth.

Example:

GET https://api.moneyxpro.com/orderbook?ticker_id=BTC-PERP

Example Response

{
  "ticker_id": "BTC-PERP",
  "timestamp": 1731459999000,
  "bids": [[103499, 1.0], [103498, 1.0], ...],
  "asks": [[103501, 1.0], [103502, 1.0], ...]
}

✔️ 50 bids
✔️ 50 asks
✔️ Timestamp included
✔️ Fully compatible with automated CG/CMC ingestion


🔵 4. GET /supply/money

Circulating supply tracking (required by CG/MM).

Endpoint:

GET https://api.moneyxpro.com/supply/money

Response

{
  "total_supply": "1000000000000000000000000",
  "circulating_supply": "1000000000000000000000000",
  "decimals": 18
}


🔵 5. GET /health

System status endpoint.

Endpoint:

GET https://api.moneyxpro.com/health

Example

{
  "status": "ok",
  "timestamp": 1731459999000
}



🛠 Technical Specification

Network: Binance Smart Chain (BSC Mainnet)
Oracles: VaultPriceFeed (GMX-style)
Price Precision: 1e30
Volume Source: Goldsky Subgraph (MoneyX stats)
Orderbook: Synthetic liquidity curve (50x50)
Open Interest: On-chain (Vault)
Hosting: Railway / PM2
Rate Limits: None (unlimited public access)


📌 Reviewer Notes (for CG/CMC Teams)
	•	This is an AMM perpetuals exchange, so orderbook is synthetic (standard for GMX/MUX/Drift-style DEXs).
	•	All endpoints follow CoinGecko 2024 Derivatives API Standard exactly.
	•	Oracle prices come from real on-chain feeds (not hardcoded).
	•	24h volume is subgraph-derived, same as GMX & MUX implementations.
	•	Open interest is pulled from the Vault contract (guaranteedUsd + globalShortSizes).

📞 Support

support@moneyxpro.com

📜 Usage Terms
	•	Free to use
	•	Public access
	•	No uptime guarantee
	•	Intended for analytics & market monitoring
