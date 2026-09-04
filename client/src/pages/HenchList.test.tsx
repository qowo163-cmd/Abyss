/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import defaultMonsters from "@/data/monsters.json";
import { replaceMonsterData } from "@/hooks/useMonsterData";
import HenchList from "./HenchList";

describe("HenchList shared monster cache", () => {
  afterEach(() => {
    cleanup();
    act(() => replaceMonsterData(defaultMonsters as never[]));
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("shows an uploaded hench immediately when the shared cache is replaced", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(defaultMonsters), { status: 200 }));
    render(<HenchList />);

    act(() => {
      replaceMonsterData([{
        id: "xlsx-uploaded-1",
        name: "엑셀즉시인식헨치",
        baseLevel: 170,
        maxLevel: 195,
        attribute: "드래곤",
        habitat: "업로드 지역",
        main: "재료A",
        sub: "재료B",
        main2: null,
        sub2: null,
        acquired: "0",
        xAntibody: 0,
        imageUrl: "/manus-storage/monster-images/xlsx-uploaded-1.webp",
        imageVersion: 1_786_955_000_000,
      }]);
    });

    fireEvent.change(screen.getByPlaceholderText("몬스터 이름, 서식지, 재료 검색..."), { target: { value: "엑셀즉시인식헨치" } });
    await waitFor(() => {
      expect(screen.getByText("엑셀즉시인식헨치")).toBeInTheDocument();
      expect(screen.getByAltText("엑셀즉시인식헨치")).toHaveAttribute(
        "src",
        "/api/monster-image?key=monster-images%2Fxlsx-uploaded-1.webp&v=1786955000000",
      );
    });
  });

  it("filters the hench grid with the habitat dropdown without rendering quick-select buttons", async () => {
    const habitatMonsters = [
        {
          id: "habitat-forest-1",
          name: "숲헨치",
          baseLevel: 170,
          maxLevel: 195,
          attribute: "식물",
          habitat: "그린우드",
          main: null,
          sub: null,
          main2: null,
          sub2: null,
          acquired: "0",
          xAntibody: 0,
          imageUrl: null,
        },
        {
          id: "habitat-sea-1",
          name: "바다헨치",
          baseLevel: 175,
          maxLevel: 200,
          attribute: "드래곤",
          habitat: "아쿠아리움",
          main: null,
          sub: null,
          main2: null,
          sub2: null,
          acquired: "0",
          xAntibody: 0,
          imageUrl: null,
        },
      ] as never[];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(habitatMonsters), { status: 200 }));
    render(<HenchList />);

    act(() => {
      replaceMonsterData(habitatMonsters);
    });

    const habitatSelect = await screen.findByRole("combobox", { name: "서식지 선택" });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "그린우드 (1마리)" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "그린우드 1" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "아쿠아리움 1" })).not.toBeInTheDocument();
    });

    fireEvent.change(habitatSelect, { target: { value: "그린우드" } });

    await waitFor(() => {
      expect(screen.getByText("숲헨치")).toBeInTheDocument();
      expect(screen.queryByText("바다헨치")).not.toBeInTheDocument();
      expect(screen.getByText("1마리")).toBeInTheDocument();
    });
  });

  it("separates one hench's multiple habitats into independent dropdown options and filter results", async () => {
    const habitatMonsters = [{
      id: "habitat-multi-1",
      name: "다중서식지헨치",
      baseLevel: 180,
      maxLevel: 205,
      attribute: "짐승",
      habitat: "바로크 145lv~, 엘리시움 5층, 짐승의 구역 5층",
      main: null,
      sub: null,
      main2: null,
      sub2: null,
      acquired: "0",
      xAntibody: 0,
      imageUrl: null,
    }] as never[];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(habitatMonsters), { status: 200 }));
    render(<HenchList />);

    act(() => { replaceMonsterData(habitatMonsters); });
    const habitatSelect = await screen.findByRole("combobox", { name: "서식지 선택" });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "바로크 145lv~ (1마리)" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "엘리시움 5층 (1마리)" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "짐승의 구역 5층 (1마리)" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "바로크 145lv~, 엘리시움 5층, 짐승의 구역 5층 (1마리)" })).not.toBeInTheDocument();
    });

    fireEvent.change(habitatSelect, { target: { value: "엘리시움 5층" } });
    await waitFor(() => expect(screen.getByText("다중서식지헨치")).toBeInTheDocument());
  });

  it("shows 트위스퉁가 as 득코 가능 and retains it in the acquired-only filter", async () => {
    const acquiredMonsters = [{
      id: "twistinga-acquired",
      name: "트위스퉁가",
      baseLevel: 144,
      maxLevel: 169,
      attribute: "메탈",
      habitat: "메탈의 구역 4층",
      main: "스파이커 [3]",
      sub: "뉴봄버군 [3]",
      main2: null,
      sub2: null,
      acquired: "0",
      xAntibody: 0,
      imageUrl: null,
    }] as never[];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(acquiredMonsters), { status: 200 }));
    render(<HenchList />);

    act(() => { replaceMonsterData(acquiredMonsters); });
    expect(await screen.findByText("트위스퉁가")).toBeInTheDocument();
    expect(screen.getByText("득코 가능")).toHaveClass("abyss-acquired-label");
    expect(screen.queryByTestId("hench-x-antibody-twistinga-acquired")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("득코 가능만 보기"));
    await waitFor(() => expect(screen.getByText("트위스퉁가")).toBeInTheDocument());
  });

  it("renders 득코 불가능 as a strong red badge and never displays an X-antibody zero", async () => {
    const unavailableMonsters = [{
      id: "unavailable-hench",
      name: "득코불가헨치",
      baseLevel: 170,
      maxLevel: 195,
      attribute: "악마",
      habitat: "테스트 지역",
      main: null,
      sub: null,
      main2: null,
      sub2: null,
      acquired: "x",
      xAntibody: 0,
      imageUrl: null,
    }] as never[];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(unavailableMonsters), { status: 200 }));
    render(<HenchList />);

    act(() => { replaceMonsterData(unavailableMonsters); });
    expect(await screen.findByText("득코불가헨치")).toBeInTheDocument();
    expect(screen.getByText("득코 불가능")).toHaveClass("abyss-unacquired-label");
    expect(screen.queryByTestId("hench-x-antibody-unavailable-hench")).not.toBeInTheDocument();
  });
});
