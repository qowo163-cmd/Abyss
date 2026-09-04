export type MarketplaceItemCatalogEntry = {
  id: string;
  name: string;
  imageUrl: string;
};

export const MARKETPLACE_ITEMS: MarketplaceItemCatalogEntry[] = [
  { id: "gp-100m", name: "1억GP", imageUrl: "/manus-storage/gp-100m_02560ce3.png" },
  { id: "boost-set-40x", name: "40배세트", imageUrl: "/manus-storage/boost-set-40x_0ff5f0ea.png" },
  { id: "insect-third", name: "곤충3차", imageUrl: "/manus-storage/insect-third_c03c4b14.png" },
  { id: "dragon-third", name: "드래곤3차", imageUrl: "/manus-storage/dragon-third_4043321a.png" },
  { id: "metal-third", name: "메탈3차", imageUrl: "/manus-storage/metal-third_f0d174cd.png" },
  { id: "mystery-third", name: "미스터리3차", imageUrl: "/manus-storage/mystery-third_40a9ad55.png" },
  { id: "bird-third", name: "새3차", imageUrl: "/manus-storage/bird-third_60c37e53.png" },
  { id: "plant-third", name: "식물3차", imageUrl: "/manus-storage/plant-third_3b014abc.png" },
  { id: "demon-third", name: "악마3차", imageUrl: "/manus-storage/demon-third_08b5b3aa.png" },
  { id: "abyss-ticket", name: "어비스티켓", imageUrl: "/manus-storage/abyss-ticket_8b971c5f.png" },
  { id: "auto-hunt-box", name: "자동사냥박스", imageUrl: "/manus-storage/auto-hunt-box_c3920c84.png" },
  { id: "beast-third", name: "짐승3차", imageUrl: "/manus-storage/beast-third_270f32df.png" },
  { id: "rage-insect-soul", name: "분노곤충혼", imageUrl: "/manus-storage/rage-insect-soul_75435ed5.png" },
  { id: "rage-dragon-soul", name: "분노드래곤혼", imageUrl: "/manus-storage/rage-dragon-soul_217ead2d.png" },
  { id: "rage-metal-soul", name: "분노메탈혼", imageUrl: "/manus-storage/rage-metal-soul_e6489095.png" },
  { id: "rage-mystery-soul", name: "분노미스터리혼", imageUrl: "/manus-storage/rage-mystery-soul_9a39d160.png" },
  { id: "rage-bird-soul", name: "분노새혼", imageUrl: "/manus-storage/rage-bird-soul_4e1acdea.png" },
  { id: "rage-plant-soul", name: "분노식물혼", imageUrl: "/manus-storage/rage-plant-soul_e522bd51.png" },
  { id: "rage-demon-soul", name: "분노악마혼", imageUrl: "/manus-storage/rage-demon-soul_76d7b6c6.png" },
  { id: "rage-beast-soul", name: "분노짐승혼", imageUrl: "/manus-storage/rage-beast-soul_ebed8dba.png" },
  { id: "rampage-insect-soul", name: "폭주곤충혼", imageUrl: "/manus-storage/rampage-insect-soul_c0970063.png" },
  { id: "rampage-dragon-soul", name: "폭주드래곤혼", imageUrl: "/manus-storage/rampage-dragon-soul_0e5cddf7.png" },
  { id: "rampage-metal-soul", name: "폭주메탈혼", imageUrl: "/manus-storage/rampage-metal-soul_7e6279ed.png" },
  { id: "rampage-mystery-soul", name: "폭주미스터리혼", imageUrl: "/manus-storage/rampage-mystery-soul_95668f07.png" },
  { id: "rampage-bird-soul", name: "폭주새혼", imageUrl: "/manus-storage/rampage-bird-soul_c5836c2f.png" },
  { id: "rampage-plant-soul", name: "폭주식물혼", imageUrl: "/manus-storage/rampage-plant-soul_4485241b.png" },
  { id: "rampage-demon-soul", name: "폭주악마혼", imageUrl: "/manus-storage/rampage-demon-soul_116e8111.png" },
  { id: "rampage-beast-soul", name: "폭주짐승혼", imageUrl: "/manus-storage/rampage-beast-soul_40a60ab1.png" },
  { id: "prism", name: "프리즘", imageUrl: "/manus-storage/prism_048dea0e.png" },
];

const normalizeItemName = (value: string) => value.replace(/\s+/g, "").toLowerCase();

export function findMarketplaceItem(name?: string | null) {
  const normalized = normalizeItemName(name || "");
  return MARKETPLACE_ITEMS.find((item) => normalizeItemName(item.name) === normalized);
}
