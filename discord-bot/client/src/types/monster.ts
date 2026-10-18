export interface Monster {
  id: string;
  name: string;
  habitat: string;
  main: string | null;
  sub: string | null;
  main2: string | null;
  sub2: string | null;
  attribute: string;
  /** 장코/단코 구분 (부화 기간 종류) */
  type?: string;
  baseLevel: number;
  maxLevel: number;
  acquired: string;
  xAntibody?: number;
  imageUrl?: string;
  /** 이미지 파일을 교체할 때 보호 프록시 URL을 갱신하기 위한 버전 값입니다. */
  imageVersion?: number;
}

export type AttributeType = '악마' | '짐승' | '새' | '드래곤' | '식물' | '메탈' | '곤충' | '미스터리';
