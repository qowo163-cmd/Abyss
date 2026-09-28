diff --git a/client/src/pages/MainHome.tsx b/client/src/pages/MainHome.tsx
--- a/client/src/pages/MainHome.tsx
+++ b/client/src/pages/MainHome.tsx
@@ -1,4 +1,4 @@
-import { useMemo } from 'react';
+import { useMemo, useState } from 'react';
 import { Link } from 'wouter';
@@ -121,6 +121,10 @@ export default function MainHome() {

   const latestUpdates = updates.slice(0, 3);
+  const [discordCode, setDiscordCode] = useState<string | null>(null);
+  const [discordLoading, setDiscordLoading] = useState(false);
+  const [discordError, setDiscordError] = useState('');
+
+  const createDiscordLinkCode = async () => {
+    setDiscordLoading(true);
+    setDiscordError('');
+    try {
+      const response = await fetch('/api/auth/discord-link-code', { method: 'POST', credentials: 'include' });
+      const data = await response.json();
+      if (!response.ok) throw new Error(data.message || '연동 코드를 만들 수 없습니다.');
+      setDiscordCode(data.code);
+    } catch (error) {
+      setDiscordError(error instanceof Error ? error.message : '연동 코드를 만들 수 없습니다.');
+    } finally {
+      setDiscordLoading(false);
+    }
+  };

   return (
@@ -145,15 +159,28 @@ export default function MainHome() {
             <img data-testid="abyss-home-mascot-background" src="/manus-storage/abyss-home-mascot_a3e91255.png" alt="출발점 마스코트 배경 장식" className="pointer-events-none absolute -right-12 bottom-0 h-52 w-60 select-none rounded-[3rem] object-cover opacity-[0.16] mix-blend-screen [mask-image:linear-gradient(to_top,black_30%,transparent_92%)] sm:right-4 sm:h-72 sm:w-80" decoding="async" />
             <div className="relative z-10 mb-6 flex justify-end sm:absolute sm:right-7 sm:top-7 sm:mb-0">
-              <Link
+              <button
+                type="button"
                 data-testid="abyss-discord-link"
-                href="/discord"
+                onClick={() => void createDiscordLinkCode()}
+                disabled={discordLoading}
                 className="group inline-flex items-center gap-2 rounded-xl border border-violet-100/30 bg-slate-950/55 px-3.5 py-2.5 text-xs font-extrabold text-violet-50 shadow-lg shadow-slate-950/30 transition duration-200 hover:border-violet-100/70 hover:bg-violet-300/15 active:scale-[0.97]"
               >
                 <MessageCircle className="h-4 w-4 text-violet-200 transition-transform duration-200 group-hover:scale-110" />
-                디스코드 연동하기
-              </Link>
+                {discordLoading ? '코드 생성 중...' : '디스코드 연동하기'}
+              </button>
+              {discordCode && (
+                <div className="absolute right-0 top-full z-30 mt-3 w-72 rounded-xl border border-cyan-300/30 bg-slate-950/95 p-4 text-center shadow-2xl backdrop-blur-md">
+                  <p className="text-xs text-slate-400">Discord에서 아래 명령어를 입력하세요.</p>
+                  <p className="mt-2 font-mono text-2xl font-black tracking-widest text-cyan-300">{discordCode}</p>
+                  <p className="mt-2 text-sm text-slate-200">/link code:{discordCode}</p>
+                  <p className="mt-2 text-[11px] text-amber-300">코드는 10분 후 만료됩니다.</p>
+                </div>
+              )}
+              {discordError && (
+                <p className="absolute right-0 top-full z-30 mt-3 rounded-lg border border-red-400/30 bg-slate-950/95 px-3 py-2 text-xs text-red-300 shadow-xl">
+                  {discordError}
+                </p>
+              )}
             </div>
diff --git a/client/src/pages/MainHome.test.tsx b/client/src/pages/MainHome.test.tsx
--- a/client/src/pages/MainHome.test.tsx
+++ b/client/src/pages/MainHome.test.tsx
@@ -48,8 +48,8 @@ describe('MainHome', () => {
     expect(screen.queryByTestId('abyss-android-download-trigger')).not.toBeInTheDocument();
     expect(screen.queryByTestId('abyss-android-apk-download')).not.toBeInTheDocument();
     expect(screen.queryByRole('dialog', { name: 'ABYSS 앱 다운로드' })).not.toBeInTheDocument();
-    expect(screen.getByTestId('abyss-discord-link')).toHaveAttribute('href', '/discord');
-    expect(screen.getByRole('link', { name: /디스코드 연동하기/ })).toBeInTheDocument();
+    expect(screen.getByTestId('abyss-discord-link')).toHaveAttribute('type', 'button');
+    expect(screen.getByRole('button', { name: /디스코드 연동하기/ })).toBeInTheDocument();
     const attributeOverview = screen.getByRole('region', { name: '속성별 헨치 현황' });
