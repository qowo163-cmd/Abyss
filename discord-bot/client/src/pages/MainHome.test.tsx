// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import defaultMonsters from '@/data/monsters.json';
import { replaceMonsterData } from '@/hooks/useMonsterData';
import MainHome from './MainHome';

describe('MainHome', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    act(() => replaceMonsterData(defaultMonsters as never[]));
  });

  it('shows the redesigned core journeys, live data snapshot, and recent updates', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })));
    act(() => {
      replaceMonsterData([
        {
          id: 'home-dragon', name: '홈드래곤', habitat: '엘리시움 5층, 바로크 145lv~', attribute: '드래곤',
          baseLevel: 180, maxLevel: 200, acquired: '0', main: '재료A', sub: '재료B', main2: null, sub2: null,
        },
        {
          id: 'home-beast', name: '홈짐승', habitat: '짐승의 구역 5층', attribute: '짐승',
          baseLevel: 170, maxLevel: 190, acquired: '1', main: null, sub: null, main2: null, sub2: null,
        },
      ] as never[]);
    });

    render(<MainHome />);

    expect(document.querySelector('.abyss-fantasy-page')).toBeInTheDocument();
    expect(document.querySelector('.abyss-hero-copy')).toBeInTheDocument();
    expect(document.querySelector('.abyss-guide-status-badge')).toHaveTextContent('ABYSS DATABASE / LIVE GUIDE');
    expect(document.querySelector('.abyss-hero-title-primary')).toHaveTextContent('다음 믹스를 위한');
    expect(document.querySelector('.abyss-hero-title-highlight')).toHaveTextContent('가장 빠른 출발점.');
    expect(screen.getByRole('heading', { name: /다음 믹스를 위한/ })).toBeInTheDocument();
    expect(screen.getByTestId('abyss-home-hero-card')).toBeInTheDocument();
    expect(screen.getByTestId('abyss-home-mascot-background')).toHaveAttribute('src', '/manus-storage/abyss-home-mascot_a3e91255.png');
    expect(screen.getByTestId('abyss-home-mascot-background')).toHaveClass('opacity-[0.16]');
    expect(screen.getByRole('link', { name: /헨치 바로 찾기/ })).toHaveAttribute('href', '/hench');
    expect(screen.getAllByRole('link', { name: /어비스거래소/ }).some((link) => link.getAttribute('href') === '/marketplace')).toBe(true);
    expect(screen.getAllByRole('link', { name: /뉴비가이드/ }).some((link) => link.getAttribute('href') === '/guide')).toBe(true);
    expect(screen.getByText('득코 가능 헨치').previousElementSibling).toHaveTextContent('1');
    expect(screen.getByText('서식지').parentElement).toHaveTextContent('3');
    expect(screen.getByRole('heading', { name: '최근 업데이트' })).toBeInTheDocument();
    expect(screen.queryByTestId('abyss-android-download-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('abyss-android-apk-download')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'ABYSS 앱 다운로드' })).not.toBeInTheDocument();
    expect(screen.getByTestId('abyss-discord-link')).toHaveAttribute('href', '/discord');
    expect(screen.getByRole('link', { name: /디스코드 연동하기/ })).toBeInTheDocument();
    const attributeOverview = screen.getByRole('region', { name: '속성별 헨치 현황' });
    expect(within(attributeOverview).queryByRole('link')).not.toBeInTheDocument();
    expect(within(attributeOverview).getByText('드래곤')).toBeInTheDocument();
    expect(Array.from(attributeOverview.querySelectorAll('[data-attribute]')).map((card) => card.getAttribute('data-attribute'))).toEqual([
      '드래곤', '악마', '짐승', '새', '곤충', '식물', '미스터리', '메탈',
    ]);
  });

  it('uses the same responsive landing experience for the mobile home module', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })));
    const MobileMainHome = (await import('./MobileMainHome')).default;
    render(<MobileMainHome />);
    expect(screen.getByRole('heading', { name: '무엇을 도와드릴까요?' })).toBeInTheDocument();
  });
  it('shows updates recorded by the server instead of relying only on the bundled JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/updates') {
        return new Response(JSON.stringify([{
          id: 'railway-commit-new-test', date: '2026-10-10T00:00:00.000Z', version: 'v3.100.10',
          title: '자동 배포 업데이트 테스트', description: 'GitHub 변경 내용이 배포 기록으로 반영되었습니다.',
          changes: ['홈 화면에서 서버 업데이트 이력을 표시'], type: 'improvement',
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(null, { status: 304 });
    }));
    render(<MainHome />);
    expect(await screen.findByText('자동 배포 업데이트 테스트')).toBeInTheDocument();
    expect(screen.getByText('v3.100.10')).toBeInTheDocument();
  });

});
