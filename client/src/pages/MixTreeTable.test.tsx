/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useMonsterData", () => ({
  useMonsterData: () => [
    { id: "demi-hellpard", name: "데미헬파드", habitat: "", main: "뉴큐티캣 [4]", sub: "요르문 [4]", main2: "", sub2: "", attribute: "악마", baseLevel: 210, maxLevel: 235, acquired: "x" },
    { id: "sample-target", name: "테스트목표", habitat: "", main: "요르문 [4]", sub: "뉴큐티캣 [4]", main2: "", sub2: "", attribute: "악마", baseLevel: 210, maxLevel: 235, acquired: "x" },
    { id: "new-cutie", name: "뉴큐티캣", habitat: "", main: "손오공 [4]", sub: "디플라워 [4]", main2: "", sub2: "", attribute: "악마", baseLevel: 191, maxLevel: 216, acquired: "x" },
    { id: "sun-wukong", name: "손오공", habitat: "", main: "옐로레핀 [4]", sub: "뉴레드리프 [4]", main2: "", sub2: "", attribute: "짐승", baseLevel: 186, maxLevel: 211, acquired: "x" },
    { id: "flower", name: "디플라워", habitat: "", main: "레드아머드 [4]", sub: "골든듀크 [4]", main2: "", sub2: "", attribute: "식물", baseLevel: 186, maxLevel: 211, acquired: "x" },
    { id: "agness", name: "아그네스", habitat: "", main: "뉴프로존화뿔소 [3]", sub: "흑피니티 [3]", main2: "", sub2: "", attribute: "악마", baseLevel: 180, maxLevel: 205, acquired: "x" },
    { id: "garugon", name: "가루곤", habitat: "", main: "블루아머드 [4]", sub: "레드럼버 [4]", main2: "", sub2: "", attribute: "짐승", baseLevel: 180, maxLevel: 205, acquired: "x" },
    { id: "yorumun", name: "요르문", habitat: "", main: "아그네스 [4]", sub: "가루곤 [4]", main2: "", sub2: "", attribute: "드래곤", baseLevel: 191, maxLevel: 216, acquired: "x" },
    { id: "yellow", name: "옐로레핀", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "새", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "red-leaf", name: "뉴레드리프", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "식물", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "red-armor", name: "레드아머드", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "메탈", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "golden-duke", name: "골든듀크", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "악마", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "pro-zone", name: "뉴프로존화뿔소", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "짐승", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "huck", name: "흑피니티", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "악마", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "blue-armor", name: "블루아머드", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "메탈", baseLevel: 140, maxLevel: 165, acquired: "0" },
    { id: "red-lumber", name: "레드럼버", habitat: "", main: "-", sub: "-", main2: "", sub2: "", attribute: "짐승", baseLevel: 140, maxLevel: 165, acquired: "0" },
  ],
}));

import MixTreeTable from "./MixTreeTable";

describe("MixTreeTable", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("shows main and sub recipe families side by side in spreadsheet-like tables", () => {
    render(<MixTreeTable />);

    expect(screen.getByRole("heading", { name: "믹스법v2" })).toBeInTheDocument();
    expect(screen.getByTestId("mix-tree2-target-card")).toHaveTextContent("데미헬파드");
    const mainTable = screen.getByTestId("mix-tree2-main-table");
    const subTable = screen.getByTestId("mix-tree2-sub-table");
    expect(mainTable).toHaveTextContent("뉴큐티캣");
    expect(mainTable).toHaveTextContent("손오공");
    expect(mainTable).toHaveTextContent("디플라워");
    expect(subTable).toHaveTextContent("요르문");
    expect(subTable).toHaveTextContent("아그네스");
    expect(subTable).toHaveTextContent("가루곤");
  });

  it("searches for a result monster once and automatically displays its main and sub trees", () => {
    render(<MixTreeTable />);

    fireEvent.click(screen.getByRole("button", { name: "변경" }));
    fireEvent.change(screen.getByRole("textbox", { name: "헨치 검색" }), { target: { value: "테스트목표" } });
    fireEvent.click(screen.getByRole("button", { name: /테스트목표/ }));

    expect(screen.getByTestId("mix-tree2-target-card")).toHaveTextContent("테스트목표");
    expect(screen.getByTestId("mix-tree2-main-table")).toHaveTextContent("요르문");
    expect(screen.getByTestId("mix-tree2-sub-table")).toHaveTextContent("뉴큐티캣");
  });

  it("provides a controllable 2-to-5 level depth setting", () => {
    render(<MixTreeTable />);
    const depthSelect = screen.getByRole("combobox", { name: "표시 단계" });
    expect(depthSelect).toHaveValue("4");
  });
});
