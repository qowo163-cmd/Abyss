// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NewbieGuide from "./NewbieGuide";

describe("NewbieGuide", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the workbook guide without extra introductory text or separate image cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ categories: ["시작하기", "기본 조작"], topics: [{ id: "site", category: "시작하기", title: "공식 사이트·회원가입", description: "회원가입 사이트와 믹스사이트 진입 안내입니다.", image: "/manus-storage/test-site-continuous.webp", preview: "/manus-storage/test-site-preview.webp", imageCount: 2, links: [{ label: "회원가입 바로가기", href: "https://abyssmm.com/" }] }, { id: "controls", category: "기본 조작", title: "조작방법", image: "/manus-storage/test-control-continuous.webp", preview: "/manus-storage/test-control-preview.webp", imageCount: 4 }] }), { status: 200 })));
    render(<NewbieGuide />);

    expect(screen.getByRole("heading", { name: "뉴비가이드" })).toBeInTheDocument();
    expect(await screen.findByAltText("공식 사이트·회원가입 엑셀 원본 가이드")).toHaveAttribute("src", "/manus-storage/test-site-continuous.webp");
    expect(screen.getByText("회원가입 사이트와 믹스사이트 진입 안내입니다.")).toBeInTheDocument();
    expect(document.querySelector("source")).toHaveAttribute("srcset", "/manus-storage/test-site-preview.webp");
    expect(screen.queryByRole("button", { name: "전체" })).not.toBeInTheDocument();
    expect(screen.queryByText("사이트 이용 빠른 시작")).not.toBeInTheDocument();
    expect(screen.queryByText("안전한 거래 체크")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시작하기" })).toHaveClass("whitespace-nowrap", "text-xs");
    expect(screen.getByRole("button", { name: /공식 사이트·회원가입/ })).toHaveClass("text-sm");
  });

  it("shows a selected tab as one continuous high-resolution workbook image and restores workbook hyperlinks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      categories: ["시작하기", "자동사냥·축용", "인첸트"],
      topics: [
        { id: "site", category: "시작하기", title: "공식 사이트·회원가입", image: "/manus-storage/test-site-continuous.webp", preview: "/manus-storage/test-site-preview.webp", imageCount: 2, links: [{ label: "회원가입 바로가기", href: "https://abyssmm.com/" }] },
        { id: "auto-hunt", category: "자동사냥·축용", title: "자동사냥 가이드", image: "/manus-storage/test-auto-hunt-continuous.webp", imageCount: 3 },
        { id: "enchant-3", category: "인첸트", title: "인첸트 3단계", image: "/manus-storage/test-enchant-continuous.webp", imageCount: 16 },
      ],
    }), { status: 200 })));

    render(<NewbieGuide />);

    expect(await screen.findByRole("link", { name: /회원가입 바로가기/ })).toHaveAttribute("href", "https://abyssmm.com/");
    expect(screen.queryByRole("link", { name: /믹스사이트 바로가기/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "자동사냥·축용" }));
    const autoHuntTopic = await screen.findByRole("button", { name: /자동사냥 가이드/ });
    fireEvent.click(autoHuntTopic);
    expect(await screen.findByAltText("자동사냥 가이드 엑셀 원본 가이드")).toHaveAttribute("src", "/manus-storage/test-auto-hunt-continuous.webp");
    fireEvent.click(screen.getByRole("button", { name: "인첸트" }));
    fireEvent.click(await screen.findByRole("button", { name: /인첸트 3단계/ }));
    expect(await screen.findByAltText("인첸트 3단계 엑셀 원본 가이드")).toHaveAttribute("src", "/manus-storage/test-enchant-continuous.webp");
    expect(screen.queryByText(/^안내 1$/)).not.toBeInTheDocument();
  });
});
