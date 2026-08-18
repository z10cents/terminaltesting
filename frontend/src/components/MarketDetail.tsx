import { For, Show, createMemo, createSignal } from 'solid-js'
import { createQuery } from '@tanstack/solid-query'
import type { Event, Market, IntervalKey } from '../lib/api'
import { api, INTERVALS } from '../lib/api'
import { createLiveBook, type SortedLevel } from '../lib/stream'
import { favorites } from '../lib/favorites'
import { fmtUSDFull, fmtDate, relativeTime } from '../lib/format'
import { OrderBook } from './OrderBook'
import { PriceChart } from './PriceChart'
import { Avatar } from './Avatar'
import { TradesFeed } from './TradesFeed'
import { TopHolders } from './TopHolders'
import { TradePanel } from './TradePanel'

type Props = {
  market: Market
  event?: Event
}

type RightTab = 'book' | 'tape' | 'holders' | 'trade'
const RIGHT_TABS: { k: RightTab; l: string }[] = [
  { k: 'book', l: 'Book' },
  { k: 'tape', l: 'Tape' },
  { k: 'holders', l: 'Holders' },
  { k: 'trade', l: 'Trade' },
]

export function MarketDetail(props: Props) {
  const [descOpen, setDescOpen] = createSignal(false)
  const [interval, setInterval] = createSignal<IntervalKey>('1w')
  const [rightTab, setRightTab] = createSignal<RightTab>('book')

  const yesToken = () => props.market.clobTokenIds[0]

  const historyQuery = createQuery(() => ({
    queryKey: ['history', yesToken(), interval()],
    queryFn: ({ signal }) => api.getHistory(yesToken()!, interval(), signal),
    enabled: !!yesToken(),
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  }))

  const live = createLiveBook(yesToken)

  const snapshotBookQuery = createQuery(() => ({
    queryKey: ['book', yesToken()],
    queryFn: ({ signal }) => api.getBook(yesToken()!, signal),
    enabled: !!yesToken(),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  }))

  const snapSorted = createMemo<{ bids: SortedLevel[]; asks: SortedLevel[] } | null>(
    () => {
      const b = snapshotBookQuery.data
      if (!b) return null
      const bids = b.bids
        .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
        .sort((x, y) => y.price - x.price)
      const asks = b.asks
        .map((l) => ({ price: Number(l.price), size: Number(l.size) }))
        .sort((x, y) => x.price - y.price)
      return { bids, asks }
    }
  )

  const bidsView = (): SortedLevel[] =>
    live.version() > 0 ? live.bids() : (snapSorted()?.bids ?? [])
  const asksView = (): SortedLevel[] =>
    live.version() > 0 ? live.asks() : (snapSorted()?.asks ?? [])
  const haveBook = () => live.version() > 0 || snapshotBookQuery.data != null

  const bestBid = () => bidsView()[0]?.price ?? props.market.bestBid ?? null
  const bestAsk = () => asksView()[0]?.price ?? props.market.bestAsk ?? null
  const spreadCents = () => {
    const b = bestBid()
    const a = bestAsk()
    if (b == null || a == null) return null
    return (a - b) * 100
  }
  const liveYesPrice = () => {
    const lt = live.lastTrade()?.price
    if (lt != null) return lt
    const b = bestBid()
    const a = bestAsk()
    if (b != null && a != null) return (a + b) / 2
    return props.market.outcomePrices[0] ?? null
  }

  let lastTickKey = ''
  const liveTick = () => {
    const lt = live.lastTrade()
    const b = bestBid()
    const a = bestAsk()
    let t: number
    let p: number | null = null
    if (lt) {
      t = Math.floor(lt.ts / 1000)
      p = lt.price
    } else if (b != null && a != null) {
      t = Math.floor(Date.now() / 1000)
      p = (a + b) / 2
    } else {
      return null
    }
    if (p == null) return null
    const key = `${t}:${p.toFixed(4)}`
    if (key === lastTickKey) return null
    lastTickKey = key
    return { t, p }
  }

  const image = () =>
    props.market.image || props.market.icon || props.event?.image || props.event?.icon

  const yesLabel = () => props.market.outcomes[0] ?? 'YES'
  const noLabel = () => props.market.outcomes[1] ?? 'NO'
  const fav = () => favorites.isMarket(props.market.id)
  const noPrice = () => {
    const y = liveYesPrice()
    return y != null ? 1 - y : null
  }

  return (
    <div>
      {/* Hero card */}
      <div class="card mb-4 overflow-hidden">
        {/* Title row */}
        <div class="flex items-start gap-4 px-5 py-4" style={{ 'border-bottom': '1px solid var(--color-border)' }}>
          <Avatar
            src={image()}
            seed={props.event?.ticker || props.market.question}
            size="lg"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2">
              <h1 class="flex-1 text-[15px] font-bold leading-snug text-text-bright">
                {props.market.question}
              </h1>
              <button
                onClick={() => favorites.toggleMarket(props.market.id)}
                class="mt-0.5 shrink-0 text-[16px] leading-none"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: fav() ? '#f59e0b' : 'var(--color-text-dimmer)',
                }}
                title={fav() ? 'un-favorite (f)' : 'favorite (f)'}
              >
                {fav() ? '★' : '☆'}
              </button>
            </div>
            <Show when={props.event}>
              {(e) => (
                <div class="mt-1 text-[11px] text-text-dim">{e().title}</div>
              )}
            </Show>
            <Show when={props.market.endDate}>
              <div class="mt-1 text-[11px] text-text-dim">
                Closes {fmtDate(props.market.endDate)} · {relativeTime(props.market.endDate)}
              </div>
            </Show>
          </div>

          {/* Live YES/NO price buttons */}
          <div class="flex shrink-0 gap-2">
            <LargePrice
              label={yesLabel()}
              price={liveYesPrice()}
              change={props.market.oneDayPriceChange ?? null}
              color="#16a34a"
              bgColor="#f0fdf4"
              borderColor="#bbf7d0"
            />
            <LargePrice
              label={noLabel()}
              price={noPrice()}
              change={props.market.oneDayPriceChange != null ? -(props.market.oneDayPriceChange) : null}
              color="#dc2626"
              bgColor="#fef2f2"
              borderColor="#fecaca"
            />
          </div>
        </div>

        {/* Stats strip */}
        <div class="grid grid-cols-5" style={{ 'border-bottom': '1px solid var(--color-border)' }}>
          <StatCell label="24h Vol" value={fmtUSDFull(props.market.volume24hr)} />
          <StatCell label="Liquidity" value={fmtUSDFull(props.market.liquidityNum)} />
          <StatCell
            label="Best Bid"
            value={bestBid() != null ? `${(bestBid()! * 100).toFixed(1)}¢` : '—'}
            color="#16a34a"
          />
          <StatCell
            label="Best Ask"
            value={bestAsk() != null ? `${(bestAsk()! * 100).toFixed(1)}¢` : '—'}
            color="#dc2626"
          />
          <StatCell
            label="Spread"
            value={spreadCents() != null ? `${spreadCents()!.toFixed(2)}¢` : '—'}
          />
        </div>

        {/* Live indicator */}
        <Show when={live.connected()}>
          <div
            class="flex h-7 items-center gap-2 px-5 text-[11px] font-medium"
            style={{ color: 'var(--color-up)', background: '#f0fdf4', 'border-bottom': '1px solid #bbf7d0' }}
          >
            <span class="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
            <span>Live order book</span>
            <Show when={live.lastTrade()}>
              {(t) => (
                <span class="ml-2 text-text-dim">
                  Last trade:{' '}
                  <span class="font-semibold tabular-nums" style={{ color: t().side === 'BUY' ? '#16a34a' : '#dc2626' }}>
                    {(t().price * 100).toFixed(1)}¢
                  </span>
                </span>
              )}
            </Show>
          </div>
        </Show>
      </div>

      {/* Chart + right panel */}
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Chart card */}
        <div class="card min-w-0 flex-1 overflow-hidden">
          <div
            class="flex h-10 items-center justify-between gap-3 px-4"
            style={{ 'border-bottom': '1px solid var(--color-border-2)' }}
          >
            <span class="text-[11px] font-medium text-text-dim uppercase tracking-wide">
              {yesLabel()} Price
            </span>
            <div class="segmented">
              <For each={INTERVALS}>
                {(iv) => (
                  <button
                    onClick={() => setInterval(iv.key)}
                    data-active={interval() === iv.key}
                  >
                    {iv.label}
                  </button>
                )}
              </For>
            </div>
          </div>
          <div class="h-72">
            <Show
              when={historyQuery.data?.history?.length ? historyQuery.data.history : undefined}
              keyed
              fallback={
                <div
                  class="flex h-full items-center justify-center text-[12px]"
                  style={{ color: 'var(--color-text-dim)' }}
                >
                  {historyQuery.isLoading ? 'loading chart…' : 'no price history'}
                </div>
              }
            >
              {(history) => <PriceChart data={history} liveTick={liveTick()} />}
            </Show>
          </div>
        </div>

        {/* Right panel: book / tape / holders / trade */}
        <div
          class="card w-full overflow-hidden lg:w-[340px] lg:shrink-0"
          style={{ height: '352px' }}
        >
          <div
            class="flex h-10 items-center justify-between px-3"
            style={{ 'border-bottom': '1px solid var(--color-border-2)' }}
          >
            <div class="segmented">
              <For each={RIGHT_TABS}>
                {(t) => (
                  <button
                    data-active={rightTab() === t.k}
                    onClick={() => setRightTab(t.k)}
                  >
                    {t.l}
                  </button>
                )}
              </For>
            </div>
            <Show when={rightTab() === 'book' && haveBook()}>
              <span class="text-[11px] tabular-nums text-text-dim">
                {bidsView().length}b / {asksView().length}a
              </span>
            </Show>
          </div>
          <div style={{ height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            <Show when={rightTab() === 'book'}>
              <OrderBook bids={bidsView()} asks={asksView()} levels={14} />
            </Show>
            <Show when={rightTab() === 'tape'}>
              <TradesFeed conditionId={props.market.conditionId} />
            </Show>
            <Show when={rightTab() === 'holders'}>
              <TopHolders market={props.market} />
            </Show>
            <Show when={rightTab() === 'trade'}>
              <TradePanel market={props.market} bids={bidsView} asks={asksView} />
            </Show>
          </div>
        </div>
      </div>

      {/* Resolution criteria */}
      <Show when={props.market.description}>
        <div class="card mt-4 overflow-hidden">
          <button
            onClick={() => setDescOpen((v) => !v)}
            class="flex h-10 w-full items-center justify-between px-5 text-left"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              'border-bottom': descOpen() ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span class="text-[12px] font-medium text-text-bright">Resolution Criteria</span>
            <span class="text-[16px] leading-none text-text-dim">
              {descOpen() ? '−' : '+'}
            </span>
          </button>
          <Show when={descOpen()}>
            <div class="max-h-48 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-text">
              <p class="whitespace-pre-wrap">{props.market.description}</p>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function LargePrice(props: {
  label: string
  price: number | null
  change: number | null
  color: string
  bgColor: string
  borderColor: string
}) {
  return (
    <div
      class="flex w-[100px] flex-col items-center rounded-xl py-3"
      style={{
        background: props.bgColor,
        border: `1px solid ${props.borderColor}`,
      }}
    >
      <span
        class="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: props.color }}
      >
        {props.label}
      </span>
      <span
        class="mt-1 text-[20px] font-bold tabular-nums leading-none"
        style={{ color: props.color }}
      >
        {props.price != null ? `${(props.price * 100).toFixed(0)}¢` : '—'}
      </span>
      <Show when={props.change != null && props.change !== 0}>
        <span
          class="mt-1 text-[10px] tabular-nums"
          style={{ color: props.color, opacity: 0.7 }}
        >
          {(props.change! * 100) > 0 ? '+' : ''}{(props.change! * 100).toFixed(1)}%
        </span>
      </Show>
    </div>
  )
}

function StatCell(props: { label: string; value: string; color?: string }) {
  return (
    <div
      class="px-5 py-3"
      style={{ 'border-right': '1px solid var(--color-border)' }}
    >
      <div class="text-[10px] font-medium uppercase tracking-wide text-text-dim">
        {props.label}
      </div>
      <div
        class="mt-1 text-[13px] font-semibold tabular-nums"
        style={{ color: props.color ?? 'var(--color-text-bright)' }}
      >
        {props.value}
      </div>
    </div>
  )
}
