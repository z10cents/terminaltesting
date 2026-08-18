import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  type JSX,
} from 'solid-js'
import {
  useLocation,
  useNavigate,
  useParams,
} from '@solidjs/router'
import {
  createInfiniteQuery,
  createQuery,
  keepPreviousData,
} from '@tanstack/solid-query'
import {
  api,
  type Event,
  type Market,
  type TraderRanking,
} from './lib/api'
import { kalshiApi, type KalshiEvent, type KalshiMarket } from './lib/kalshi-api'
import { MarketList } from './components/MarketList'
import { MarketDetail } from './components/MarketDetail'
import { TraderList } from './components/TraderList'
import { TraderDetail } from './components/TraderDetail'
import { WalletButton } from './components/WalletButton'
import { KalshiList } from './components/KalshiList'
import { KalshiDetail } from './components/KalshiDetail'
import { initWalletAutoReconnect } from './lib/wallet'

const PAGE_SIZE = 250
const LEADERBOARD_PAGE = 50

type Mode = 'markets' | 'traders' | 'kalshi'

export default function Shell(props: { children?: JSX.Element }) {
  void props
  const location = useLocation()
  const params = useParams<{ slug?: string; addr?: string }>()
  const navigate = useNavigate()

  initWalletAutoReconnect()

  const mode = (): Mode =>
    location.pathname.startsWith('/kalshi')
      ? 'kalshi'
      : location.pathname.startsWith('/trader')
      ? 'traders'
      : 'markets'

  // Whether we're on a detail page (shows detail, not list)
  const onDetail = () =>
    location.pathname.startsWith('/market/') ||
    location.pathname.startsWith('/trader/') ||
    location.pathname.startsWith('/kalshi/market/')

  // --- markets state ---
  const [filter, setFilter] = createSignal('')
  const [debouncedFilter, setDebouncedFilter] = createSignal('')

  createEffect(() => {
    const f = filter().trim()
    const t = window.setTimeout(() => setDebouncedFilter(f), 200)
    onCleanup(() => window.clearTimeout(t))
  })

  const searching = () =>
    debouncedFilter().length > 0 && mode() === 'markets'

  const eventsQuery = createInfiniteQuery(() => ({
    queryKey: ['events'],
    queryFn: ({ pageParam, signal }) =>
      api.eventsPage(pageParam, PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    staleTime: 60_000,
    refetchInterval: false,
    maxPages: 20,
  }))

  const searchQuery = createQuery(() => ({
    queryKey: ['search', debouncedFilter()],
    queryFn: ({ signal }) =>
      api.searchEvents(debouncedFilter(), 1, 40, signal),
    enabled: searching(),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  }))

  const browsingEvents = createMemo<Event[]>(() =>
    (eventsQuery.data?.pages ?? []).flat()
  )
  const rawEvents = createMemo<Event[]>(() =>
    searching() ? (searchQuery.data?.events ?? []) : browsingEvents()
  )
  const events = createMemo<Event[]>(() =>
    rawEvents()
      .map((e) => ({
        ...e,
        markets: e.markets.filter(
          (m) => m.enableOrderBook && !m.closed && m.clobTokenIds.length > 0
        ),
      }))
      .filter((e) => e.markets.length > 0)
  )
  const flatMarkets = createMemo<Market[]>(() =>
    events().flatMap((e) => e.markets)
  )

  const marketSlugQuery = createQuery(() => ({
    queryKey: ['market-by-slug', params.slug],
    queryFn: ({ signal }) => api.getMarketBySlug(params.slug!, signal),
    enabled: !!params.slug,
    staleTime: 5 * 60_000,
  }))

  const selectedMarket = createMemo<Market | undefined>(() => {
    const slug = params.slug
    if (!slug) return undefined
    const inList = flatMarkets().find((m) => m.slug === slug)
    return inList ?? marketSlugQuery.data ?? undefined
  })

  const selectedEvent = createMemo(() => {
    const m = selectedMarket()
    if (!m) return undefined
    return events().find((e) => e.markets.some((x) => x.id === m.id))
  })

  const loadMore = () => {
    if (!searching() && eventsQuery.hasNextPage && !eventsQuery.isFetchingNextPage) {
      eventsQuery.fetchNextPage()
    }
  }

  // --- traders state ---
  const [traderFilter, setTraderFilter] = createSignal('')
  const [period, setPeriod] = createSignal<'day' | 'week' | 'month' | 'all'>('week')
  const [orderBy, setOrderBy] = createSignal<'pnl' | 'vol'>('pnl')

  const leaderboardQuery = createInfiniteQuery(() => ({
    queryKey: ['leaderboard', period(), orderBy()],
    queryFn: ({ pageParam, signal }) =>
      api.leaderboard(
        { period: period(), orderBy: orderBy(), limit: LEADERBOARD_PAGE, offset: pageParam },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < LEADERBOARD_PAGE) return undefined
      const next = allPages.length * LEADERBOARD_PAGE
      return next >= 1000 ? undefined : next
    },
    enabled: mode() === 'traders',
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    maxPages: 20,
  }))

  const traders = createMemo<TraderRanking[]>(() =>
    (leaderboardQuery.data?.pages ?? []).flat()
  )

  const selectedTrader = createMemo<TraderRanking | undefined>(() => {
    const addr = params.addr
    if (!addr) return undefined
    const found = traders().find(
      (t) => t.proxyWallet.toLowerCase() === addr.toLowerCase()
    )
    if (found) return found
    return {
      rank: '—',
      proxyWallet: addr,
      userName: null,
      vol: 0,
      pnl: 0,
      profileImage: null,
      xUsername: null,
      verifiedBadge: null,
    }
  })

  const loadMoreTraders = () => {
    if (leaderboardQuery.hasNextPage && !leaderboardQuery.isFetchingNextPage) {
      leaderboardQuery.fetchNextPage()
    }
  }

  // --- kalshi state ---
  const [kalshiFilter, setKalshiFilter] = createSignal('')

  const kalshiEventsQuery = createInfiniteQuery(() => ({
    queryKey: ['kalshi-events'],
    queryFn: ({ pageParam, signal }) =>
      kalshiApi.events(pageParam as string | undefined, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.cursor ?? undefined,
    enabled: mode() === 'kalshi',
    staleTime: 60_000,
    maxPages: 40,
  }))

  const kalshiEvents = createMemo<KalshiEvent[]>(() =>
    (kalshiEventsQuery.data?.pages ?? []).flatMap((p) => p.events)
  )

  const kalshiMarkets = createMemo<KalshiMarket[]>(() =>
    kalshiEvents().flatMap((e) => e.markets)
  )

  const selectedKalshiTicker = () =>
    location.pathname.startsWith('/kalshi/market/')
      ? decodeURIComponent(location.pathname.replace('/kalshi/market/', ''))
      : undefined

  const selectedKalshiMarket = createMemo<KalshiMarket | undefined>(() => {
    const ticker = selectedKalshiTicker()
    if (!ticker) return undefined
    return kalshiMarkets().find((m) => m.ticker === ticker)
  })

  const loadMoreKalshi = () => {
    if (kalshiEventsQuery.hasNextPage && !kalshiEventsQuery.isFetchingNextPage) {
      kalshiEventsQuery.fetchNextPage()
    }
  }

  // Count for header
  const headerCount = () =>
    mode() === 'kalshi'
      ? `${kalshiEvents().length} events · ${kalshiMarkets().length} markets`
      : mode() === 'markets'
      ? `${events().length} events · ${flatMarkets().length} markets`
      : `${traders().length} traders`

  // Search ref for "/" shortcut
  let searchInputRef: HTMLInputElement | undefined
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        !!t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === 'Escape' && typing) { ;(t as HTMLElement).blur(); return }
      if (typing) return
      if (e.key === '/') { e.preventDefault(); searchInputRef?.focus() }
    }
    window.addEventListener('keydown', handler)
    onCleanup(() => window.removeEventListener('keydown', handler))
  })

  const isLoading = () =>
    mode() === 'markets'
      ? searching() ? searchQuery.isPending : eventsQuery.isPending && !eventsQuery.data
      : mode() === 'traders'
      ? leaderboardQuery.isPending && !leaderboardQuery.data
      : kalshiEventsQuery.isPending && !kalshiEventsQuery.data

  return (
    <div class="min-h-screen bg-bg">
      {/* ── Sticky header ── */}
      <header class="sticky top-0 z-40 bg-panel shadow-sm" style={{ 'border-bottom': '1px solid var(--color-border-2)' }}>
        {/* Top bar */}
        <div class="flex h-14 items-center justify-between px-5">
          <div class="flex items-center gap-4">
            <img
              src="/classified-nav-lockup-dark.svg"
              alt="classified.ai"
              class="h-5 w-auto object-contain"
            />
            <span class="h-4 w-px bg-border-2" />
            <div class="flex items-center gap-1 text-[11px] text-text-dim">
              <span class="live-dot inline-block h-1.5 w-1.5 rounded-full bg-up" />
              <span class="tabular-nums">{headerCount()}</span>
              <Show when={isLoading()}>
                <span class="ml-1">· loading…</span>
              </Show>
            </div>
          </div>
          <WalletButton />
        </div>

        {/* Tab bar */}
        <div
          class="flex h-9 items-center gap-0 border-t px-4"
          style={{ 'border-color': 'var(--color-border)' }}
        >
          <NavTab label="Markets" active={mode() === 'markets'} onClick={() => navigate('/markets')} />
          <NavTab label="Traders" active={mode() === 'traders'} onClick={() => navigate('/traders')} />
          <NavTab label="Kalshi" active={mode() === 'kalshi'} onClick={() => navigate('/kalshi')} />
        </div>
      </header>

      {/* ── Page content ── */}
      <div class="mx-auto max-w-[920px] px-5 py-6">

        {/* Markets list */}
        <Show when={mode() === 'markets' && !onDetail()}>
          <MarketList
            ref={(el) => (searchInputRef = el)}
            events={events()}
            onSelect={(m) => navigate(`/market/${m.slug}`)}
            filter={filter()}
            onFilterChange={setFilter}
            hasMore={!searching() && !!eventsQuery.hasNextPage}
            loadingMore={eventsQuery.isFetchingNextPage}
            onLoadMore={loadMore}
            searching={searching()}
          />
        </Show>

        {/* Market detail */}
        <Show when={mode() === 'markets' && !!params.slug}>
          <div
            class="mb-3 flex items-center gap-2 text-[12px] text-text-dim"
            style={{ cursor: 'default' }}
          >
            <button
              onClick={() => navigate('/markets')}
              class="flex items-center gap-1 hover:text-text-bright"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              ← All Markets
            </button>
            <Show when={selectedEvent()}>
              <span>·</span>
              <span class="truncate text-text-bright">{selectedEvent()?.title}</span>
            </Show>
          </div>
          <Show
            when={selectedMarket()}
            fallback={
              <div class="flex h-40 items-center justify-center text-[12px] text-text-dim">
                <Show when={!marketSlugQuery.isLoading} fallback="loading…">
                  market not found
                </Show>
              </div>
            }
          >
            {(m) => <MarketDetail market={m()} event={selectedEvent()} />}
          </Show>
        </Show>

        {/* Traders list */}
        <Show when={mode() === 'traders' && !onDetail()}>
          <TraderList
            ref={(el) => (searchInputRef = el)}
            traders={traders()}
            loading={isLoading()}
            period={period()}
            orderBy={orderBy()}
            onPeriodChange={setPeriod}
            onOrderByChange={setOrderBy}
            selectedWallet={undefined}
            onSelect={(t) => navigate(`/trader/${t.proxyWallet}`)}
            filter={traderFilter()}
            onFilterChange={setTraderFilter}
            hasMore={!!leaderboardQuery.hasNextPage}
            loadingMore={leaderboardQuery.isFetchingNextPage}
            onLoadMore={loadMoreTraders}
          />
        </Show>

        {/* Trader detail */}
        <Show when={mode() === 'traders' && !!params.addr}>
          <div class="mb-3">
            <button
              onClick={() => navigate('/traders')}
              class="text-[12px] text-text-dim hover:text-text-bright"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              ← All Traders
            </button>
          </div>
          <Show when={selectedTrader()}>
            {(t) => <TraderDetail trader={t()} />}
          </Show>
        </Show>

        {/* Kalshi list */}
        <Show when={mode() === 'kalshi' && !onDetail()}>
          <KalshiList
            ref={(el) => (searchInputRef = el)}
            events={kalshiEvents()}
            onSelect={(m) => navigate(`/kalshi/market/${encodeURIComponent(m.ticker)}`)}
            filter={kalshiFilter()}
            onFilterChange={setKalshiFilter}
            hasMore={!!kalshiEventsQuery.hasNextPage}
            loadingMore={
              kalshiEventsQuery.isFetchingNextPage ||
              (kalshiEventsQuery.isPending && kalshiEvents().length === 0)
            }
            onLoadMore={loadMoreKalshi}
          />
        </Show>

        {/* Kalshi detail */}
        <Show when={mode() === 'kalshi' && !!selectedKalshiTicker()}>
          <div class="mb-3">
            <button
              onClick={() => navigate('/kalshi')}
              class="text-[12px] text-text-dim hover:text-text-bright"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            >
              ← All Kalshi Markets
            </button>
          </div>
          <Show
            when={selectedKalshiMarket()}
            fallback={
              <div class="flex h-40 items-center justify-center text-[12px] text-text-dim">
                <Show when={!kalshiEventsQuery.isPending} fallback="loading…">
                  market not found
                </Show>
              </div>
            }
          >
            {(m) => (
              <div class="card overflow-hidden">
                <KalshiDetail market={m()} />
              </div>
            )}
          </Show>
        </Show>

      </div>
    </div>
  )
}

function NavTab(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      class="relative mr-1 px-3 py-2 text-[12px] font-medium transition-colors"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: props.active
          ? 'var(--color-text-bright)'
          : 'var(--color-text-dim)',
        'border-bottom': props.active
          ? '2px solid var(--color-text-bright)'
          : '2px solid transparent',
        'margin-bottom': '-1px',
      }}
    >
      {props.label}
    </button>
  )
}
