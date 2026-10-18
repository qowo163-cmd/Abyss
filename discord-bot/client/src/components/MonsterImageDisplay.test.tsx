/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Monster } from "@/types/monster";
import { MonsterCard } from "./MonsterCard";
import { MonsterDetailModal } from "./MonsterDetailModal";

const uploadedMonster: Monster = {
  id: "uploaded-image-test",
  name: "업로드이미지헨치",
  baseLevel: 170,
  maxLevel: 195,
  attribute: "드래곤",
  habitat: "테스트 지역",
  main: "-",
  sub: "-",
  main2: null,
  sub2: null,
  acquired: "0",
  xAntibody: 0,
  imageUrl: "/manus-storage/monster-images/uploaded-image-test.webp",
};

describe("uploaded monster image display", () => {
  afterEach(cleanup);

  it("uses the saved image URL on the public hench card", () => {
    render(<MonsterCard monster={uploadedMonster} />);
    const image = screen.getByAltText("업로드이미지헨치");
    expect(image).toHaveAttribute("src", uploadedMonster.imageUrl);
    expect(image).toHaveAttribute("draggable", "false");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("uses the saved image URL and blocks dragging in the public hench detail modal", () => {
    render(<MonsterDetailModal monster={uploadedMonster} isOpen onClose={() => undefined} />);
    const image = screen.getByAltText("업로드이미지헨치");
    expect(image).toHaveAttribute("src", uploadedMonster.imageUrl);
    expect(image).toHaveAttribute("draggable", "false");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  });
});
