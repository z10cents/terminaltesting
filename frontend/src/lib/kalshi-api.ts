export type KalshiMarket = {
  ticker: string
  event_ticker: string
  series_ticker?: string
  market_type: string
  title: string
  subtitle?: string
  yes_ask_dollars: string
  yes_bid_dollars: string
  no_ask_dollars: string
  no_bid_dollars: string
  last_price_dollars: string
  volume_fp: string
  volume_24h_fp: string
  open_interest_fp: string
  liquidity_dollars?: string
  status: string
  open_time?: string
  close_time?: string
  result?: string
  rules_primary?: string
  can_close_early?: boolean
}

export type KalshiEvent = {
  event_ticker: string
  series_ticker?: string
  title: string
  sub_title?: string
  status: string
  category?: string
  mutually_exclusive?: boolean
  markets: KalshiMarket[]
}

export type KalshiOrderBook = {
  orderbook: {
    yes: [number, number][]
    no: [number, number][]
  }
}

export type KalshiTrade = {
  trade_id: string
  ticker: string
  yes_price: number
  no_price: number
  count: number
  taker_side: 'yes' | 'no'
  created_time: string
}

const BASE = '/api/kalshi'

export const kalshiApi = {
  async events(
    cursor?: string,
    signal?: AbortSignal
  ): Promise<{ events: KalshiEvent[]; cursor?: string }> {
    const url = cursor ? `${BASE}/events?cursor=${encodeURIComponent(cursor)}` : `${BASE}/events`
    const r = await fetch(url, { signal })
    if (!r.ok) throw new Error(`Kalshi events ${r.status}`)
    return r.json()
  },

  async markets(
    cursor?: string,
    signal?: AbortSignal
  ): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    const url = cursor
      ? `${BASE}/markets?cursor=${encodeURIComponent(cursor)}`
      : `${BASE}/markets`
    const r = await fetch(url, { signal })
    if (!r.ok) throw new Error(`Kalshi markets ${r.status}`)
    return r.json()
  },

  async getMarket(ticker: string, signal?: AbortSignal): Promise<KalshiMarket> {
    const r = await fetch(`${BASE}/markets/${encodeURIComponent(ticker)}`, { signal })
    if (!r.ok) throw new Error(`Kalshi market ${r.status}`)
    const data = await r.json()
    return data.market ?? data
  },

  async getBook(ticker: string, signal?: AbortSignal): Promise<KalshiOrderBook> {
    const r = await fetch(`${BASE}/book/${encodeURIComponent(ticker)}`, { signal })
    if (!r.ok) throw new Error(`Kalshi book ${r.status}`)
    return r.json()
  },

  async getTrades(ticker: string, signal?: AbortSignal): Promise<KalshiTrade[]> {
    const r = await fetch(`${BASE}/trades/${encodeURIComponent(ticker)}`, { signal })
    if (!r.ok) throw new Error(`Kalshi trades ${r.status}`)
    const data = await r.json()
    return data.trades ?? []
  },
}

export function fmtKalshiPct(dollars: string | number): string {
  const v = typeof dollars === 'string' ? parseFloat(dollars) : dollars
  return `${Math.round(v * 100)}¢`
}

export function fmtKalshiVol(fp: string | number): string {
  const v = typeof fp === 'string' ? parseFloat(fp) : fp
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
