/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Feedback from "./Feedback";

describe("Feedback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a feedback item to the shared server endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/api/feedbacks") && init?.method === "POST") {
        return new Response(JSON.stringify({ success: true, feedbacks: [] }), { status: 201 });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404 });
    });

    render(<Feedback />);
    fireEvent.change(screen.getByPlaceholderText("제목을 입력하세요"), { target: { value: "공유 저장 테스트" } });
    fireEvent.change(screen.getByPlaceholderText("상세한 내용을 입력해주세요"), { target: { value: "관리자 화면에 표시되어야 합니다." } });
    fireEvent.click(screen.getByRole("button", { name: "건의사항 전송" }));

    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([input, init]) => String(input).endsWith("/api/feedbacks") && init?.method === "POST");
      expect(request).toBeDefined();
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
        title: "공유 저장 테스트",
        content: "관리자 화면에 표시되어야 합니다.",
        status: "pending",
      });
    });
  });
});
