/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import Admin from "./Admin";

vi.mock("@/contexts/MembershipContext", () => ({
  useMembership: () => ({
    member: {
      id: "admin-test",
      username: "admin",
      nickname: "관리자",
      discordNickname: "admin",
      gameNickname: "admin",
      role: "admin",
      status: "approved",
      createdAt: "2026-08-17T00:00:00.000Z",
    },
    loading: false,
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/imageOptimizer", () => ({
  formatFileSize: (bytes: number) => `${bytes}B`,
  optimizeImageForUpload: vi.fn(async () => ({
    file: { name: "hench.webp", type: "image/webp" },
    dataUrl: "data:image/webp;base64,b3B0aW1pemVk",
    originalBytes: 4_096_000,
    optimizedBytes: 512_000,
    width: 1024,
    height: 768,
  })),
}));

const baselineMonster = {
  id: "baseline-1",
  name: "기존헨치",
  baseLevel: 170,
  maxLevel: 195,
  habitat: "기존 지역",
  main: "메인",
  sub: "서브",
  main2: null,
  sub2: null,
  attribute: "드래곤",
  acquired: "0",
  xAntibody: 0,
};

describe("Admin CSV import", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("saves an individual marketplace tab use switch from the site settings tab", async () => {
    let settings = { sellEnabled: true, buyEnabled: true, exchangeEnabled: true, itemsEnabled: true, updatedAt: null };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/admin/marketplace/tab-settings") && (!init || init.method === undefined || init.method === "GET")) return new Response(JSON.stringify({ settings }), { status: 200 });
      if (url.endsWith("/api/admin/marketplace/tab-settings") && init?.method === "PUT") {
        settings = { ...settings, ...JSON.parse(String(init.body)) };
        return new Response(JSON.stringify({ settings }), { status: 200 });
      }
      if (url.endsWith("/api/auth/members")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/monsters")) return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      if (url.endsWith("/api/updates") && (!init || init.method === undefined || init.method === "GET")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/feedbacks")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/updates/append")) return new Response(JSON.stringify({ success: true, updates: [] }), { status: 200 });
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    expect(screen.getByTestId("admin-dashboard")).toHaveClass("abyss-admin-high-contrast");
    const settingsTab = await screen.findByRole("tab", { name: "사이트 설정" });
    fireEvent.mouseDown(settingsTab, { button: 0, ctrlKey: false });
    fireEvent.click(settingsTab);
    const sellSwitch = await screen.findByRole("switch", { name: "판매중 탭 사용 전환" });
    fireEvent.click(sellSwitch);

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/admin/marketplace/tab-settings") && init?.method === "PUT");
      expect(saveCall).toBeDefined();
      expect(JSON.parse(String(saveCall?.[1]?.body))).toMatchObject({ sellEnabled: false, buyEnabled: true, exchangeEnabled: true, itemsEnabled: true });
    });
    expect(screen.getByText("중지됨")).toBeInTheDocument();
  });

  it("uploads the selected CSV through the server endpoint with X-data", async () => {
    let updates: unknown[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && init?.method === "POST") {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(updates), { status: 200 });
      }
      if (url.endsWith("/api/feedbacks") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/updates/append") && init?.method === "POST") {
        updates = [...updates, JSON.parse(String(init.body))];
        return new Response(JSON.stringify({ success: true, updates }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && init?.method === "POST") {
        updates = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true, updates }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("관리자 대시보드");

    const dataTab = screen.getByRole("tab", { name: "데이터 관리" });
    fireEvent.mouseDown(dataTab, { button: 0, ctrlKey: false });
    fireEvent.click(dataTab);
    await screen.findByText("데이터 임포트/엑스포트");
    const csv = [
      "이름,기본레벨,최대레벨,속성,주재료,부재료,주재료2,부재료2,획득여부,서식지,X데이터",
      '업로드헨치,170,195,드래곤,메인,서브,-,-,0,"업로드 지역",6',
    ].join("\n");
    const file = new File([csv], "monsters.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("득코 여부 사전 검증")).toBeInTheDocument();
    expect(fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/monsters") && init?.method === "POST")).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "검토 후 데이터 반영" }));

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/monsters") && init?.method === "POST");
      expect(saveCall).toBeDefined();
      const body = JSON.parse(String(saveCall?.[1]?.body));
      expect(body[0]).toMatchObject({ name: "업로드헨치", xAntibody: 6 });
    });

    await waitFor(() => {
      expect(updates).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: "몬스터 데이터 업로드" }),
      ]));
    });
  });

  it("parses and uploads an XLSX file so newly uploaded henches are recognized and existing image URLs are preserved", async () => {
    let savedMonsters: unknown[] = [];
    const monsterWithImage = { ...baselineMonster, imageUrl: "/manus-storage/preserved.webp" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([monsterWithImage]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && init?.method === "POST") {
        savedMonsters = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/feedbacks") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/updates/append") && init?.method === "POST") {
        return new Response(JSON.stringify({ success: true, updates: [JSON.parse(String(init.body))] }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["이름", "기본레벨", "최대레벨", "속성", "주재료", "부재료", "주재료2", "부재료2", "획득여부", "서식지", "X데이터"],
      ["기존헨치", 170, 195, "드래곤", "메인", "서브", "-", "-", "0", "기존 지역", 0],
      ["엑셀신규헨치", 170, 195, "드래곤", "재료A", "재료B", "-", "-", "0", "엑셀 지역", 4],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "헨치");
    const xlsxBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    render(<Admin />);
    await screen.findByText("관리자 대시보드");
    const dataTab = screen.getByRole("tab", { name: "데이터 관리" });
    fireEvent.mouseDown(dataTab, { button: 0, ctrlKey: false });
    fireEvent.click(dataTab);
    const file = new File([xlsxBytes], "monsters.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText("득코 여부 사전 검증")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "검토 후 데이터 반영" }));
    await waitFor(() => {
      expect(savedMonsters).toEqual([
        expect.objectContaining({ name: "기존헨치", imageUrl: "/manus-storage/preserved.webp" }),
        expect.objectContaining({ name: "엑셀신규헨치", main: "재료A", xAntibody: 4 }),
      ]);
      expect(fetchMock).toHaveBeenCalledWith("/api/monsters", expect.objectContaining({ method: "POST" }));
    });
  });

  it("bulk-updates the selected hench acquired status and habitat through the protected monster save endpoint", async () => {
    let savedMonsters: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      if (url.endsWith("/api/monsters") && init?.method === "POST") {
        savedMonsters = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true, monsters: savedMonsters }), { status: 200 });
      }
      if (url.endsWith("/api/updates")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/feedbacks")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/updates/append")) return new Response(JSON.stringify({ success: true, updates: [] }), { status: 200 });
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("기존헨치");
    fireEvent.click(screen.getByLabelText("기존헨치 선택"));
    fireEvent.change(screen.getByLabelText("일괄 득코 여부"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("일괄 서식지"), { target: { value: "짐승의 구역 5층" } });
    fireEvent.click(screen.getByRole("button", { name: "일괄 반영" }));

    await waitFor(() => expect(savedMonsters).toEqual([
      expect.objectContaining({ name: "기존헨치", acquired: "x", habitat: "짐승의 구역 5층" }),
    ]));
  });

  it("finds henches by their habitat, including a habitat stored alongside another region", async () => {
    const habitatMonster = { ...baselineMonster, id: "habitat-1", name: "서식지헨치", habitat: "엘리시움 5층, 바로크 145lv~" };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) return new Response(JSON.stringify([baselineMonster, habitatMonster]), { status: 200 });
      if (url.endsWith("/api/updates")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/feedbacks")) return new Response(JSON.stringify([]), { status: 200 });
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("서식지헨치");
    const searchInput = screen.getByPlaceholderText("몬스터 이름 또는 서식지 검색...");
    fireEvent.change(searchInput, { target: { value: "엘리시움 5층" } });
    expect(screen.getByText("서식지헨치")).toBeInTheDocument();
    expect(screen.queryByText("기존헨치")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "바로크 145lv" } });
    expect(screen.getByText("서식지헨치")).toBeInTheDocument();
  });

  it("uploads an image, immediately applies the server-protected cache-busting URL, and records an update", async () => {
    let savedMonsters: Array<typeof baselineMonster & { imageUrl?: string; imageVersion?: number }> = [baselineMonster];
    let updates: unknown[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(savedMonsters), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && init?.method === "POST") {
        savedMonsters = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(updates), { status: 200 });
      }
      if (url.endsWith("/api/feedbacks") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/updates/append") && init?.method === "POST") {
        updates = [...updates, JSON.parse(String(init.body))];
        return new Response(JSON.stringify({ success: true, updates }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && init?.method === "POST") {
        updates = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true, updates }), { status: 200 });
      }
      if (url.endsWith("/api/monster-image") && init?.method === "POST") {
        savedMonsters = [{
          ...baselineMonster,
          imageUrl: "/manus-storage/monster-images/baseline-1.webp",
          imageVersion: 1_786_955_000_000,
        }];
        return new Response(JSON.stringify({
          url: "/manus-storage/monster-images/baseline-1.webp",
          persisted: true,
          monster: {
            ...savedMonsters[0],
            imageUrl: "/api/monster-image?key=monster-images%2Fbaseline-1.webp&v=1786955000000",
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("관리자 대시보드");
    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 또는 서식지 검색..."), { target: { value: "기존헨치" } });
    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    const imageInput = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    const image = new File([new Uint8Array([137, 80, 78, 71])], "hench.png", { type: "image/png" });
    fireEvent.change(imageInput, { target: { files: [image] } });

    await waitFor(() => {
      const uploadCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/monster-image"));
      expect(uploadCall).toBeDefined();
      expect(JSON.parse(String(uploadCall?.[1]?.body))).toMatchObject({
        fileName: "hench.webp",
        contentType: "image/webp",
        data: "data:image/webp;base64,b3B0aW1pemVk",
      });
      expect(savedMonsters[0]).toMatchObject({
        imageUrl: "/manus-storage/monster-images/baseline-1.webp",
        imageVersion: 1_786_955_000_000,
      });
      expect(screen.getByAltText("Preview")).toHaveAttribute(
        "src",
        "/api/monster-image?key=monster-images%2Fbaseline-1.webp&v=1786955000000",
      );
      const wholeDatasetSave = fetchMock.mock.calls.find(([input, init]) =>
        String(input).endsWith("/api/monsters") && init?.method === "POST",
      );
      expect(wholeDatasetSave).toBeUndefined();
      expect(updates).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: "헨치 이미지 업로드" }),
      ]));
    });

    cleanup();
    const { default: Updates } = await import("./Updates");
    render(<Updates />);
    expect(await screen.findByText("헨치 이미지 업로드")).toBeInTheDocument();
  });

  it("requires a second confirmation before deleting a hench and keeps it when cancelled", async () => {
    let savedMonsters: unknown[] | null = null;
    let updates: unknown[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      }
      if (url.endsWith("/api/monsters") && init?.method === "POST") {
        savedMonsters = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ success: true, monsters: savedMonsters }), { status: 200 });
      }
      if (url.endsWith("/api/updates") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(updates), { status: 200 });
      }
      if (url.endsWith("/api/feedbacks") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/updates/append") && init?.method === "POST") {
        updates = [...updates, JSON.parse(String(init.body))];
        return new Response(JSON.stringify({ success: true, updates }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("관리자 대시보드");
    fireEvent.change(screen.getByPlaceholderText("몬스터 이름 또는 서식지 검색..."), { target: { value: "기존헨치" } });
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(await screen.findByRole("heading", { name: "헨치 삭제를 다시 확인하세요" })).toBeInTheDocument();
    expect(screen.getAllByText("기존헨치", { exact: false })).toHaveLength(2);
    expect(savedMonsters).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "헨치 삭제를 다시 확인하세요" })).not.toBeInTheDocument());
    expect(savedMonsters).toBeNull();
    expect(screen.getByText("기존헨치")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(await screen.findByRole("button", { name: "삭제 계속" }));
    await waitFor(() => {
      expect(savedMonsters).toEqual([]);
      expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ title: "헨치 데이터 삭제" })]));
    });
  });

  it("shows feedback submitted by another user from the server and saves its status", async () => {
    let feedbacks = [{
      id: "feedback-1",
      type: "suggestion",
      title: "공유 건의사항",
      content: "모든 관리자에게 보여야 합니다.",
      email: "user@example.com",
      createdAt: "2026-08-17T00:00:00.000Z",
      status: "pending",
    }];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/auth/members") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.endsWith("/api/monsters")) return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      if (url.endsWith("/api/updates")) return new Response(JSON.stringify([]), { status: 200 });
      if (url.endsWith("/api/feedbacks") && (!init || init.method === undefined || init.method === "GET")) {
        return new Response(JSON.stringify(feedbacks), { status: 200 });
      }
      if (url.endsWith("/api/feedbacks/feedback-1") && init?.method === "PATCH") {
        feedbacks = feedbacks.map(feedback => ({ ...feedback, status: JSON.parse(String(init.body)).status }));
        return new Response(JSON.stringify({ success: true, feedbacks }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Admin />);
    await screen.findByText("관리자 대시보드");
    const feedbackTab = screen.getByRole("tab", { name: "건의사항" });
    fireEvent.mouseDown(feedbackTab, { button: 0, ctrlKey: false });
    fireEvent.click(feedbackTab);
    expect(await screen.findByText("공유 건의사항")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "검토중" }));
    await waitFor(() => {
      expect(feedbacks[0]).toMatchObject({ status: "reviewing" });
      expect(fetchMock).toHaveBeenCalledWith("/api/feedbacks/feedback-1", expect.objectContaining({ method: "PATCH" }));
    });
  });

  it("keeps member management inside the left admin menu without a duplicate approval tab", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/api/monsters")) return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });

    render(<Admin />);
    await screen.findByText("관리자 대시보드");

    expect(screen.queryByRole("tab", { name: "회원 승인" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "회원 관리" })).toBeInTheDocument();
    expect(screen.getByTestId("admin-left-navigation").parentElement).toHaveClass("flex-row");
    expect(screen.queryByRole("link", { name: "회원 관리" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/auth/members", expect.anything());
  });

  it("dispatches a visual and audible marketplace alert preview from the administrator header", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/api/monsters")) return new Response(JSON.stringify([baselineMonster]), { status: 200 });
      if (String(input).endsWith("/api/admin/mobile/push-test")) return new Response(JSON.stringify({ success: true }), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });

    render(<Admin />);
    fireEvent.click(await screen.findByRole("button", { name: /알림 테스트/ }));

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "abyss:marketplace-alert-test" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/mobile/push-test", { method: "POST" });
    });
  });

  it("renders a bounded first page of large monster data and expands the list only on request", async () => {
    const manyMonsters = Array.from({ length: 85 }, (_, index) => ({
      ...baselineMonster,
      id: `performance-${index}`,
      name: `성능 헨치${index}`,
    }));
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).endsWith("/api/monsters")) return new Response(JSON.stringify(manyMonsters), { status: 200 });
      return new Response(JSON.stringify([]), { status: 200 });
    });

    render(<Admin />);
    await screen.findByText("성능 헨치0");
    expect(screen.getByTestId("admin-dashboard")).toHaveClass("abyss-admin-page");
    expect(screen.getAllByTestId("admin-monster-row")).toHaveLength(80);

    fireEvent.click(screen.getByRole("button", { name: /더 보기/ }));
    expect(screen.getAllByTestId("admin-monster-row")).toHaveLength(85);
  });
});
