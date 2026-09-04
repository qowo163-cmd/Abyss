import { memo } from 'react';
import { Monster } from '@/types/monster';
import { attributeColors, attributeImages } from '@/data/attributeImages';
import { Heart, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonsterCardProps {
  monster: Monster;
  onClick?: () => void;
}

function MonsterCardComponent({ monster, onClick }: MonsterCardProps) {
  const colors = attributeColors[monster.attribute] || attributeColors['악마'];
  const image = monster.imageUrl || attributeImages[monster.attribute] || attributeImages['악마'];

  return (
    <div
      onClick={onClick}
      className="abyss-dim-card group relative h-full cursor-pointer overflow-hidden rounded-lg border border-cyan-500/30 transition-all duration-300 hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-500/20"
    >
      {/* 배경 그래디언트 */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-10', colors.bg)} />

      {/* 이미지 영역 */}
      <div className="abyss-dim-card-media relative h-32 overflow-hidden">
        <img
          src={image}
          alt={monster.name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          className="h-full w-full object-cover opacity-60 transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

        {/* 속성 배지 */}
        <div className={cn('absolute right-2 top-2 rounded-full px-3 py-1 text-xs font-bold', colors.text, colors.bg)}>
          {monster.attribute}
        </div>

        {/* 레벨 배지 */}
        <div className="absolute bottom-2 left-2 rounded-lg bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-300 border border-cyan-400/50">
          Lv. {monster.baseLevel}
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="relative space-y-3 p-3">
        {/* 이름 */}
        <div>
          <h3 className="truncate text-base font-bold text-cyan-100 group-hover:text-cyan-300 transition-colors">
            {monster.name}
          </h3>
          <p className="text-xs text-slate-400">{monster.attribute}</p>
        </div>

        {/* 레벨 범위 */}
        <div className="flex items-center gap-1 text-xs text-slate-300">
          <Heart className="h-3 w-3 text-red-400" />
          <span>Lv. {monster.baseLevel} ~ {monster.maxLevel}</span>
        </div>

        {/* X데이터 필요 수량 */}
        {Number(monster.xAntibody) > 0 && (
          <div className="flex items-center gap-2">
            <span className="abyss-x-data-badge px-2 py-1 text-xs">
              X데이터 {monster.xAntibody}개 필요
            </span>
          </div>
        )}

        {/* 서식지 */}
        {monster.habitat && (
          <div className="flex items-start gap-1">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-400" />
            <p className="text-xs text-slate-400 line-clamp-2">{monster.habitat}</p>
          </div>
        )}

        {/* 믹스 공식 미리보기 */}
        {(monster.main || monster.sub) && (
          <div className="border-t border-slate-700 pt-2 mt-2">
            <p className="text-xs text-slate-400 mb-1">믹스 공식</p>
            <div className="flex items-center gap-1 flex-wrap">
              {monster.main && (
                <span className="inline-block rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-400/30">
                  {monster.main}
                </span>
              )}
              {monster.sub && (
                <span className="inline-block rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300 border border-blue-400/30">
                  {monster.sub}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 호버 효과 */}
      <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-10" />
    </div>
  );
}

export const MonsterCard = memo(MonsterCardComponent);
