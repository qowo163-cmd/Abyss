import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, AlertCircle, Lightbulb, Bug } from 'lucide-react';
import { submitServerFeedback, type FeedbackItem } from '@/lib/feedback';

export default function Feedback() {
  const [feedbackType, setFeedbackType] = useState<'error' | 'suggestion'>('suggestion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요');
      return;
    }

    setIsSubmitting(true);

    const newFeedback: FeedbackItem = {
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: feedbackType,
      title,
      content,
      email: email || '익명',
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    try {
      await submitServerFeedback(newFeedback);
      window.dispatchEvent(new Event('feedbacks-updated'));
      toast.success('건의사항이 전송되었습니다. 관리자가 실시간으로 확인할 수 있습니다.');
      setTitle('');
      setContent('');
      setEmail('');
      setFeedbackType('suggestion');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('건의사항 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 헤더 */}
      <header className="border-b border-cyan-500/20 bg-gradient-to-b from-slate-900 to-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <h1 className="text-lg sm:text-2xl font-bold text-cyan-300">건의사항</h1>
          <p className="text-xs sm:text-sm text-slate-400">사이트 오류나 개선 사항을 알려주세요</p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        {/* 건의사항 폼 */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 유형 선택 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">유형</label>
              <Select value={feedbackType} onValueChange={(value) => setFeedbackType(value as 'error' | 'suggestion')}>
                <SelectTrigger className="bg-slate-700/50 border-slate-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-red-400" />
                      오류 보고
                    </div>
                  </SelectItem>
                  <SelectItem value="suggestion">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-400" />
                      건의사항
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="bg-slate-700/50 border-slate-600"
              />
            </div>

            {/* 내용 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">내용</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="상세한 내용을 입력해주세요"
                className="bg-slate-700/50 border-slate-600 min-h-32"
              />
            </div>

            {/* 이메일 (선택) */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">이메일 (선택사항)</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="회신받을 이메일 주소 (선택)"
                className="bg-slate-700/50 border-slate-600"
              />
            </div>

            {/* 제출 버튼 */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? '전송 중...' : '건의사항 전송'}
            </Button>
          </form>

          {/* 안내 메시지 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-200">
              <p className="font-semibold mb-1">소중한 의견 감사합니다!</p>
              <p>건의하신 내용은 관리자가 검토하여 사이트 개선에 반영됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
