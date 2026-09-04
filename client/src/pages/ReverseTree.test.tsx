/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReverseTree from "./ReverseTree";

const testMonster = {
  id: "reverse-tree-test-1",
  name: "테스트 드래곤",
  baseLevel: 170,
  maxLevel: 195,
  habitat: "테스트 지역",
  main: "-",
  sub: "-",
  main2: null,
  sub2: null,
  attribute: "드래곤",
  acquired: "0",
  xAntibody: 0,
  imageUrl: "/manus-storage/monster-images/reverse-tree-test.webp",
};

let mockMonsters = [testMonster];

vi.mock("@/hooks/useMonsterData", () => ({
  useMonsterData: () => mockMonsters,
}));

describe("ReverseTree search", () => {
  beforeEach(() => {
    mockMonsters = [testMonster];
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders deferred search results and lets the user select a monster", async () => {
    render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), {
      target: { value: "테스트" },
    });

    const result = await screen.findByRole("button", { name: /테스트 드래곤/ });
    fireEvent.click(result);

    await waitFor(() => {
      expect(screen.getAllByText("테스트 드래곤").length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "변경" })).toBeInTheDocument();
      expect(screen.getByTestId("mixbook-selected-card")).toHaveClass("abyss-dim-card");
      expect(screen.getAllByTestId("mixbook-node-card").length).toBeGreaterThan(0);
      expect(screen.getAllByAltText("드래곤")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ src: expect.stringContaining("/manus-storage/monster-images/reverse-tree-test.webp") }),
        ]),
      );
    });
  });

  it("lazily renders nested lower mixes without a fixed depth limit and exposes source-only materials", async () => {
    mockMonsters = [
      { ...testMonster, id: "root", name: "최상위", main: "중간 [3]", sub: "빼빼양 " },
      { ...testMonster, id: "middle", name: "중간", main: "최하위 [2]", sub: "-" },
      { ...testMonster, id: "leaf", name: "최하위", main: "-", sub: "-" },
    ];
    render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "최상위" } });
    fireEvent.click(await screen.findByRole("button", { name: /최상위/ }));

    expect(await screen.findByText("중간")).toBeInTheDocument();
    expect(screen.getByTestId("mixbook-enchant-badge")).toHaveTextContent("[3단계]");
    expect(screen.getByTestId("mixbook-enchant-badge")).toHaveClass("text-violet-800");
    expect(screen.getByText("데이터 미등록: 빼빼양")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "중간 하위 믹스법 펼치기" }));
    expect((await screen.findAllByText("최하위")).length).toBeGreaterThan(0);
  });

  it("keeps the existing card DOM and disables scroll anchoring when a mix card is opened or closed", async () => {
    mockMonsters = [
      { ...testMonster, id: "root-stable", name: "최상위 안정", main: "중간 안정", sub: "-" },
      { ...testMonster, id: "middle-stable", name: "중간 안정", main: "최하위 안정", sub: "-" },
      { ...testMonster, id: "leaf-stable", name: "최하위 안정", main: "-", sub: "-" },
    ];
    const { container } = render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "최상위 안정" } });
    fireEvent.click(await screen.findByRole("button", { name: /최상위 안정/ }));

    const tree = within(container);
    const rootCard = tree.getAllByTestId("mixbook-node-card")[0];
    fireEvent.click(screen.getByRole("button", { name: "최상위 안정 하위 믹스법 접기" }));

    expect(tree.getAllByTestId("mixbook-node-card")[0]).toBe(rootCard);
    expect(tree.getByTestId("mixbook-canvas")).toHaveClass("[overflow-anchor:none]");
  });

  it("keeps the desktop detail card fixed in the visible viewport after selecting a hench", async () => {
    render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "테스트" } });
    fireEvent.click(await screen.findByRole("button", { name: /테스트 드래곤/ }));
    fireEvent.click(await screen.findByRole("button", { name: "테스트 드래곤" }));

    expect(screen.getByTestId("mixbook-detail-panel")).toHaveClass("sticky", "top-0", "h-dvh");
    expect(screen.getByTestId("mixbook-detail-panel")).toHaveTextContent("테스트 지역");
  });

  it("opens a larger hench image from the mix detail panel and closes it with the dialog close control", async () => {
    render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "테스트" } });
    fireEvent.click(await screen.findByRole("button", { name: /테스트 드래곤/ }));
    fireEvent.click(await screen.findByRole("button", { name: "테스트 드래곤" }));
    fireEvent.click(screen.getAllByRole("button", { name: "테스트 드래곤 이미지 확대" })[0]);

    expect(await screen.findByTestId("mixbook-enlarged-image")).toHaveAttribute("src", testMonster.imageUrl);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByTestId("mixbook-enlarged-image")).not.toBeInTheDocument());
  });

  it("continues to render a lower mix chain beyond the former 10-depth limit", async () => {
    mockMonsters = Array.from({ length: 13 }, (_, index) => ({
      ...testMonster,
      id: `chain-${index}`,
      name: `연쇄${index}`,
      main: index === 12 ? "-" : `연쇄${index + 1}`,
      sub: "-",
    }));
    render(<ReverseTree />);

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 검색..."), { target: { value: "연쇄0" } });
    fireEvent.click(await screen.findByRole("button", { name: /연쇄0/ }));

    for (let index = 1; index < 12; index += 1) {
      expect(await screen.findByText(`연쇄${index}`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: `연쇄${index} 하위 믹스법 펼치기` }));
    }

    expect(await screen.findByText("연쇄12")).toBeInTheDocument();
  });
});
