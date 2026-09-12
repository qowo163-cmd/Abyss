import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronRight, CircleDollarSign, ClipboardCheck, HandCoins, Loader2, PackageOpen, Plus, Search, ShoppingBag, Store, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useMembership } from "@/contexts/MembershipContext";
import { useMonsterData } from "@/hooks/useMonsterData";
import type { Monster } from "@/types/monster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMarketplaceListing,
  cancelMarketplaceBuyOrder,
  cancelMarketplaceExchangeListing,
  cancelMarketplaceItemListing,
  getMarketplaceBuyOrders,
  getMarketplaceListings,
  getMarketplacePriceSummaries,
  getMarketplaceTabSettings,
  getMyMarketplace,
  getMyMarketplaceExchanges,
  getMyMarketplaceItems,
  postMarketplaceBuyOrder,
  postMarketplaceListing,
  postMarketplaceSaleOffer,
  postMarketplaceRequest,
  updateMarketplaceSaleOffer,
  updateMarketplaceRequest,
  updateMarketplaceExchangeOffer,
  updateMarketplaceItemRequest,
  type MarketplaceBuyOrder,
  type MarketplaceExchangeMine,
  type MarketplaceItemMine,
  type MarketplaceListing,
  type MarketplaceListingStatus,
  type MarketplaceMine,
  type MarketplacePriceSummary,
  type MarketplaceRequestStatus,
  type MarketplaceTabSettings,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { MarketplaceBuyBoard } from "@/components/MarketplaceBuyBoard";
import { MarketplaceExchangeBoard } from "@/components/MarketplaceExchangeBoard";
import { MarketplaceItemBoard } from "@/components/MarketplaceItemBoard";
import { MarketplaceAveragePrice, MarketplaceMonsterImage } from "@/components/MarketplaceMarketInfo";

type MarketplaceTab = "listings" | "sell" | "buyOrders" | "buy" | "exchange" | "exchangeRegister" | "items" | "inbox" | "myListings";

const DEFAULT_MARKETPLACE_TAB_SETTINGS: MarketplaceTabSettings = {
  sellEnabled: true,
  buyEnabled: true,
  exchangeEnabled: true,
  itemsEnabled: true,
  updatedAt: null,
};

const REQUEST_STATUS_LABEL: Record<MarketplaceRequestStatus, string> = {
  pending: "대기 중",
  accepted: "거래 예약",
  rejected: "거절됨",
  cancelled: "요청 취소",
  completed: "거래 완료",
};

const REQUEST_STATUS_CLASS: Record<MarketplaceRequestStatus, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  accepted: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  rejected: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  cancelled: "border-slate-600 bg-slate-800/80 text-slate-400",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "방금 전" : date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function MonsterMeta({ monster }: { monster: MarketplaceListing["monster"] | MarketplaceBuyOrder["monster"] | Monster }) {
  const level = "level" in monster ? monster.level : `${monster.baseLevel} ~ ${monster.maxLevel}`;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
      {monster.attribute && <span className="rounded border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-cyan-200">{monster.attribute}</span>}
      {"type" in monster && monster.type && <span className="rounded border border-slate-600 bg-slate-800/80 px-2 py-0.5 text-slate-300">{monster.type}</span>}
      {level && <span className="rounded border border-slate-700 bg-slate-900/70 px-2 py-0.5 text-slate-400">Lv. {level}</span>}
    </div>
  );
}

function EmptyListings({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-14 text-center">
      <PackageOpen className="mx-auto h-9 w-9 text-slate-600" />
      <p className="mt-4 font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

type MarketplaceInboxKind = "sellRequest" | "buyOffer" | "exchangeOffer" | "itemRequest";
type MarketplaceOwnListingKind = "sell" | "buy" | "exchange" | "item";

function MarketplaceRequestActions({ status, busy, onAction }: { status: MarketplaceRequestStatus; busy: boolean; onAction: (action: "accept" | "reject" | "complete") => void }) {
  if (status === "pending") return <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => onAction("accept")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Check className="mr-1 h-3 w-3" />수락</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction("reject")} className="border-rose-400/40 text-rose-200 hover:bg-rose-400/10">거절</Button></div>;
  if (status === "accepted") return <Button type="button" size="sm" disabled={busy} onClick={() => onAction("complete")} className="mt-3 bg-emerald-400 text-slate-950 hover:bg-emerald-300"><Check className="mr-1 h-3 w-3" />거래 완료 처리</Button>;
  return null;
}

function MarketplaceInboxPanel({ mine, exchanges, items, pendingAction, onAction }: { mine: MarketplaceMine; exchanges: MarketplaceExchangeMine; items: MarketplaceItemMine; pendingAction: string | null; onAction: (kind: MarketplaceInboxKind, id: string, action: "accept" | "reject" | "complete") => void }) {
  const entries = [
    ...mine.requests.selling.map((request) => ({ kind: "sellRequest" as const, id: request.id, status: request.status, title: `판매 요청 · ${request.listing.monster.name}`, detail: `${request.buyerGameNickname}님 · ${formatNumber(request.requestedQuantity)}마리 · 자사 ${formatNumber(request.requestedPriceBoxes)}개`, message: request.message })),
    ...mine.saleOffers.received.map((offer) => ({ kind: "buyOffer" as const, id: offer.id, status: offer.status, title: `구매글 판매 제안 · ${offer.buyOrder.monster.name}`, detail: `${offer.sellerGameNickname}님 · ${formatNumber(offer.offeredQuantity)}마리 · 자사 ${formatNumber(offer.offeredPriceBoxes)}개`, message: offer.message })),
    ...exchanges.received.map((offer) => ({ kind: "exchangeOffer" as const, id: offer.id, status: offer.status, title: `교환 제안 · ${offer.offered.monster.name}`, detail: `${offer.proposerGameNickname}님이 ${offer.offered.monster.name} ${formatNumber(offer.offered.quantity)}마리를 제안했습니다.`, message: offer.message })),
    ...items.received.map((request) => ({ kind: "itemRequest" as const, id: request.id, status: request.status, title: `아이템 요청 · ${request.listing?.itemName || "아이템"}`, detail: `${request.requesterGameNickname}님 · ${formatNumber(request.requestedQuantity)}개 요청`, message: request.message })),
  ].sort((left, right) => Number(right.status === "pending") - Number(left.status === "pending"));

  return <section className="py-6"><div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-slate-900 to-slate-950 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold text-amber-200">거래 요청함</p><h3 className="mt-1 text-xl font-black text-white">받은 요청을 한곳에서 확인하세요</h3><p className="mt-1 text-sm text-slate-400">판매·구매·교환·아이템 요청을 수락, 거절 또는 완료 처리할 수 있습니다.</p></div><span className="rounded-full border border-amber-300/50 bg-amber-400 px-3 py-1 text-sm font-black text-slate-950">미처리 {formatNumber(entries.filter((entry) => entry.status === "pending").length)}건</span></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{entries.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-10 text-center text-sm text-slate-500 lg:col-span-2">현재 받은 거래 요청이 없습니다.</p> : entries.map((entry) => <article key={`${entry.kind}-${entry.id}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-keep font-bold text-slate-100">{entry.title}</p><p className="mt-1 break-keep text-sm text-slate-400">{entry.detail}</p></div><span className={cn("shrink-0 rounded-full border px-2 py-1 text-xs font-semibold", REQUEST_STATUS_CLASS[entry.status])}>{REQUEST_STATUS_LABEL[entry.status]}</span></div>{entry.message && <p className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-400">“{entry.message}”</p>}<MarketplaceRequestActions status={entry.status} busy={pendingAction === `${entry.kind}-${entry.id}`} onAction={(action) => onAction(entry.kind, entry.id, action)} /></article>)}</div></div></section>;
}

function MarketplaceMyListingsPanel({ mine, exchanges, items, pendingAction, onCancel }: { mine: MarketplaceMine; exchanges: MarketplaceExchangeMine; items: MarketplaceItemMine; pendingAction: string | null; onCancel: (kind: MarketplaceOwnListingKind, id: string) => void }) {
  const entries = [
    ...mine.listings.map((listing) => ({ kind: "sell" as const, id: listing.id, status: listing.status, title: `판매 · ${listing.monster.name}`, detail: `${formatNumber(listing.quantity)}마리 · 자사 ${formatNumber(listing.priceBoxes)}개` })),
    ...mine.buyOrders.map((order) => ({ kind: "buy" as const, id: order.id, status: order.status, title: `구매 · ${order.monster.name}`, detail: `${formatNumber(order.quantity)}마리 · 제시 자사 ${formatNumber(order.offerBoxes)}개` })),
    ...exchanges.listings.map((listing) => ({ kind: "exchange" as const, id: listing.id, status: listing.status, title: `교환 · ${listing.offered.monster.name}`, detail: `내가 줄 헨치 ${listing.offered.monster.name} ${formatNumber(listing.offered.quantity)}마리` })),
    ...items.listings.map((listing) => ({ kind: "item" as const, id: listing.id, status: listing.status, title: `아이템 ${listing.listingType === "sell" ? "판매" : listing.listingType === "buy" ? "구매" : "교환"} · ${listing.itemName}`, detail: `${formatNumber(listing.quantity)}개${listing.priceBoxes === null ? "" : ` · ${listing.priceCurrency === "gp" ? "GP" : "자사"} ${formatNumber(listing.priceBoxes)}${listing.priceCurrency === "gp" ? "" : "개"}`}` })),
  ];
  const statusLabel = (status: MarketplaceListingStatus) => status === "active" ? "등록 중" : status === "reserved" ? "거래 예약" : status === "completed" ? "거래 완료" : "취소됨";
  const statusClass = (status: MarketplaceListingStatus) => status === "active" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : status === "reserved" ? "border-sky-400/30 bg-sky-400/10 text-sky-200" : status === "completed" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-400";
  return <section className="py-6"><div className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-400/10 via-slate-900 to-slate-950 p-5"><div><p className="text-sm font-bold text-cyan-200">내 등록글</p><h3 className="mt-1 text-xl font-black text-white">내 거래글을 빠르게 관리하세요</h3><p className="mt-1 text-sm text-slate-400">판매·구매·교환·아이템 등록글의 현재 상태를 한곳에서 확인하고 등록 중인 글은 취소할 수 있습니다.</p></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{entries.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-10 text-center text-sm text-slate-500 lg:col-span-2">등록한 거래글이 없습니다.</p> : entries.map((entry) => <article key={`${entry.kind}-${entry.id}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-keep font-bold text-slate-100">{entry.title}</p><p className="mt-1 break-keep text-sm text-slate-400">{entry.detail}</p></div><span className={cn("shrink-0 rounded-full border px-2 py-1 text-xs font-semibold", statusClass(entry.status))}>{statusLabel(entry.status)}</span></div>{entry.status === "active" && <Button type="button" size="sm" variant="outline" disabled={pendingAction === `${entry.kind}-${entry.id}`} onClick={() => onCancel(entry.kind, entry.id)} className="mt-3 border-rose-950 bg-rose-700 font-extrabold text-white shadow-lg shadow-rose-950/40 hover:bg-rose-800 hover:text-white focus-visible:ring-rose-400"><X className="mr-1 h-3 w-3" />등록 취소</Button>}</article>)}</div></div></section>;
}

export default function Marketplace() {
  const { member } = useMembership();
  const canRegister = member?.role === "admin" || member?.status === "approved";
  const isAdministrator = member?.role === "admin";
  const monsters = useMonsterData();
  const [tab, setTab] = useState<MarketplaceTab>("listings");
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [priceSummaries, setPriceSummaries] = useState<Record<string, MarketplacePriceSummary>>({});
  const [mine, setMine] = useState<MarketplaceMine>({ listings: [], requests: { selling: [], buying: [] }, buyOrders: [], saleOffers: { received: [], sent: [] } });
  const [exchangeMine, setExchangeMine] = useState<MarketplaceExchangeMine>({ listings: [], received: [], sent: [] });
  const [itemMine, setItemMine] = useState<MarketplaceItemMine>({ listings: [], received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [priceBoxes, setPriceBoxes] = useState("");
  const [note, setNote] = useState("");
  const [requestingListingId, setRequestingListingId] = useState<string | null>(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestMessage, setRequestMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [tabSettings, setTabSettings] = useState<MarketplaceTabSettings>(DEFAULT_MARKETPLACE_TAB_SETTINGS);

  const isMarketplaceTabAvailable = useCallback((marketplaceTab: "sell" | "buy" | "exchange" | "items") => isAdministrator || tabSettings[`${marketplaceTab}Enabled`], [isAdministrator, tabSettings]);

  const refresh = useCallback(async (keyword = query) => {
    try {
      const settingsResponse = await getMarketplaceTabSettings();
      const settings = settingsResponse?.settings || DEFAULT_MARKETPLACE_TAB_SETTINGS;
      setTabSettings(settings);
      const canBrowseSell = isAdministrator || settings.sellEnabled;
      const [market, own, ownExchanges, ownItems] = await Promise.all([
        canBrowseSell ? getMarketplaceListings(keyword) : Promise.resolve({ listings: [] as MarketplaceListing[] }),
        getMyMarketplace(),
        getMyMarketplaceExchanges(),
        getMyMarketplaceItems(),
      ]);
      setListings(market.listings);
      const priceResponse = canBrowseSell ? await getMarketplacePriceSummaries(market.listings.map((listing) => listing.monster.id)) : { prices: [] as MarketplacePriceSummary[] };
      setPriceSummaries(Object.fromEntries(priceResponse.prices.map((summary) => [summary.monsterId, summary])));
      setMine({
        listings: own.listings || [],
        requests: own.requests || { selling: [], buying: [] },
        buyOrders: own.buyOrders || [],
        saleOffers: own.saleOffers || { received: [], sent: [] },
      });
      setExchangeMine({ listings: ownExchanges.listings || [], received: ownExchanges.received || [], sent: ownExchanges.sent || [] });
      setItemMine({ listings: ownItems.listings || [], received: ownItems.received || [], sent: ownItems.sent || [] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거래소 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [isAdministrator, query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/marketplace/events");
    const onMarketplaceChange = () => void refresh();
    source.addEventListener("marketplace", onMarketplaceChange);
    return () => {
      source.removeEventListener("marketplace", onMarketplaceChange);
      source.close();
    };
  }, [refresh]);

  useEffect(() => {
    if (tab === "inbox" || tab === "myListings") return;
    if (isAdministrator) return;
    const currentTabEnabled = tab === "listings" ? tabSettings.sellEnabled : tab === "buyOrders" ? tabSettings.buyEnabled : tab === "exchange" ? tabSettings.exchangeEnabled : tab === "items" ? tabSettings.itemsEnabled : tabSettings.sellEnabled;
    if (currentTabEnabled) return;
    if (tabSettings.sellEnabled) setTab("listings");
    else if (tabSettings.buyEnabled) setTab("buyOrders");
    else if (tabSettings.exchangeEnabled) setTab("exchange");
    else if (tabSettings.itemsEnabled) setTab("items");
  }, [isAdministrator, tab, tabSettings]);

  const matchingMonsters = useMemo(() => {
    const keyword = monsterQuery.trim().toLowerCase();
    if (!keyword) return [];
    return monsters
      .filter((monster) => monster.name.toLowerCase().includes(keyword))
      .sort((left, right) => left.name.localeCompare(right.name, "ko"))
      .slice(0, 40);
  }, [monsterQuery, monsters]);

  const activeMine = mine.listings.filter((listing) => listing.status === "active");
  const reservedMine = mine.listings.filter((listing) => listing.status === "reserved");
  const enteredSaleQuantity = Math.min(9_999, Math.max(1, Number(quantity) || 1));
  const enteredSaleUnitPrice = Math.max(0, Number(priceBoxes) || 0);
  const enteredSaleTotalPrice = enteredSaleUnitPrice * enteredSaleQuantity;
  const hasAvailableMarketplaceTab = isAdministrator || tabSettings.sellEnabled || tabSettings.buyEnabled || tabSettings.exchangeEnabled || tabSettings.itemsEnabled;
  const pendingInboxCount = mine.requests.selling.filter((request) => request.status === "pending").length + mine.saleOffers.received.filter((offer) => offer.status === "pending").length + exchangeMine.received.filter((offer) => offer.status === "pending").length + itemMine.received.filter((request) => request.status === "pending").length;

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    void refresh(query);
  };

  const createListing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMonster) {
      toast.error("판매할 헨치를 검색해 선택해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      await postMarketplaceListing({
        monsterId: selectedMonster.id,
        quantity: Number(quantity),
        unitPriceBoxes: Number(priceBoxes),
        note,
      });
      toast.success("판매글이 거래소에 등록되었습니다.");
      setSelectedMonster(null);
      setMonsterQuery("");
      setQuantity("1");
      setPriceBoxes("");
      setNote("");
      setTab("listings");
      await refresh("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "판매글을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestTrade = async (listingId: string, requestedQuantity: number) => {
    setPendingAction(`request-${listingId}`);
    try {
      await postMarketplaceRequest(listingId, requestedQuantity, requestMessage);
      toast.success("판매자에게 거래 요청을 보냈습니다.");
      setRequestingListingId(null);
      setRequestQuantity("1");
      setRequestMessage("");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거래 요청을 보내지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  };

  const runRequestAction = async (requestId: string, action: "accept" | "reject" | "cancel" | "complete") => {
    setPendingAction(`${action}-${requestId}`);
    try {
      await updateMarketplaceRequest(requestId, action);
      const label = action === "accept" ? "거래 요청을 수락했습니다." : action === "reject" ? "거래 요청을 거절했습니다." : action === "complete" ? "거래를 완료 처리했습니다." : "거래 요청을 취소했습니다.";
      toast.success(label);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거래 상태를 변경하지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  };

  const cancelListing = async (listingId: string) => {
    setPendingAction(`listing-${listingId}`);
    try {
      await cancelMarketplaceListing(listingId);
      toast.success("판매글을 취소했습니다.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "판매글을 취소하지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  };

  const runInboxAction = async (kind: MarketplaceInboxKind, id: string, action: "accept" | "reject" | "complete") => {
    setPendingAction(`${kind}-${id}`);
    try {
      if (kind === "sellRequest") await updateMarketplaceRequest(id, action);
      else if (kind === "buyOffer") await updateMarketplaceSaleOffer(id, action);
      else if (kind === "exchangeOffer") await updateMarketplaceExchangeOffer(id, action);
      else await updateMarketplaceItemRequest(id, action);
      toast.success(action === "accept" ? "거래 요청을 수락했습니다." : action === "reject" ? "거래 요청을 거절했습니다." : "거래를 완료 처리했습니다.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거래 요청 상태를 변경하지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  };

  const cancelOwnListing = async (kind: MarketplaceOwnListingKind, id: string) => {
    setPendingAction(`${kind}-${id}`);
    try {
      if (kind === "sell") await cancelMarketplaceListing(id);
      else if (kind === "buy") await cancelMarketplaceBuyOrder(id);
      else if (kind === "exchange") await cancelMarketplaceExchangeListing(id);
      else await cancelMarketplaceItemListing(id);
      toast.success("등록글을 취소했습니다.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "등록글을 취소하지 못했습니다.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8 md:py-9">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-amber-500/10 px-6 py-7 shadow-2xl shadow-cyan-950/30 md:px-9">
          <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200"><Store className="h-4 w-4" /> 어비스거래소</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">어비스거래소</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">헨치와 아이템의 판매·구매·교환 정보를 확인하고 거래를 관리하세요. 판매·구매 가격 화폐는 <strong className="font-semibold text-amber-200">자사(자동사냥박스)</strong>입니다.</p>
              <div aria-label="거래소 주요 탭" className="mt-5 flex max-w-full gap-3 overflow-x-auto border-b border-slate-800 pb-1 pr-2 [scrollbar-width:thin]">
                {isMarketplaceTabAvailable("sell") && <button type="button" onClick={() => setTab("listings")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "listings" ? "border-cyan-300 text-cyan-200" : "border-transparent text-slate-400 hover:text-slate-200")}><ShoppingBag className="h-4 w-4" />판매중</button>}
                {isMarketplaceTabAvailable("buy") && <button type="button" onClick={() => setTab("buyOrders")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "buyOrders" ? "border-violet-300 text-violet-200" : "border-transparent text-slate-400 hover:text-slate-200")}><HandCoins className="h-4 w-4" />구매중</button>}
                {isMarketplaceTabAvailable("exchange") && <button type="button" onClick={() => setTab("exchange")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "exchange" ? "border-fuchsia-300 text-fuchsia-200" : "border-transparent text-slate-400 hover:text-slate-200")}><ArrowLeftRight className="h-4 w-4" />교환중</button>}
                {isMarketplaceTabAvailable("items") && <button type="button" onClick={() => setTab("items")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "items" ? "border-emerald-300 text-emerald-200" : "border-transparent text-slate-400 hover:text-slate-200")}><PackageOpen className="h-4 w-4" />아이템 거래</button>}
                {canRegister && <button type="button" onClick={() => setTab("sell")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", ["sell", "buy", "exchangeRegister"].includes(tab) ? "border-cyan-300 text-cyan-200" : "border-transparent text-slate-400 hover:text-slate-200")}><Plus className="h-4 w-4" />통합 등록</button>}
                {canRegister && <button type="button" aria-label={`거래 요청함${pendingInboxCount ? ` 미처리 ${pendingInboxCount}건` : ""}`} onClick={() => setTab("inbox")} className={cn("relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "inbox" ? "border-amber-300 text-amber-200" : "border-transparent text-slate-400 hover:text-slate-200")}><ClipboardCheck className="h-4 w-4" />요청함{pendingInboxCount > 0 && <span data-testid="marketplace-inbox-badge" className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full border border-amber-100/70 bg-amber-400 px-1.5 py-0.5 text-[11px] font-black leading-none text-slate-950">{formatNumber(pendingInboxCount)}</span>}</button>}
                {canRegister && <button type="button" onClick={() => setTab("myListings")} className={cn("inline-flex shrink-0 items-center gap-1.5 border-b-2 px-1 pb-2 pt-0.5 text-sm font-bold transition-colors", tab === "myListings" ? "border-sky-300 text-sky-200" : "border-transparent text-slate-400 hover:text-slate-200")}><UserRound className="h-4 w-4" />내 등록글</button>}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-slate-950/50 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-2 text-amber-200"><CircleDollarSign className="h-5 w-5" /><span className="text-sm font-bold">거래 화폐</span></div>
              <p className="mt-1 text-xs text-slate-400">자사 · 자동사냥박스</p>
            </div>
          </div>
        </section>

        <div role="status" className="mt-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-3 text-sm leading-6 text-emerald-100">거래소가 <strong>정식 오픈</strong>되었습니다. 승인된 회원은 판매·구매·교환·아이템 거래글을 등록할 수 있습니다.</div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs text-slate-500">내 판매 중</p><p className="mt-1 text-2xl font-black text-cyan-200">{formatNumber(activeMine.length)}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs text-slate-500">예약 거래</p><p data-testid="reserved-trade-count" className="mt-1 text-2xl font-black tracking-tight text-sky-800">{formatNumber(reservedMine.length)}<span className="ml-1 text-sm font-bold text-slate-600">건</span></p></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs text-slate-500">처리 대기 요청·제안</p><p className="mt-1 text-2xl font-black text-amber-200">{formatNumber(pendingInboxCount)}<span className="ml-1 text-sm font-medium text-slate-500">건</span></p></div>
        </div>

        {canRegister && ["sell", "buy", "exchangeRegister"].includes(tab) && <div className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3"><span className="self-center px-2 text-sm font-semibold text-slate-400">등록 방식</span><Button type="button" size="sm" variant={tab === "sell" ? "default" : "outline"} onClick={() => setTab("sell")}>판매 등록</Button><Button type="button" size="sm" variant={tab === "buy" ? "default" : "outline"} onClick={() => setTab("buy")}>구매 등록</Button><Button type="button" size="sm" variant={tab === "exchangeRegister" ? "default" : "outline"} onClick={() => setTab("exchangeRegister")}>교환 등록</Button></div>}

        {!hasAvailableMarketplaceTab ? <section className="py-10 text-center"><PackageOpen className="mx-auto h-10 w-10 text-slate-600" /><h3 className="mt-4 font-bold text-slate-200">거래소 탭이 모두 일시 중지되었습니다.</h3><p className="mt-2 text-sm text-slate-500">관리자가 사용 전환 후 다시 이용할 수 있습니다.</p></section> : tab === "inbox" ? <MarketplaceInboxPanel mine={mine} exchanges={exchangeMine} items={itemMine} pendingAction={pendingAction} onAction={(kind, id, action) => void runInboxAction(kind, id, action)} /> : tab === "myListings" ? <MarketplaceMyListingsPanel mine={mine} exchanges={exchangeMine} items={itemMine} pendingAction={pendingAction} onCancel={(kind, id) => void cancelOwnListing(kind, id)} /> : tab === "listings" ? (
          <section className="py-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row">
              <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="판매 중인 헨치 이름 검색" className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600" /></div>
              <Button type="submit" className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"><Search className="mr-2 h-4 w-4" />검색</Button>
            </form>

            {loading ? <div className="flex min-h-64 items-center justify-center text-cyan-200"><Loader2 className="mr-2 h-5 w-5 animate-spin" />거래소를 불러오는 중입니다...</div> : listings.length === 0 ? (
              <div className="mt-6"><EmptyListings title="현재 판매 중인 헨치가 없습니다." detail={canRegister ? "원하는 헨치가 없다면 판매 등록 탭에서 첫 판매글을 올려 보세요." : "승인된 회원은 거래글을 등록할 수 있습니다."} action={canRegister ? <Button type="button" onClick={() => setTab("sell")} variant="outline" className="border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/10"><Plus className="mr-2 h-4 w-4" />판매 등록</Button> : undefined} /></div>
            ) : (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {listings.map((listing) => {
                  const isMine = listing.sellerId === member?.id;
                  const showingRequest = requestingListingId === listing.id;
                  const unitBoxes = Math.round(listing.priceBoxes / listing.quantity);
                  const selectedRequestQuantity = Math.min(listing.quantity, Math.max(1, Number(requestQuantity) || 1));
                  const selectedRequestBoxes = unitBoxes * selectedRequestQuantity;
                  return <article key={listing.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 shadow-lg shadow-black/10">
                    <div className="flex gap-4 p-5">
                      <MarketplaceMonsterImage monster={listing.monster} monsters={monsters} />
                      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="truncate text-lg font-bold text-white">{listing.monster.name}</h3><MonsterMeta monster={listing.monster} /></div><span className="whitespace-nowrap text-xs text-slate-500">{formatTime(listing.createdAt)}</span></div>
                        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"><p className="text-[11px] text-slate-500">판매 수량</p><p className="mt-0.5 font-bold text-slate-100">{formatNumber(listing.quantity)}마리</p></div><div className="space-y-2"><MarketplaceAveragePrice summary={priceSummaries[listing.monster.id]} /><div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2"><p className="text-[11px] text-amber-200/60">자사 가격 · 전체</p><p className="mt-0.5 font-bold text-amber-200">{formatNumber(listing.priceBoxes)}개 <span className="text-xs font-medium text-amber-100/70">· 마리당 {formatNumber(unitBoxes)}개</span></p></div></div></div>
                        {listing.note && <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm leading-5 text-slate-400">{listing.note}</p>}
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3"><div className="flex min-w-0 items-center gap-2 text-sm"><UserRound className="h-4 w-4 shrink-0 text-slate-500" /><span className="truncate text-slate-400">판매자</span><strong className="truncate text-slate-200">{listing.sellerGameNickname}</strong><span className="text-xs text-slate-600">({listing.sellerNickname})</span></div>
                          {isMine ? <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200">내 판매글</span> : <Button type="button" size="sm" onClick={() => { setRequestingListingId(showingRequest ? null : listing.id); setRequestQuantity("1"); }} className="bg-amber-400 text-slate-950 hover:bg-amber-300"><ChevronRight className="mr-1 h-4 w-4" />거래 요청</Button>}</div>
                        {showingRequest && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3"><div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end"><div><label className="text-xs font-semibold text-amber-100">요청 수량 <span className="font-normal text-amber-200/60">(1~{formatNumber(listing.quantity)}마리)</span></label><Input type="number" min="1" max={listing.quantity} inputMode="numeric" value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div><div className="rounded-lg border border-amber-400/20 bg-slate-950/60 px-3 py-2 text-sm"><p className="text-amber-100">마리당 자사 {formatNumber(unitBoxes)}개 × {formatNumber(selectedRequestQuantity)}마리</p><p className="mt-0.5 font-bold text-amber-200">총 자사 {formatNumber(selectedRequestBoxes)}개</p></div></div><label className="mt-3 block text-xs font-semibold text-amber-100">판매자에게 전달할 메모 <span className="font-normal text-amber-200/60">(선택)</span></label><Textarea value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} maxLength={300} placeholder="예: 오늘 저녁 9시 이후 거래 가능합니다." className="mt-2 min-h-20 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600" /><div className="mt-2 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setRequestingListingId(null)} className="text-slate-400">취소</Button><Button type="button" size="sm" disabled={pendingAction === `request-${listing.id}`} onClick={() => void requestTrade(listing.id, selectedRequestQuantity)} className="bg-amber-400 text-slate-950 hover:bg-amber-300">{pendingAction === `request-${listing.id}` && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}요청 보내기</Button></div></div>}
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            )}
          </section>
        ) : tab === "exchange" ? (
          <MarketplaceExchangeBoard mode="list" monsters={monsters} onChanged={refresh} />
        ) : tab === "items" ? (
          <MarketplaceItemBoard memberId={member?.id} canRegister={canRegister} onChanged={refresh} />
        ) : tab === "exchangeRegister" ? (
          <MarketplaceExchangeBoard mode="register" monsters={monsters} onChanged={refresh} />
        ) : tab === "buyOrders" ? (
          <MarketplaceBuyBoard mode="orders" monsters={monsters} memberId={member?.id} mine={mine} onChanged={refresh} />
        ) : tab === "buy" ? (
          <MarketplaceBuyBoard mode="register" monsters={monsters} memberId={member?.id} mine={mine} onChanged={refresh} />
        ) : (
          <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <form onSubmit={createListing} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-cyan-200" /><h3 className="font-bold text-white">헨치 판매 등록</h3></div><p className="mt-1 text-sm text-slate-500">마리당 자사 가격을 입력하면 수량을 곱한 전체 가격으로 자동 등록됩니다.</p>
              <div className="mt-5"><label className="text-sm font-semibold text-slate-300">판매할 헨치</label><div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={monsterQuery} onChange={(event) => { setMonsterQuery(event.target.value); setSelectedMonster(null); }} placeholder="헨치 이름을 입력해 검색" className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600" /></div>
                {monsterQuery.trim() && !selectedMonster && <div className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-700 bg-slate-950">{matchingMonsters.length === 0 ? <p className="p-3 text-sm text-slate-500">일치하는 헨치가 없습니다.</p> : matchingMonsters.map((monster) => <button type="button" key={monster.id} onClick={() => { setSelectedMonster(monster); setMonsterQuery(monster.name); }} className="flex w-full items-center justify-between border-b border-slate-800 px-3 py-3 text-left last:border-b-0 hover:bg-slate-900"><span className="font-medium text-slate-200">{monster.name}</span><span className="text-xs text-slate-500">{monster.attribute} · Lv. {monster.baseLevel}~{monster.maxLevel}</span></button>)}</div>}
                {selectedMonster && <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-cyan-100">{selectedMonster.name}</p><MonsterMeta monster={selectedMonster} /></div><button type="button" onClick={() => { setSelectedMonster(null); setMonsterQuery(""); }} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100" aria-label="선택한 헨치 해제"><X className="h-4 w-4" /></button></div></div>}</div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-slate-300">판매 수량 <span className="text-cyan-300">(마리)</span></label><Input type="number" min="1" max="9999" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div><div><label className="text-sm font-semibold text-slate-300">마리당 자사 <span className="text-amber-200">(자동 합산)</span></label><Input type="number" min="1" max="9999999" inputMode="numeric" value={priceBoxes} onChange={(event) => setPriceBoxes(event.target.value)} placeholder="예: 8" className="mt-2 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600" /></div></div>
              <div data-testid="sale-total-price-preview" className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm"><span className="text-amber-100">마리당 자사 {formatNumber(enteredSaleUnitPrice)}개 × {formatNumber(enteredSaleQuantity)}마리</span><strong className="ml-2 text-amber-200">= 전체 자사 {formatNumber(enteredSaleTotalPrice)}개</strong></div>
              <div className="mt-5"><label className="text-sm font-semibold text-slate-300">판매 메모 <span className="font-normal text-slate-500">(선택)</span></label><Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="거래 가능한 시간·장소 등 필요한 내용을 적어 주세요." className="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600" /></div>
              <Button type="submit" disabled={submitting} className="mt-6 w-full bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}판매글 등록</Button>
            </form>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold text-white">내 판매글</h3><p className="mt-1 text-sm text-slate-500">판매 중인 글은 직접 취소할 수 있습니다.</p></div><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{activeMine.length}건 판매 중</span></div>
                <div aria-label="내 판매글 전체 목록" className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto overscroll-contain pr-1">{mine.listings.length === 0 ? <EmptyListings title="등록한 판매글이 없습니다." detail="왼쪽 양식에서 첫 판매글을 등록해 주세요." /> : mine.listings.map((listing) => <div key={listing.id} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-keep font-semibold text-slate-100">{listing.monster.name} <span className="whitespace-nowrap text-sm font-normal text-slate-500">{formatNumber(listing.quantity)}마리</span></p><p className="mt-1 whitespace-nowrap text-sm text-amber-200">자사 {formatNumber(listing.priceBoxes)}개</p></div><span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold", listing.status === "active" ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200" : listing.status === "reserved" ? "border-sky-400/25 bg-sky-400/10 text-sky-200" : "border-slate-700 bg-slate-800 text-slate-400")}>{listing.status === "active" ? "판매 중" : listing.status === "reserved" ? "거래 예약" : listing.status === "completed" ? "완료" : "취소됨"}</span></div>{listing.status === "active" && <Button type="button" size="sm" variant="outline" disabled={pendingAction === `listing-${listing.id}`} onClick={() => void cancelListing(listing.id)} className="mt-3 whitespace-nowrap border-slate-700 text-slate-300 hover:bg-rose-400/10 hover:text-rose-200">{pendingAction === `listing-${listing.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <X className="mr-1 h-3 w-3" />}판매 취소</Button>}</div>)}</div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-amber-200" /><div><h3 className="font-bold text-white">받은 거래 요청</h3><p className="mt-1 text-sm text-slate-500">수락 또는 <strong className="font-semibold text-rose-200">거절</strong>로 요청 상태를 명확히 처리하세요.</p></div></div><div className="mt-4 space-y-3">{mine.requests.selling.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">받은 거래 요청이 없습니다.</p> : mine.requests.selling.slice(0, 10).map((request) => <div key={request.id} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-100">{request.listing.monster.name} · {formatNumber(request.requestedQuantity)}마리 · 자사 {formatNumber(request.requestedPriceBoxes)}개</p><p className="mt-1 text-sm text-slate-400">구매자 <strong className="text-slate-200">{request.buyerGameNickname}</strong> <span className="text-slate-600">({request.buyerNickname})</span></p></div><span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", REQUEST_STATUS_CLASS[request.status])}>{REQUEST_STATUS_LABEL[request.status]}</span></div>{request.message && <p className="mt-2 text-sm text-slate-400">“{request.message}”</p>}{request.status === "pending" && <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={pendingAction === `accept-${request.id}`} onClick={() => void runRequestAction(request.id, "accept")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Check className="mr-1 h-3 w-3" />수락</Button><Button type="button" size="sm" variant="outline" disabled={pendingAction === `reject-${request.id}`} onClick={() => void runRequestAction(request.id, "reject")} className="border-rose-400/40 text-rose-200 hover:bg-rose-400/10">거절</Button></div>}{request.status === "accepted" && <Button type="button" size="sm" disabled={pendingAction === `complete-${request.id}`} onClick={() => void runRequestAction(request.id, "complete")} className="mt-3 bg-emerald-400 text-slate-950 hover:bg-emerald-300"><Check className="mr-1 h-3 w-3" />거래 완료 처리</Button>}</div>)}</div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div><h3 className="font-bold text-white">내 구매 요청</h3><p className="mt-1 text-sm text-slate-500">보낸 거래 요청의 처리 상태를 확인합니다.</p></div><div className="mt-4 space-y-3">{mine.requests.buying.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">보낸 거래 요청이 없습니다.</p> : mine.requests.buying.slice(0, 10).map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div><p className="font-semibold text-slate-100">{request.listing.monster.name} · {formatNumber(request.requestedQuantity)}마리 · 자사 {formatNumber(request.requestedPriceBoxes)}개</p><p className="mt-1 text-xs text-slate-500">판매자 {request.listing.sellerGameNickname}</p></div><div className="flex items-center gap-2"><span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", REQUEST_STATUS_CLASS[request.status])}>{REQUEST_STATUS_LABEL[request.status]}</span>{request.status === "pending" && <Button type="button" size="sm" variant="ghost" disabled={pendingAction === `cancel-${request.id}`} onClick={() => void runRequestAction(request.id, "cancel")} className="text-slate-400 hover:text-rose-200">취소</Button>}</div></div>)}</div>
              </section>
            </div>
          </section>
        )}

        <p className="pb-8 text-center text-xs leading-5 text-slate-600">거래소는 헨치 판매글과 거래 의사를 기록하는 공간입니다. 자사 전달과 인게임 거래는 당사자 간에 직접 완료해 주세요.</p>
      </div>
    </div>
  );
}
