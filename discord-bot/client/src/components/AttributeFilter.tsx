import { attributeImages, attributeColors } from '@/data/attributeImages';
import { cn } from '@/lib/utils';
import { AttributeType } from '@/types/monster';

interface AttributeFilterProps {
  selectedAttributes: Set<AttributeType>;
  onAttributeToggle: (attribute: AttributeType) => void;
  counts: Record<string, number>;
}

const ATTRIBUTES: AttributeType[] = ['악마', '짐승', '새', '드래곤', '식물', '메탈', '곤충', '미스터리'];

export function AttributeFilter({ selectedAttributes, onAttributeToggle, counts }: AttributeFilterProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-cyan-300 uppercase tracking-wider">속성 필터</h3>
      <div className="space-y-1">
        {ATTRIBUTES.map((attr) => {
          const colors = attributeColors[attr];
          const image = attributeImages[attr];
          const isSelected = selectedAttributes.has(attr);
          const count = counts[attr] || 0;

          return (
            <button
              key={attr}
              onClick={() => onAttributeToggle(attr)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
                'border border-transparent hover:border-cyan-400/50',
                isSelected
                  ? 'bg-gradient-to-r from-cyan-500/30 to-cyan-600/20 border-cyan-400/70 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/50 hover:bg-slate-700/50'
              )}
            >
              {/* 속성 아이콘 */}
              <div className="relative h-6 w-6 flex-shrink-0 rounded-full overflow-hidden border border-slate-600">
                <img src={image} alt={attr} className="h-full w-full object-cover opacity-70" />
              </div>

              {/* 속성명 및 개수 */}
              <div className="flex-1 text-left">
                <span className={cn('text-sm font-semibold', isSelected ? 'text-cyan-300' : 'text-slate-300')}>
                  {attr}
                </span>
              </div>

              {/* 개수 배지 */}
              <span
                className={cn(
                  'text-xs font-bold px-2 py-0.5 rounded-full',
                  isSelected ? 'bg-cyan-500/40 text-cyan-200' : 'bg-slate-700 text-slate-400'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 전체 선택/해제 */}
      <div className="pt-2 border-t border-slate-700">
        <button
          onClick={() => {
            // onAttributeToggle을 통해 각 속성을 개별적으로 토글
            if (selectedAttributes.size === ATTRIBUTES.length) {
              // 모두 해제
              ATTRIBUTES.forEach((attr) => {
                if (selectedAttributes.has(attr)) {
                  onAttributeToggle(attr);
                }
              });
            } else {
              // 모두 선택
              ATTRIBUTES.forEach((attr) => {
                if (!selectedAttributes.has(attr)) {
                  onAttributeToggle(attr);
                }
              });
            }
          }}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-xs font-semibold text-slate-300 hover:text-cyan-300 transition-colors"
        >
          {selectedAttributes.size === ATTRIBUTES.length ? '모두 해제' : '모두 선택'}
        </button>
      </div>
    </div>
  );
}
