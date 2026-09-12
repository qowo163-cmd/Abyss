import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, HandCoins, Loader2, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { Monster } from "@/types/monster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { MarketplaceAveragePrice, MarketplaceMonsterImage } from "@/components/MarketplaceMarketInfo";
import { cn } from "@/lib/utils";
import {
  cancelMarketplaceBuyOrder,
  getMarketplaceBuyOrders,
  getMarketplacePriceSummaries,
  postMarketplaceBuyOrder,
  postMarketplaceSaleOffer,
  updateMarketplaceSaleOffer,
  type MarketplaceBuyOrder,
  type MarketplaceMine,
  type MarketplacePriceSummary,
  type MarketplaceRequestStatus,
} from "@/lib/marketplace";

const statusLabel: Record<MarketplaceRequestStatus, string> = { pending: "대기 중", accepted: "거래 예약", rejected: "거절됨", cancelled: "취소됨", completed: "거래 완료" };
const statusClass: Record<MarketplaceRequestStatus, string> = { pending: "border-amber-400/30 bg-amber-400/10 text-amber-200", accepted: "border-sky-400/30 bg-sky-400/10 text-sky-200", rejected: "border-rose-400/30 bg-rose-400/10 text-rose-200", cancelled: "border-slate-600 bg-slate-800 text-slate-400", completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" };
const formatNumber = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

function orderStatusLabel(status: MarketplaceBuyOrder["status"]) {
  return status === "active" ? "구매 중" : status === "reserved" ? "거래 예약" : status === "completed" ? "완료" : "취소됨";
}

function MonsterSummary({ monster }: { monster: MarketplaceBuyOrder["monster"] | Monster }) {
  const level = "level" in monster ? monster.level : `${monster.baseLevel} ~ ${monster.maxLevel}`;
  return <div className="mt-2 flex flex-wrap gap-1.5 text-xs">{monster.attribute && <span className="rounded border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-violet-200">{monster.attribute}</span>}{"type" in monster && monster.type && <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">{monster.type}</span>}{level && <span className="whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-400">Lv. {level}</span>}</div>;
}

function OfferStatus({ status }: { status: MarketplaceRequestStatus }) {
  return <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold", statusClass[status])}>{statusLabel[status]}</span>;
}

export function MarketplaceBuyBoard({ mode, monsters, memberId, mine, onChanged }: { mode: "orders" | "register"; monsters: Monster[]; memberId?: string; mine: MarketplaceMine; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<MarketplaceBuyOrder[]>([]);
  const [priceSummaries, setPriceSummaries] = useState<Record<string, MarketplacePriceSummary>>({});
  const [loading, setLoading] = useState(true);
  const [monsterQuery, setMonsterQuery] = useState("");
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [boxes, setBoxes] = useState("");
  const [note, setNote] = useState("");
  const [offerOrderId, setOfferOrderId] = useState<string | null>(null);
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [offerMessage, setOfferMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async (keyword = query) => {
    try {
      const response = await getMarketplaceBuyOrders(keyword);
      setOrders(response.buyOrders);
      const priceResponse = await getMarketplacePriceSummaries(response.buyOrders.map((order) => order.monster.id));
      setPriceSummaries(Object.fromEntries(priceResponse.prices.map((summary) => [summary.monsterId, summary])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "구매글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/marketplace/events");
    const refresh = () => void load();
    source.addEventListener("marketplace", refresh);
    return () => { source.removeEventListener("marketplace", refresh); source.close(); };
  }, [load]);

  const matchingMonsters = useMemo(() => {
    const keyword = monsterQuery.trim().toLowerCase();
    return keyword ? monsters.filter((monster) => monster.name.toLowerCase().includes(keyword)).sort((left, right) => left.name.localeCompare(right.name, "ko")).slice(0, 40) : [];
  }, [monsterQuery, monsters]);
  const refreshBoth = async () => { await Promise.all([load(), onChanged()]); };

  const createBuyOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedMonster) return toast.error("구매할 헨치를 검색해 선택해 주세요.");
    setPending("create");
    try {
      await postMarketplaceBuyOrder({ monsterId: selectedMonster.id, quantity: Number(quantity), unitOfferBoxes: Number(boxes), note });
      toast.success("구매글이 등록되었습니다.");
      setSelectedMonster(null); setMonsterQuery(""); setQuantity("1"); setBoxes(""); setNote("");
      await refreshBoth();
    } catch (error) { toast.error(error instanceof Error ? error.message : "구매글을 등록하지 못했습니다."); }
    finally { setPending(null); }
  };
  const sendOffer = async (id: string, quantityToOffer: number) => {
    setPending(`offer-${id}`);
    try { await postMarketplaceSaleOffer(id, quantityToOffer, offerMessage); toast.success("판매 제안을 보냈습니다."); setOfferOrderId(null); setOfferQuantity("1"); setOfferMessage(""); await refreshBoth(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "판매 제안을 보내지 못했습니다."); }
    finally { setPending(null); }
  };
  const cancelOrder = async (id: string) => {
    setPending(`cancel-order-${id}`);
    try { await cancelMarketplaceBuyOrder(id); toast.success("구매글을 취소했습니다."); await refreshBoth(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "구매글을 취소하지 못했습니다."); }
    finally { setPending(null); }
  };
  const updateOffer = async (id: string, action: "accept" | "reject" | "cancel" | "complete") => {
    setPending(`${action}-${id}`);
    try {
      await updateMarketplaceSaleOffer(id, action);
      toast.success(action === "accept" ? "판매 제안을 수락했습니다." : action === "reject" ? "판매 제안을 거절했습니다." : action === "complete" ? "거래를 완료 처리했습니다." : "판매 제안을 취소했습니다.");
      await refreshBoth();
    } catch (error) { toast.error(error instanceof Error ? error.message : "판매 제안 상태를 변경하지 못했습니다."); }
    finally { setPending(null); }
  };

  if (mode === "orders") return <section className="py-6">
    <form onSubmit={(event) => { event.preventDefault(); setLoading(true); void load(query); }} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="구매 중인 헨치 이름 검색" className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600" /></div><Button type="submit" className="whitespace-nowrap bg-violet-400 text-slate-950 hover:bg-violet-300"><Search className="mr-2 h-4 w-4" />검색</Button></form>
    {loading ? <div className="flex min-h-64 items-center justify-center text-violet-200"><Loader2 className="mr-2 h-5 w-5 animate-spin" />구매글을 불러오는 중입니다...</div> : orders.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center text-slate-500">현재 구매 중인 헨치가 없습니다.</div> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map((order) => {
      const isMine = order.buyerId === memberId;
      const showOffer = offerOrderId === order.id;
      const unitBoxes = Math.round(order.offerBoxes / order.quantity);
      const selectedOfferQuantity = Math.min(order.quantity, Math.max(1, Number(offerQuantity) || 1));
      const selectedOfferBoxes = unitBoxes * selectedOfferQuantity;
      return <article key={order.id} className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5"><div className="flex gap-4"><MarketplaceMonsterImage monster={order.monster} monsters={monsters} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-bold text-white">{order.monster.name}</h3><MonsterSummary monster={order.monster} /></div><span className="whitespace-nowrap text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString("ko-KR")}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2"><p className="text-[11px] text-slate-500">구매 희망 수량</p><p className="mt-0.5 whitespace-nowrap font-bold">{formatNumber(order.quantity)}마리</p></div><div className="space-y-2"><MarketplaceAveragePrice summary={priceSummaries[order.monster.id]} accent="violet" /><div className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2"><p className="text-[11px] text-violet-200/60">제시 자사 · 전체</p><p className="mt-0.5 whitespace-nowrap font-bold text-violet-200">{formatNumber(order.offerBoxes)}개 <span className="text-xs font-medium text-violet-100/70">· 마리당 {formatNumber(unitBoxes)}개</span></p></div></div></div>{order.note && <p className="mt-3 break-keep rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">{order.note}</p>}<div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-800 pt-3"><div className="flex min-w-0 items-center gap-2 text-sm"><UserRound className="h-4 w-4 shrink-0 text-slate-500" /><span className="shrink-0 text-slate-400">구매자</span><strong className="truncate">{order.buyerGameNickname}</strong></div>{isMine ? <span className="shrink-0 whitespace-nowrap rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200">내 구매글</span> : <Button type="button" size="sm" onClick={() => { setOfferOrderId(showOffer ? null : order.id); setOfferQuantity("1"); }} className="shrink-0 whitespace-nowrap bg-violet-400 text-slate-950 hover:bg-violet-300"><ChevronRight className="mr-1 h-4 w-4" />판매 제안</Button>}</div>{showOffer && <div className="mt-4 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3"><div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end"><div><label className="text-xs font-semibold text-violet-100">제안 수량 <span className="font-normal text-violet-200/60">(1~{formatNumber(order.quantity)}마리)</span></label><Input type="number" min="1" max={order.quantity} inputMode="numeric" value={offerQuantity} onChange={(event) => setOfferQuantity(event.target.value)} className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div><div className="rounded-lg border border-violet-400/20 bg-slate-950/60 px-3 py-2 text-sm"><p className="text-violet-100">마리당 자사 {formatNumber(unitBoxes)}개 × {formatNumber(selectedOfferQuantity)}마리</p><p className="mt-0.5 font-bold text-violet-200">총 자사 {formatNumber(selectedOfferBoxes)}개</p></div></div><label className="mt-3 block text-xs font-semibold text-violet-100">판매 메모 <span className="font-normal text-violet-200/60">(선택)</span></label><Textarea value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} maxLength={300} placeholder="거래 가능한 시간 등을 적어 주세요." className="mt-2 min-h-20 border-slate-700 bg-slate-950 text-slate-100" /><div className="mt-2 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setOfferOrderId(null)} className="whitespace-nowrap text-slate-400">취소</Button><Button type="button" size="sm" disabled={pending === `offer-${order.id}`} onClick={() => void sendOffer(order.id, selectedOfferQuantity)} className="whitespace-nowrap bg-violet-400 text-slate-950 hover:bg-violet-300">제안 보내기</Button></div></div>}</div></div></article>;
    })}</div>}
  </section>;

  const activeBuyOrderCount = mine.buyOrders.filter((order) => order.status === "active").length;
  const enteredBuyQuantity = Math.min(9_999, Math.max(1, Number(quantity) || 1));
  const enteredBuyUnitPrice = Math.max(0, Number(boxes) || 0);
  const enteredBuyTotalPrice = enteredBuyQuantity * enteredBuyUnitPrice;
  return <section className="grid gap-6 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <form onSubmit={createBuyOrder} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-violet-200" /><h3 className="font-bold text-white">헨치 구매 등록</h3></div><p className="mt-1 text-sm text-slate-500">마리당 제시 자사를 입력하면 수량을 곱한 전체 가격으로 자동 등록됩니다.</p><div className="mt-5"><label className="text-sm font-semibold text-slate-300">구매할 헨치</label><div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={monsterQuery} onChange={(event) => { setMonsterQuery(event.target.value); setSelectedMonster(null); }} placeholder="헨치 이름을 입력해 검색" className="border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600" /></div>{monsterQuery.trim() && !selectedMonster && <div className="mt-2 max-h-72 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-700 bg-slate-950">{matchingMonsters.length === 0 ? <p className="p-3 text-sm text-slate-500">일치하는 헨치가 없습니다.</p> : matchingMonsters.map((monster) => <button type="button" key={monster.id} onClick={() => { setSelectedMonster(monster); setMonsterQuery(monster.name); }} className="flex w-full items-center justify-between gap-3 border-b border-slate-800 px-3 py-3 text-left last:border-b-0 hover:bg-slate-900"><span className="font-medium text-slate-200">{monster.name}</span><span className="whitespace-nowrap text-xs text-slate-500">{monster.attribute} · Lv. {monster.baseLevel}~{monster.maxLevel}</span></button>)}</div>}{selectedMonster && <div className="mt-3 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-violet-100">{selectedMonster.name}</p><MonsterSummary monster={selectedMonster} /></div><button type="button" onClick={() => { setSelectedMonster(null); setMonsterQuery(""); }} className="shrink-0 rounded p-1 text-slate-400" aria-label="선택한 구매 헨치 해제"><X className="h-4 w-4" /></button></div></div>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label className="text-sm font-semibold text-slate-300">구매 수량 <span className="text-violet-300">(마리)</span></label><Input type="number" min="1" max="9999" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div><div><label className="text-sm font-semibold text-slate-300">마리당 제시 자사 <span className="text-violet-200">(자동 합산)</span></label><Input type="number" min="1" max="9999999" value={boxes} onChange={(event) => setBoxes(event.target.value)} placeholder="예: 8" className="mt-2 border-slate-700 bg-slate-950 text-slate-100" /></div></div><div data-testid="buy-total-price-preview" className="mt-3 rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-sm"><span className="text-violet-100">마리당 자사 {formatNumber(enteredBuyUnitPrice)}개 × {formatNumber(enteredBuyQuantity)}마리</span><strong className="ml-2 text-violet-200">= 전체 자사 {formatNumber(enteredBuyTotalPrice)}개</strong></div><div className="mt-5"><label className="text-sm font-semibold text-slate-300">구매 메모 <span className="font-normal text-slate-500">(선택)</span></label><Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} placeholder="원하는 거래 시간·장소 등을 적어 주세요." className="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100" /></div><Button type="submit" disabled={pending === "create"} className="mt-6 w-full whitespace-nowrap bg-violet-400 font-bold text-slate-950 hover:bg-violet-300">{pending === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}구매글 등록</Button></form>
    <div className="space-y-6"><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-white">내 구매글</h3><p className="mt-1 break-keep text-sm text-slate-500">구매 중인 글은 직접 취소할 수 있습니다.</p></div><span className="shrink-0 whitespace-nowrap rounded-full bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">{activeBuyOrderCount}건 구매 중</span></div><ScrollArea aria-label="내 구매글 전체 목록" className="mt-4 h-[28rem] pr-2">{mine.buyOrders.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">등록한 구매글이 없습니다.</p> : <div className="space-y-3 pr-1">{mine.buyOrders.map((order) => <div key={order.id} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-keep font-semibold">{order.monster.name} <span className="whitespace-nowrap text-sm font-normal text-slate-500">{formatNumber(order.quantity)}마리</span></p><p className="mt-1 whitespace-nowrap text-sm text-violet-200">제시 자사 {formatNumber(order.offerBoxes)}개</p></div><span className="shrink-0 whitespace-nowrap rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-1 text-xs text-violet-200">{orderStatusLabel(order.status)}</span></div>{order.status === "active" && <Button type="button" size="sm" variant="outline" disabled={pending === `cancel-order-${order.id}`} onClick={() => void cancelOrder(order.id)} className="mt-3 whitespace-nowrap border-slate-700 text-slate-300 hover:text-rose-200"><X className="mr-1 h-3 w-3" />구매 취소</Button>}</div>)}</div>}</ScrollArea></section><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-violet-200" /><div><h3 className="font-bold text-white">받은 판매 제안</h3><p className="mt-1 break-keep text-sm text-slate-500">수락 또는 거절로 제안 상태를 명확히 처리하세요.</p></div></div><div className="mt-4 space-y-3">{mine.saleOffers.received.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">받은 판매 제안이 없습니다.</p> : mine.saleOffers.received.slice(0, 10).map((offer) => <div key={offer.id} className="rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-keep font-semibold">{offer.buyOrder.monster.name} · 제시 자사 {formatNumber(offer.buyOrder.offerBoxes)}개</p><p className="mt-1 text-sm text-slate-400">판매자 <strong className="text-slate-200">{offer.sellerGameNickname}</strong></p></div><OfferStatus status={offer.status} /></div>{offer.message && <p className="mt-2 break-keep text-sm text-slate-400">“{offer.message}”</p>}{offer.status === "pending" && <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={pending === `accept-${offer.id}`} onClick={() => void updateOffer(offer.id, "accept")} className="whitespace-nowrap bg-violet-400 text-slate-950 hover:bg-violet-300"><Check className="mr-1 h-3 w-3" />수락</Button><Button type="button" size="sm" variant="outline" disabled={pending === `reject-${offer.id}`} onClick={() => void updateOffer(offer.id, "reject")} className="whitespace-nowrap border-rose-400/40 text-rose-200 hover:bg-rose-400/10">거절</Button></div>}{offer.status === "accepted" && <Button type="button" size="sm" disabled={pending === `complete-${offer.id}`} onClick={() => void updateOffer(offer.id, "complete")} className="mt-3 whitespace-nowrap bg-emerald-400 text-slate-950 hover:bg-emerald-300">거래 완료 처리</Button>}</div>)}</div></section><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h3 className="font-bold text-white">내 판매 제안</h3><div className="mt-4 space-y-3">{mine.saleOffers.sent.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-500">보낸 판매 제안이 없습니다.</p> : mine.saleOffers.sent.slice(0, 10).map((offer) => <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="min-w-0"><p className="break-keep font-semibold">{offer.buyOrder.monster.name} · 자사 {formatNumber(offer.buyOrder.offerBoxes)}개</p><p className="mt-1 text-xs text-slate-500">구매자 {offer.buyOrder.buyerGameNickname}</p></div><div className="flex shrink-0 items-center gap-2"><OfferStatus status={offer.status} />{offer.status === "pending" && <Button type="button" size="sm" variant="ghost" disabled={pending === `cancel-${offer.id}`} onClick={() => void updateOffer(offer.id, "cancel")} className="whitespace-nowrap text-slate-400 hover:text-rose-200">취소</Button>}</div></div>)}</div></section></div>
  </section>;
}
