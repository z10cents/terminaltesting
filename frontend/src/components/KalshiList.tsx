import { For, Show, createMemo, createSignal } from 'solid-js'
import { type KalshiEvent, type KalshiMarket, fmtKalshiVol } from '../lib/kalshi-api'
import { Avatar } from './Avatar'

type Props = {
  events: KalshiEvent[]
  onSelect: (m: KalshiMarket) => void
  filter: string
  onFilterChange: (v: string) => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  ref?: (el: HTMLInputElement) => void
}

function eventVol(e: KalshiEvent) {
  return e.markets.reduce((s, m) => s + parseFloat(m.volume_24h_fp || '0'), 0)
}

export function KalshiList(props: Props) {
  const [category, setCategory] = createSignal('All')

  const categories = createMemo(() => {
    const cats = new Set<string>()
    props.events.forEach((e) => { if (e.category) cats.add(e.category) })
    return ['All', ...Array.from(cats).sort()]
  })

  const filtered = createMemo<KalshiEvent[]>(() => {
    const q = props.filter.trim().toLowerCase()
    const cat = category()

    let evs = props.events

    if (cat !== 'All') {
      evs = evs.filter((e) => e.category === cat)
    }

    if (q) {
      evs = evs
        .map((e) => {
          const evMatch =
            e.title.toLowerCase().includes(q) ||
            e.event_ticker.toLowerCase().includes(q)
          const matchingMarkets = e.markets.filter(
            (m) =>
              evMatch ||
              m.title.toLowerCase().includes(q) ||
              m.ticker.toLowerCase().includes(q)
          )
          return { ...e, markets: matchingMarkets }
        })
        .filter((e) => e.markets.length > 0)
    }

    return [...evs].sort((a, b) => eventVol(b) - eventVol(a))
  })

  const totalMarkets = createMemo(() =>
    filtered().reduce((n, e) => n + e.markets.length, 0)
  )

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && props.hasMore && !props.loadingMore) {
        props.onLoadMore()
      }
    },
    { rootMargin: '200px' }
  )

  return (
    <div>
      {/* Search bar */}
      <div
        class="mb-3 flex items-center gap-3 rounded-xl border bg-panel px-4 py-2.5"
        style={{ 'border-color': 'var(--color-border-2)' }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="shrink-0 text-text-dim"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search Kalshi events & markets… (/)"
          ref={(el) => props.ref?.(el)}
          value={props.filter}
          onInput={(e) => props.onFilterChange(e.currentTarget.value)}
          class="flex-1 bg-transparent text-[13px] text-text-bright outline-none placeholder:text-text-dimmer"
        />
        <Show when={props.filter}>
          <button
            onClick={() => props.onFilterChange('')}
            class="text-[16px] leading-none text-text-dim hover:text-text-bright"
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ×
          </button>
        </Show>
      </div>

      {/* Category tabs */}
      <Show when={categories().length > 1}>
        <div
          class="mb-3 flex gap-1.5 overflow-x-auto pb-1"
          style={{ 'scrollbar-width': 'none' }}
        >
          <For each={categories()}>
            {(cat) => (
              <button
                onClick={() => setCategory(cat)}
                class="shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
                style={
                  category() === cat
                    ? {
                        background: 'var(--color-text-bright)',
                        color: 'var(--color-panel)',
                        border: '1px solid var(--color-text-bright)',
                        cursor: 'pointer',
                      }
                    : {
                        background: 'var(--color-panel)',
                        color: 'var(--color-text-dim)',
                        border: '1px solid var(--color-border-2)',
                        cursor: 'pointer',
                      }
                }
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Count strip */}
      <div class="mb-3 flex items-center justify-between">
        <span class="eyebrow">
          {filtered().length} events · {totalMarkets()} markets · sorted by 24h vol
        </span>
        <Show when={props.loadingMore}>
          <span class="eyebrow">loading…</span>
        </Show>
      </div>

      {/* Skeleton while first load */}
      <Show when={filtered().length === 0 && props.loadingMore}>
        <div class="space-y-2">
          <For each={Array.from({ length: 6 })}>
            {() => (
              <div class="card overflow-hidden">
                <div class="flex items-center gap-3 px-4 py-3">
                  <div class="skeleton h-9 w-9 shrink-0 rounded-lg" />
                  <div class="flex-1 space-y-2">
                    <div class="skeleton h-3 w-3/5" />
                    <div class="skeleton h-2.5 w-1/4" />
                  </div>
                </div>
                <div class="border-t px-4 py-3" style={{ 'border-color': 'var(--color-border)' }}>
                  <div class="skeleton h-10 w-full" />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Event cards */}
      <div class="space-y-2">
        <For each={filtered()}>
          {(event) => <KalshiEventCard event={event} onSelect={props.onSelect} />}
        </For>
      </div>

      {/* Infinite scroll sentinel */}
      <Show when={props.hasMore || props.loadingMore}>
        <div
          ref={(el) => {
            observer.observe(el)
          }}
          class="mt-4 flex h-10 items-center justify-center"
        >
          <Show when={props.loadingMore}>
            <span class="eyebrow">loading more…</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}

function KalshiEventCard(props: { event: KalshiEvent; onSelect: (m: KalshiMarket) => void }) {
  const totalVol = () => eventVol(props.event)

  return (
    <div class="card overflow-hidden">
      <div
        class="flex items-center gap-3 px-4 py-3"
        style={{ 'border-bottom': '1px solid var(--color-border)' }}
      >
        <Avatar src={undefined} seed={props.event.event_ticker} size="md" />
        <div class="min-w-0 flex-1">
          <div class="truncate text-[13px] font-semibold text-text-bright">
            {props.event.title}
          </div>
          <div class="mt-0.5 flex items-center gap-2 text-[11px] text-text-dim">
            <span class="tabular-nums">{fmtKalshiVol(totalVol())} 24h vol</span>
            <span>·</span>
            <span>{props.event.markets.length} outcomes</span>
            <Show when={props.event.category}>
              <span>·</span>
              <span>{props.event.category}</span>
            </Show>
          </div>
        </div>
      </div>
      <For each={props.event.markets}>
        {(market) => (
          <KalshiMarketRow market={market} onSelect={() => props.onSelect(market)} />
        )}
      </For>
    </div>
  )
}

function KalshiMarketRow(props: { market: KalshiMarket; onSelect: () => void }) {
  const yesPrice = () => parseFloat(props.market.yes_ask_dollars)
  const noPrice = () => parseFloat(props.market.no_ask_dollars)

  return (
    <button
      onClick={props.onSelect}
      class="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      style={{
        border: 'none',
        'border-bottom': '1px solid var(--color-border)',
        background: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = 'none'
      }}
    >
      <span class="min-w-0 flex-1 truncate text-[12px] text-text">
        {props.market.title}
      </span>
      <div class="flex shrink-0 gap-1.5">
        <KPriceBtn
          label="YES"
          price={yesPrice()}
          color="#16a34a"
          bgColor="#f0fdf4"
          borderColor="#bbf7d0"
        />
        <KPriceBtn
          label="NO"
          price={noPrice()}
          color="#dc2626"
          bgColor="#fef2f2"
          borderColor="#fecaca"
        />
      </div>
    </button>
  )
}

function KPriceBtn(props: {
  label: string
  price: number
  color: string
  bgColor: string
  borderColor: string
}) {
  return (
    <div
      class="flex w-[68px] flex-col items-center rounded-lg py-1.5"
      style={{ background: props.bgColor, border: `1px solid ${props.borderColor}` }}
    >
      <span
        class="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: props.color }}
      >
        {props.label}
      </span>
      <span
        class="mt-0.5 text-[13px] font-bold tabular-nums"
        style={{ color: props.color }}
      >
        {isNaN(props.price) ? '—' : `${Math.round(props.price * 100)}¢`}
      </span>
    </div>
  )
}
