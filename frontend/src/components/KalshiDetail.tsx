import { For, Show, createSignal } from 'solid-js'
import { createQuery } from '@tanstack/solid-query'
import {
  type KalshiMarket,
  type KalshiTrade,
  kalshiApi,
  fmtKalshiPct,
  fmtKalshiVol,
} from '../lib/kalshi-api'

type Props = {
  market: KalshiMarket
}

export function KalshiDetail(props: Props) {
  const [rulesOpen, setRulesOpen] = createSignal(false)

  const bookQuery = createQuery(() => ({
    queryKey: ['kalshi-book', props.market.ticker],
    queryFn: ({ signal }) => kalshiApi.getBook(props.market.ticker, signal),
    refetchInterval: 5_000,
    staleTime: 3_000,
  }))

  const tradesQuery = createQuery(() => ({
    queryKey: ['kalshi-trades', props.market.ticker],
    queryFn: ({ signal }) => kalshiApi.getTrades(props.market.ticker, signal),
    refetchInterval: 10_000,
    staleTime: 5_000,
  }))

  const yesAsk = () => parseFloat(props.market.yes_ask_dollars)
  const yesBid = () => parseFloat(props.market.yes_bid_dollars)
  const noAsk = () => parseFloat(props.market.no_ask_dollars)
  const lastPrice = () => parseFloat(props.market.last_price_dollars)

  const closeDate = () => {
    if (!props.market.close_time) return null
    return new Date(props.market.close_time).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div>
      {/* Hero card */}
      <div class="card mb-4 overflow-hidden">
        {/* Title row */}
        <div
          class="flex items-start gap-4 px-5 py-4"
          style={{ 'border-bottom': '1px solid var(--color-border)' }}
        >
          <div class="min-w-0 flex-1">
            <div class="mb-1 text-[11px] font-medium uppercase tracking-widest text-text-dim">
              {props.market.event_ticker}
            </div>
            <h1 class="text-[16px] font-bold leading-snug text-text-bright">
              {props.market.title}
            </h1>
            <Show when={closeDate()}>
              <div class="mt-1 text-[11px] text-text-dim">Closes {closeDate()}</div>
            </Show>
          </div>

          {/* YES / NO large price buttons */}
          <div class="flex shrink-0 gap-2">
            <LargePrice label="YES" price={yesAsk()} color="#16a34a" bgColor="#f0fdf4" borderColor="#bbf7d0" />
            <LargePrice label="NO" price={noAsk()} color="#dc2626" bgColor="#fef2f2" borderColor="#fecaca" />
          </div>
        </div>

        {/* Stats strip */}
        <div class="grid grid-cols-5" style={{ 'border-bottom': '1px solid var(--color-border)' }}>
          <StatCell label="Yes Ask" value={`${Math.round(yesAsk() * 100)}¢`} color="#16a34a" />
          <StatCell label="Yes Bid" value={`${Math.round(yesBid() * 100)}¢`} />
          <StatCell label="Last" value={lastPrice() > 0 ? fmtKalshiPct(props.market.last_price_dollars) : '—'} />
          <StatCell label="Vol 24h" value={fmtKalshiVol(props.market.volume_24h_fp)} />
          <StatCell label="Open Interest" value={fmtKalshiVol(props.market.open_interest_fp)} />
        </div>

        {/* Status badge */}
        <div class="flex items-center gap-3 px-5 py-2.5">
          <span
            class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={
              props.market.status === 'active'
                ? { background: '#f0fdf4', color: '#16a34a' }
                : { background: 'var(--color-border)', color: 'var(--color-text-dim)' }
            }
          >
            {props.market.status}
          </span>
          <Show when={props.market.volume_fp}>
            <span class="text-[11px] text-text-dim">
              {fmtKalshiVol(props.market.volume_fp)} total vol
            </span>
          </Show>
        </div>
      </div>

      {/* Order book + trades */}
      <div class="flex gap-4 lg:flex-row flex-col">
        {/* Order book */}
        <div class="card flex-1 overflow-hidden">
          <div
            class="flex h-9 items-center justify-between px-4"
            style={{ 'border-bottom': '1px solid var(--color-border)' }}
          >
            <span class="text-[11px] font-semibold uppercase tracking-widest text-text-dim">
              Order Book
            </span>
            <Show when={bookQuery.isFetching}>
              <span class="flex items-center gap-1 text-[10px] text-up">
                <span class="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
                live
              </span>
            </Show>
          </div>
          <Show
            when={bookQuery.data}
            fallback={
              <div class="flex h-40 items-center justify-center text-[12px] text-text-dim">
                {bookQuery.isError ? 'error loading book' : 'loading…'}
              </div>
            }
          >
            {(book) => (
              <div>
                {/* YES side header */}
                <div
                  class="flex h-7 items-center justify-between px-4"
                  style={{ 'border-bottom': '1px solid var(--color-border)', background: '#f0fdf4' }}
                >
                  <span class="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#16a34a' }}>YES</span>
                  <span class="text-[10px] text-text-dim">price · size</span>
                </div>
                <For each={book().orderbook.yes.slice(0, 10).reverse()}>
                  {([price, size]) => <BookRow price={price} size={size} side="yes" />}
                </For>
                {/* NO side header */}
                <div
                  class="flex h-7 items-center justify-between px-4"
                  style={{ 'border-bottom': '1px solid var(--color-border)', 'border-top': '1px solid var(--color-border-2)', background: '#fef2f2' }}
                >
                  <span class="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#dc2626' }}>NO</span>
                  <span class="text-[10px] text-text-dim">price · size</span>
                </div>
                <For each={book().orderbook.no.slice(0, 10)}>
                  {([price, size]) => <BookRow price={price} size={size} side="no" />}
                </For>
              </div>
            )}
          </Show>
        </div>

        {/* Recent trades */}
        <div class="card flex-1 overflow-hidden">
          <div
            class="flex h-9 items-center justify-between px-4"
            style={{ 'border-bottom': '1px solid var(--color-border)' }}
          >
            <span class="text-[11px] font-semibold uppercase tracking-widest text-text-dim">
              Recent Trades
            </span>
            <Show when={tradesQuery.isFetching}>
              <span class="flex items-center gap-1 text-[10px] text-up">
                <span class="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
                live
              </span>
            </Show>
          </div>
          <Show
            when={tradesQuery.data && tradesQuery.data.length > 0}
            fallback={
              <div class="flex h-40 items-center justify-center text-[12px] text-text-dim">
                {tradesQuery.isError
                  ? 'error loading trades'
                  : tradesQuery.isPending
                  ? 'loading…'
                  : 'no recent trades'}
              </div>
            }
          >
            {/* Header row */}
            <div
              class="flex h-7 items-center px-4 text-[10px] uppercase tracking-widest text-text-dim"
              style={{ 'border-bottom': '1px solid var(--color-border)' }}
            >
              <span class="w-12">Side</span>
              <span class="w-14 text-right">Price</span>
              <span class="flex-1 text-right">Qty</span>
              <span class="w-24 text-right">Time</span>
            </div>
            <For each={tradesQuery.data}>
              {(trade) => <TradeRow trade={trade} />}
            </For>
          </Show>
        </div>
      </div>

      {/* Resolution rules */}
      <Show when={props.market.rules_primary}>
        <div
          class="card mt-4 overflow-hidden"
          style={{ cursor: 'pointer' }}
          onClick={() => setRulesOpen((v: boolean) => !v)}
        >
          <div
            class="flex h-10 items-center justify-between px-4"
            style={{
              'border-bottom': rulesOpen() ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span class="text-[12px] font-semibold text-text-bright">Resolution Rules</span>
            <span class="text-[12px] text-text-dim">{rulesOpen() ? '▲' : '▼'}</span>
          </div>
          <Show when={rulesOpen()}>
            <div class="px-4 py-3 text-[12px] leading-relaxed text-text">
              {props.market.rules_primary}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function LargePrice(props: {
  label: string
  price: number
  color: string
  bgColor: string
  borderColor: string
}) {
  return (
    <div
      class="flex w-[100px] flex-col items-center rounded-xl py-3"
      style={{ background: props.bgColor, border: `1px solid ${props.borderColor}` }}
    >
      <span
        class="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: props.color }}
      >
        {props.label}
      </span>
      <span
        class="mt-1 text-[22px] font-bold tabular-nums leading-none"
        style={{ color: props.color }}
      >
        {isNaN(props.price) ? '—' : `${Math.round(props.price * 100)}¢`}
      </span>
    </div>
  )
}

function StatCell(props: { label: string; value: string; color?: string }) {
  return (
    <div
      class="flex flex-col items-center justify-center py-3"
      style={{ 'border-right': '1px solid var(--color-border)' }}
    >
      <span class="text-[10px] uppercase tracking-widest text-text-dim">{props.label}</span>
      <span
        class="mt-0.5 text-[13px] font-semibold tabular-nums"
        style={{ color: props.color ?? 'var(--color-text-bright)' }}
      >
        {props.value}
      </span>
    </div>
  )
}

function BookRow(props: { price: number; size: number; side: 'yes' | 'no' }) {
  return (
    <div
      class="flex h-8 items-center px-4 text-[12px]"
      style={{ 'border-bottom': '1px solid var(--color-border)' }}
    >
      <span
        class="font-semibold tabular-nums"
        style={{ color: props.side === 'yes' ? '#16a34a' : '#dc2626' }}
      >
        {props.price}¢
      </span>
      <span class="ml-auto tabular-nums text-text-dim">{props.size}</span>
    </div>
  )
}

function TradeRow(props: { trade: KalshiTrade }) {
  const time = () => {
    const d = new Date(props.trade.created_time)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }
  const price = () =>
    props.trade.taker_side === 'yes' ? props.trade.yes_price : props.trade.no_price

  return (
    <div
      class="flex h-8 items-center px-4 text-[12px]"
      style={{ 'border-bottom': '1px solid var(--color-border)' }}
    >
      <span
        class="w-12 font-semibold"
        style={{ color: props.trade.taker_side === 'yes' ? '#16a34a' : '#dc2626' }}
      >
        {props.trade.taker_side}
      </span>
      <span class="w-14 tabular-nums text-right text-text-bright">{price()}¢</span>
      <span class="flex-1 tabular-nums text-right text-text">{props.trade.count}</span>
      <span class="w-24 tabular-nums text-right text-text-dim">{time()}</span>
    </div>
  )
}
