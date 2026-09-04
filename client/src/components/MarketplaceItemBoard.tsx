import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, HandCoins, Loader2, PackageOpen, Plus, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMarketplaceItemListing,
  getMarketplaceItemListings,
  getMarketplaceItemPriceSummaries,
  getMyMarketplaceItems,
  postMarketplaceItemListing,
  postMarketplaceItemRequest,
  updateMarketplaceItemRequest,
  type MarketplaceItemListing,
  type MarketplaceItemListingType,
  type MarketplaceItemMine,
  type MarketplaceItemPriceSummary,
  type MarketplaceItemRequest,
  type MarketplaceRequestStatus,
} from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { formatGpAmount } from "../lib/formatGp";
import { findMarketplaceItem, MARKETPLACE_ITEMS } from "@/data/marketplaceItems";
import { DEFAULT_MARKETPLACE_GP_PRICING_RULE, getMarketplaceGpPricingRule, gpAmountFromUnitCount, isRampageSoul, RAMPAGE_SOULS_PER_AUTO_HUNT_BOX } from "@shared/marketplaceGpPricing";

type ItemView = "all" | "sell" | "buy" | "exchange" | "register";

const TYPE_LABEL: Record<MarketplaceItemListingType, string> = { sell: "판매", buy: "구매", exchange: "교환" };
const TYPE_ICON: Record<MarketplaceItemListingType, typeof ShoppingBag> = { sell: ShoppingBag, buy: HandCoins, exchange: ArrowLeftRight };
const STATUS_LABEL: Record<MarketplaceRequestStatus, string> = { pending: "대기 중", accepted: "거래 예약", rejected: "거절됨", cancelled: "취소됨", completed: "완료" };
function number(value: number) { return new Intl.NumberFormat("ko-KR").format(value); }
function time(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "방금 전" : date.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }); }

export function MarketplaceItemBoard({ memberId, canRegister = false, onChanged }: { memberId?: string; canRegister?: boolean; onChanged: () => Promise<void> | void }) {
  const [view, setView] = useState<ItemView>("all");
  const [filter, setFilter] = useState<Exclude<ItemView, "all" | "register"> | undefined>();
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<MarketplaceItemListing[]>([]);
  const [mine, setMine] = useState<MarketplaceItemMine>({ listings: [], received: [], sent: [] });
  const [prices, setPrices] = useState<MarketplaceItemPriceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [listingType, setListingType] = useState<MarketplaceItemListingType>("sell");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceBoxes, setPriceBoxes] = useState("");
  const [priceCurrency, setPriceCurrency] = useState<"boxes" | "gp">("boxes");
  const [wantedItems, setWantedItems] = useState([{ name: "", quantity: "1" }]);
  const [note, setNote] = useState("");
  const [openRequest, setOpenRequest] = useState<string | null>(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [offeredItemName, setOfferedItemName] = useState("");
  const [offeredQuantity, setOfferedQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const itemGpPricingRule = getMarketplaceGpPricingRule(itemName);
  const isRampageSoulBoxTrade = isRampageSoul(itemName) && priceCurrency === "boxes" && listingType !== "exchange";
  const effectivePriceCurrency = priceCurrency;
  const activeGpPricingRule = effectivePriceCurrency === "gp" ? itemGpPricingRule ?? DEFAULT_MARKETPLACE_GP_PRICING_RULE : null;
  const enteredItemQuantity = Math.min(9_999, Math.max(1, Number(quantity) || 1));
  const enteredItemUnitPrice = Math.max(0, Number(priceBoxes) || 0);
  const enteredItemUnitAmount = activeGpPricingRule ? gpAmountFromUnitCount(enteredItemUnitPrice, activeGpPricingRule) : enteredItemUnitPrice;
  const enteredItemTotalAmount = isRampageSoulBoxTrade ? enteredItemQuantity / RAMPAGE_SOULS_PER_AUTO_HUNT_BOX : enteredItemUnitAmount * enteredItemQuantity;

  const refresh = useCallback(async () => {
    try {
      const [market, own] = await Promise.all([getMarketplaceItemListings(query, filter), getMyMarketplaceItems()]);
      setListings(market.listings);
      const priceResult = await getMarketplaceItemPriceSummaries(market.listings.map((listing) => listing.itemName));
      setPrices(priceResult?.prices || []);
      setMine(own);
    } catch (error) { toast.error(error instanceof Error ? error.message : "아이템 거래소를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, [filter, query]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const source = new EventSource("/api/marketplace/events");
    const changed = () => void refresh();
    source.addEventListener("marketplace", changed);
    return () => { source.removeEventListener("marketplace", changed); source.close(); };
  }, [refresh]);

  const setActiveView = (next: ItemView) => { if (next === "register" && !canRegister) return; setView(next); setFilter(next === "all" || next === "register" ? undefined : next); };
  const activeListings = useMemo(() => mine.listings.filter((listing) => listing.status === "active"), [mine.listings]);
  const resetForm = () => { setItemName(""); setQuantity("1"); setPriceBoxes(""); setPriceCurrency("boxes"); setWantedItems([{ name: "", quantity: "1" }]); setNote(""); };
  const submitListing = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canRegister) { toast.error("거래소 정식 오픈 전까지는 관리자만 거래글을 등록할 수 있습니다."); return; }
    setPending("create");
    try {
      const numericQuantity = Number(quantity);
      const effectiveBoxes = isRampageSoulBoxTrade ? numericQuantity / RAMPAGE_SOULS_PER_AUTO_HUNT_BOX : undefined;
      await postMarketplaceItemListing({ listingType, itemName, quantity: numericQuantity, priceBoxes: listingType === "exchange" ? undefined : effectiveBoxes, unitPrice: listingType === "exchange" || isRampageSoulBoxTrade ? undefined : activeGpPricingRule ? gpAmountFromUnitCount(Number(priceBoxes), activeGpPricingRule) : Number(priceBoxes), priceCurrency: listingType === "exchange" ? undefined : effectivePriceCurrency, wantedItems: listingType === "exchange" ? wantedItems.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), quantity: Number(item.quantity) })) : undefined, note });
      toast.success(`${TYPE_LABEL[listingType]} 아이템 글을 등록했습니다.`); resetForm(); setActiveView("all"); await Promise.all([refresh(), onChanged()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "아이템 글을 등록하지 못했습니다."); }
    finally { setPending(null); }
  };
  const submitRequest = async (listing: MarketplaceItemListing) => {
    setPending(`request-${listing.id}`);
    try {
      await postMarketplaceItemRequest(listing.id, { quantity: Number(requestQuantity), offeredItemName: listing.listingType === "exchange" ? offeredItemName : undefined, offeredQuantity: listing.listingType === "exchange" ? Number(offeredQuantity) : undefined, message });
      toast.success(listing.listingType === "exchange" ? "교환 제안을 보냈습니다." : "거래 제안을 보냈습니다."); setOpenRequest(null); setMessage(""); setOfferedItemName(""); await Promise.all([refresh(), onChanged()]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "제안을 보내지 못했습니다."); }
    finally { setPending(null); }
  };
  const runAction = async (request: MarketplaceItemRequest, action: "accept" | "reject" | "complete" | "cancel") => {
    setPending(`${action}-${request.id}`);
    try { await updateMarketplaceItemRequest(request.id, action); toast.success(action === "accept" ? "제안을 수락했습니다." : action === "reject" ? "제안을 거절했습니다." : action === "complete" ? "거래를 완료 처리했습니다." : "제안을 취소했습니다."); await Promise.all([refresh(), onChanged()]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "거래 상태를 변경하지 못했습니다."); }
    finally { setPending(null); }
  };
  const cancel = async (listingId: string) => {
    setPending(`cancel-${listingId}`);
    try { await cancelMarketplaceItemListing(listingId); toast.success("아이템 거래글을 취소했습니다."); await Promise.all([refresh(), onChanged()]); }
    catch (error) { toast.error(error instanceof Error ? error.message : "거래글을 취소하지 못했습니다."); }
    finally { setPending(null); }
  };

  return <section className="py-6">
    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
      {(["all", "sell", "buy", "exchange", ...(canRegister ? ["register"] : [])] as ItemView[]).map((next) => <Button key={next} type="button" size="sm" variant={view === next ? "default" : "outline"} onClick={() => setActiveView(next)} className={view === next ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border-slate-700 text-slate-300 hover:bg-slate-800"}>{next === "all" ? "전체" : next === "register" ? <><Plus className="mr-1 h-3.5 w-3.5" />아이템 등록</> : TYPE_LABEL[next]}</Button>)}
    </div>

    {view === "register" ? <form onSubmit={submitListing} className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-cyan-200" /><h3 className="font-bold text-white">아이템 통합 등록</h3></div><p className="mt-1 text-sm text-slate-500">판매·구매는 품목별 자사 또는 GP 가격으로, 교환은 원하는 아이템 목록으로 등록합니다.</p>
        <div className="mt-5 flex flex-wrap gap-2">{(["sell", "buy", "exchange"] as MarketplaceItemListingType[]).map((type) => <Button key={type} type="button" size="sm" variant={listingType === type ? "default" : "outline"} onClick={() => setListingType(type)} className={listingType === type ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border-slate-700 text-slate-300"}>{TYPE_LABEL[type]} 등록</Button>)}</div>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-300">{listingType === "buy" ? "구매할 아이템" : "등록 아이템"}</label>
            <Input required list="marketplace-item-catalog" maxLength={120} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="등록된 아이템을 선택하거나 직접 입력" className="mt-2 border-slate-700 bg-slate-950 text-slate-100" />
            {findMarketplaceItem(itemName) && <div className="mt-2 flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs text-cyan-100"><img src={findMarketplaceItem(itemName)?.imageUrl} alt={`${findMarketplaceItem(itemName)?.name} 아이템`} className="h-16 w-16 object-contain [image-rendering:pixelated]" />{isRampageSoul(itemName) ? <span>자사 거래는 <strong>폭주의 혼 {RAMPAGE_SOULS_PER_AUTO_HUNT_BOX}개당 자동사냥박스 1개</strong> 기준으로 자동 계산됩니다. GP를 선택하면 1억 단위로 입력합니다.</span> : itemGpPricingRule ? <span>자사 또는 GP 중 선택할 수 있습니다. GP를 선택하면 {itemGpPricingRule.inputUnitLabel} 단위로 입력합니다. 예: {itemGpPricingRule.exampleInput} 입력 시 {formatGpAmount(gpAmountFromUnitCount(itemGpPricingRule.exampleInput, itemGpPricingRule))}</span> : <span>자사 또는 GP 중 원하는 거래 화폐를 선택할 수 있습니다.</span>}</div>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="item-listing-quantity" className="text-sm font-semibold text-slate-300">수량 {isRampageSoulBoxTrade && <span className="text-cyan-200">(2개 단위)</span>}</label><Input id="item-listing-quantity" required type="number" min={isRampageSoulBoxTrade ? RAMPAGE_SOULS_PER_AUTO_HUNT_BOX : "1"} step={isRampageSoulBoxTrade ? RAMPAGE_SOULS_PER_AUTO_HUNT_BOX : undefined} max="9999" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-2 border-slate-700 bg-slate-950 text-slate-100" />{isRampageSoulBoxTrade && <p className="mt-1 text-xs text-cyan-200">{Number(quantity) > 0 && Number(quantity) % RAMPAGE_SOULS_PER_AUTO_HUNT_BOX === 0 ? `자동사냥박스 ${number(Number(quantity) / RAMPAGE_SOULS_PER_AUTO_HUNT_BOX)}개 기준으로 등록됩니다.` : `폭주의 혼은 ${RAMPAGE_SOULS_PER_AUTO_HUNT_BOX}개 단위로 입력해 주세요.`}</p>}</div>
            {listingType !== "exchange" && <div>
              <label className="text-sm font-semibold text-slate-300">거래 화폐</label>
              <div className="mt-2 flex gap-2"><Button type="button" size="sm" variant={effectivePriceCurrency === "boxes" ? "default" : "outline"} onClick={() => setPriceCurrency("boxes")} className={effectivePriceCurrency === "boxes" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "border-slate-700 text-slate-300"}>자사</Button><Button type="button" size="sm" variant={effectivePriceCurrency === "gp" ? "default" : "outline"} onClick={() => setPriceCurrency("gp")} className={effectivePriceCurrency === "gp" ? "bg-amber-400 text-slate-950 hover:bg-amber-300" : "border-slate-700 text-slate-300"}>GP</Button></div>
              <label className="mt-3 block text-sm font-semibold text-slate-300">{effectivePriceCurrency === "gp" ? "개당 GP 가격" : isRampageSoulBoxTrade ? "자동사냥박스 기준" : "개당 자사 가격"} <span className="text-amber-200">(자동 합산)</span></label>
              {isRampageSoulBoxTrade ? <div className="mt-2 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-bold text-cyan-100">폭주의 혼 {number(Number(quantity) || 0)}개 = 자동사냥박스 {number(Math.floor((Number(quantity) || 0) / RAMPAGE_SOULS_PER_AUTO_HUNT_BOX))}개</div> : <div className="relative mt-2"><Input required type="number" min="1" max={activeGpPricingRule ? String(activeGpPricingRule.maxInput) : undefined} value={priceBoxes} onChange={(event) => setPriceBoxes(event.target.value)} placeholder={activeGpPricingRule ? `예: ${activeGpPricingRule.exampleInput}` : "예: 50"} className="border-slate-700 bg-slate-950 pr-12 text-slate-100" />{activeGpPricingRule && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-amber-200">{activeGpPricingRule.inputUnitLabel}</span>}</div>}
              {activeGpPricingRule && <p className="mt-1 text-xs text-amber-100/70">{priceBoxes && Number(priceBoxes) > 0 ? `${formatGpAmount(gpAmountFromUnitCount(Number(priceBoxes), activeGpPricingRule))}로 등록됩니다.` : activeGpPricingRule.inputHelp}</p>}
              {!isRampageSoulBoxTrade && <p data-testid="item-total-price-preview" className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-sm text-amber-100">개당 {effectivePriceCurrency === "gp" ? formatGpAmount(enteredItemUnitAmount) : `${number(enteredItemUnitAmount)} 자사`} × {number(enteredItemQuantity)}개 <strong className="ml-1 text-amber-200">= 전체 {effectivePriceCurrency === "gp" ? formatGpAmount(enteredItemTotalAmount) : `자사 ${number(enteredItemTotalAmount)}개`}</strong></p>}
            </div>}
          </div>
          {listingType === "exchange" && <div><label className="text-sm font-semibold text-slate-300">원하는 아이템 <span className="text-slate-500">(최대 5종)</span></label><div className="mt-2 space-y-2">{wantedItems.map((item, index) => <div key={index} className="flex gap-2"><Input required list="marketplace-item-catalog" value={item.name} onChange={(event) => setWantedItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: event.target.value } : entry))} placeholder="원하는 아이템 이름" className="border-slate-700 bg-slate-950 text-slate-100" /><Input required type="number" min="1" value={item.quantity} onChange={(event) => setWantedItems((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, quantity: event.target.value } : entry))} className="w-24 border-slate-700 bg-slate-950 text-slate-100" />{wantedItems.length > 1 && <Button type="button" size="icon" variant="ghost" onClick={() => setWantedItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-slate-400"><X className="h-4 w-4" /></Button>}</div>)}</div>{wantedItems.length < 5 && <Button type="button" size="sm" variant="ghost" onClick={() => setWantedItems((current) => [...current, { name: "", quantity: "1" }])} className="mt-2 text-cyan-200"><Plus className="mr-1 h-3.5 w-3.5" />원하는 아이템 추가</Button>}</div>}
          <div><label className="text-sm font-semibold text-slate-300">메모 <span className="font-normal text-slate-500">(선택)</span></label><Textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="거래 시간·장소 등" className="mt-2 min-h-24 border-slate-700 bg-slate-950 text-slate-100" /></div></div><Button type="submit" disabled={pending === "create"} className="mt-6 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300">{pending === "create" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}아이템 {TYPE_LABEL[listingType]}글 등록</Button></div>
      <MyItemActivity mine={mine} onCancel={cancel} onAction={runAction} pending={pending} />
    </form> : <><form onSubmit={(event) => { event.preventDefault(); setLoading(true); void refresh(); }} className="mt-6 flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input list="marketplace-item-catalog" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="아이템 이름 또는 교환 희망 아이템 검색" className="border-slate-700 bg-slate-950 pl-9 text-slate-100" /></div><Button type="submit" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">검색</Button></form>
      {loading ? <div className="flex min-h-60 items-center justify-center text-cyan-200"><Loader2 className="mr-2 h-5 w-5 animate-spin" />아이템 거래글을 불러오는 중입니다.</div> : listings.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-12 text-center text-slate-500">현재 조건의 아이템 거래글이 없습니다.{canRegister && <Button type="button" variant="link" onClick={() => setActiveView("register")} className="ml-1 text-cyan-200">첫 글을 등록해 보세요.</Button>}</div> : <div className="mt-6 grid gap-4 lg:grid-cols-2">{listings.map((listing) => <ItemCard key={listing.id} listing={listing} price={prices.find((entry) => entry.itemName === listing.itemName)} isMine={listing.ownerId === memberId} requestOpen={openRequest === listing.id} setRequestOpen={(open) => { setOpenRequest(open ? listing.id : null); setRequestQuantity(String(listing.quantity)); }} requestQuantity={requestQuantity} setRequestQuantity={setRequestQuantity} offeredItemName={offeredItemName} setOfferedItemName={setOfferedItemName} offeredQuantity={offeredQuantity} setOfferedQuantity={setOfferedQuantity} message={message} setMessage={setMessage} onRequest={submitRequest} pending={pending} />)}</div>}</>}
    <datalist id="marketplace-item-catalog">{MARKETPLACE_ITEMS.map((item) => <option key={item.id} value={item.name} />)}</datalist>
  </section>;
}

function ItemCard({ listing, price, isMine, requestOpen, setRequestOpen, requestQuantity, setRequestQuantity, offeredItemName, setOfferedItemName, offeredQuantity, setOfferedQuantity, message, setMessage, onRequest, pending }: { listing: MarketplaceItemListing; price?: MarketplaceItemPriceSummary; isMine: boolean; requestOpen: boolean; setRequestOpen: (open: boolean) => void; requestQuantity: string; setRequestQuantity: (value: string) => void; offeredItemName: string; setOfferedItemName: (value: string) => void; offeredQuantity: string; setOfferedQuantity: (value: string) => void; message: string; setMessage: (value: string) => void; onRequest: (listing: MarketplaceItemListing) => Promise<void>; pending: string | null }) {
  const Icon = TYPE_ICON[listing.listingType];
  const catalogItem = findMarketplaceItem(listing.itemName);
  return <article className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-4">{catalogItem ? <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-cyan-400/25 bg-slate-950 p-1"><img src={catalogItem.imageUrl} alt={`${catalogItem.name} 아이템`} className="h-full w-full object-contain [image-rendering:pixelated]" loading="lazy" /></div> : <div className={cn("rounded-xl p-2.5", listing.listingType === "sell" ? "bg-cyan-400/10 text-cyan-200" : listing.listingType === "buy" ? "bg-violet-400/10 text-violet-200" : "bg-fuchsia-400/10 text-fuchsia-200")}><Icon className="h-5 w-5" /></div>}<div><p className="text-xs font-semibold text-slate-500">아이템 {TYPE_LABEL[listing.listingType]}</p><h3 className="mt-0.5 break-all text-lg font-bold text-white">{listing.itemName}</h3>{price?.displayBoxesPerUnit !== null && price?.displayBoxesPerUnit !== undefined && listing.priceCurrency !== "gp" && <p className="mt-1 text-xs font-medium text-amber-200">최근 {price.source === "recent" ? "2주 평균" : "기준"} {number(price.displayBoxesPerUnit)} 자사/개{price.source === "recent" && ` · ${price.recentCompletedCount}건`}</p>}</div></div><span className="whitespace-nowrap text-xs text-slate-500">{time(listing.createdAt)}</span></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><p className="text-[11px] text-slate-500">수량</p><p className="mt-0.5 font-bold text-slate-100">{number(listing.quantity)}개</p></div>{listing.listingType === "exchange" ? <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/5 p-3"><p className="text-[11px] text-fuchsia-200/70">원하는 아이템</p><p className="mt-0.5 text-sm font-bold text-fuchsia-100">{listing.wantedItems.map((item) => `${item.name} ${number(item.quantity)}개`).join(", ")}</p></div> : <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><p className="text-[11px] text-amber-200/70">{listing.priceCurrency === "gp" ? "GP 가격 · 전체" : "자사 가격 · 전체"}</p><p className="mt-0.5 font-bold text-amber-200">{listing.priceCurrency === "gp" ? formatGpAmount(listing.priceBoxes ?? 0) : `${number(listing.priceBoxes ?? 0)}개`}</p></div>}</div>{listing.note && <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">{listing.note}</p>}<div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-3"><div className="flex min-w-0 items-center gap-2 text-sm"><UserRound className="h-4 w-4 shrink-0 text-slate-500" /><strong className="truncate text-slate-200">{listing.ownerGameNickname}</strong><span className="truncate text-xs text-slate-600">({listing.ownerNickname})</span></div>{isMine ? <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200">내 글</span> : <Button type="button" size="sm" onClick={() => setRequestOpen(!requestOpen)} className="bg-amber-400 text-slate-950 hover:bg-amber-300">{listing.listingType === "exchange" ? "교환 제안" : "거래 제안"}</Button>}</div>{requestOpen && <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3"><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold text-amber-100">거래 수량</label><Input type="number" min="1" max={listing.quantity} value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} className="mt-1 border-slate-700 bg-slate-950 text-slate-100" /></div>{listing.listingType === "exchange" && <><div><label className="text-xs font-semibold text-amber-100">제안 아이템</label><Input list="marketplace-item-catalog" value={offeredItemName} onChange={(event) => setOfferedItemName(event.target.value)} placeholder="내가 줄 아이템" className="mt-1 border-slate-700 bg-slate-950 text-slate-100" /></div><div><label className="text-xs font-semibold text-amber-100">제안 수량</label><Input type="number" min="1" value={offeredQuantity} onChange={(event) => setOfferedQuantity(event.target.value)} className="mt-1 border-slate-700 bg-slate-950 text-slate-100" /></div></>}</div><Textarea maxLength={300} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="거래 메모 (선택)" className="mt-3 min-h-20 border-slate-700 bg-slate-950 text-slate-100" /><div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setRequestOpen(false)} className="text-slate-400">취소</Button><Button type="button" size="sm" disabled={pending === `request-${listing.id}`} onClick={() => void onRequest(listing)} className="bg-amber-400 text-slate-950 hover:bg-amber-300">{pending === `request-${listing.id}` && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}제안 보내기</Button></div></div>}</article>;
}

function MyItemActivity({ mine, onCancel, onAction, pending }: { mine: MarketplaceItemMine; onCancel: (listingId: string) => Promise<void>; onAction: (request: MarketplaceItemRequest, action: "accept" | "reject" | "complete" | "cancel") => Promise<void>; pending: string | null }) {
  return <div className="space-y-5"><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h3 className="font-bold text-white">내 아이템 거래글</h3><div className="mt-3 space-y-2">{mine.listings.length === 0 ? <p className="text-sm text-slate-500">등록한 아이템 거래글이 없습니다.</p> : mine.listings.slice(0, 6).map((listing) => <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div><p className="font-semibold text-slate-100">{listing.itemName} <span className="text-sm font-normal text-slate-500">{number(listing.quantity)}개</span></p><p className="text-xs text-slate-500">{TYPE_LABEL[listing.listingType]} · {listing.status === "active" ? "거래 중" : listing.status === "reserved" ? "예약" : listing.status === "completed" ? "완료" : "취소"}</p></div>{listing.status === "active" && <Button type="button" size="sm" variant="outline" disabled={pending === `cancel-${listing.id}`} onClick={() => void onCancel(listing.id)} className="border-slate-700 text-slate-300">거래글 취소</Button>}</div>)}</div></section><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h3 className="font-bold text-white">받은 아이템 제안</h3><div className="mt-3 space-y-2">{mine.received.length === 0 ? <p className="text-sm text-slate-500">받은 제안이 없습니다.</p> : mine.received.slice(0, 8).map((request) => <RequestCard key={request.id} request={request} owner onAction={onAction} pending={pending} />)}</div></section><section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><h3 className="font-bold text-white">보낸 아이템 제안</h3><div className="mt-3 space-y-2">{mine.sent.length === 0 ? <p className="text-sm text-slate-500">보낸 제안이 없습니다.</p> : mine.sent.slice(0, 8).map((request) => <RequestCard key={request.id} request={request} owner={false} onAction={onAction} pending={pending} />)}</div></section></div>;
}
function RequestCard({ request, owner, onAction, pending }: { request: MarketplaceItemRequest; owner: boolean; onAction: (request: MarketplaceItemRequest, action: "accept" | "reject" | "complete" | "cancel") => Promise<void>; pending: string | null }) { return <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-100">{request.listing?.itemName ?? "아이템 거래"} · {number(request.requestedQuantity)}개</p><p className="mt-1 text-xs text-slate-500">{owner ? `제안자 ${request.requesterGameNickname}` : "내가 보낸 제안"}{request.offeredItemName ? ` · ${request.offeredItemName} ${number(request.offeredQuantity ?? 0)}개 제안` : ""}</p></div><span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">{STATUS_LABEL[request.status]}</span></div>{request.message && <p className="mt-2 text-sm text-slate-400">“{request.message}”</p>}{request.status === "pending" && <div className="mt-3 flex flex-wrap gap-2">{owner ? <><Button type="button" size="sm" disabled={pending === `accept-${request.id}`} onClick={() => void onAction(request, "accept")} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Check className="mr-1 h-3 w-3" />수락</Button><Button type="button" size="sm" variant="outline" onClick={() => void onAction(request, "reject")} className="border-rose-400/40 text-rose-200">거절</Button></> : <Button type="button" size="sm" variant="ghost" onClick={() => void onAction(request, "cancel")} className="text-slate-400">제안 취소</Button>}</div>}{owner && request.status === "accepted" && <Button type="button" size="sm" onClick={() => void onAction(request, "complete")} className="mt-3 bg-emerald-400 text-slate-950 hover:bg-emerald-300">거래 완료 처리</Button>}</div>; }
