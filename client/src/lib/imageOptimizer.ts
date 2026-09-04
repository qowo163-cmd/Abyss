export const MAX_UPLOAD_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_OPTIMIZED_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2048;

export interface OptimizedImage {
  file: File;
  dataUrl: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export function getScaledDimensions(width: number, height: number, maxEdge = MAX_IMAGE_EDGE) {
  if (width <= maxEdge && height <= maxEdge) return { width, height };
  const scale = maxEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 파일을 열 수 없습니다'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('이미지 압축에 실패했습니다'));
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('최적화된 이미지를 읽을 수 없습니다'));
    reader.readAsDataURL(blob);
  });
}

export async function optimizeImageForUpload(source: File): Promise<OptimizedImage> {
  if (!source.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다');
  if (source.size > MAX_UPLOAD_SOURCE_BYTES) throw new Error('원본 이미지는 20MB 이하만 업로드할 수 있습니다');

  const image = await getImageElement(source);
  let { width, height } = getScaledDimensions(image.naturalWidth, image.naturalHeight);
  let quality = 0.95;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 캔버스를 만들 수 없습니다');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    blob = await canvasToBlob(canvas, quality);
    if (blob.size <= MAX_OPTIMIZED_IMAGE_BYTES) break;

    if (quality > 0.83) quality -= 0.03;
    else {
      width = Math.max(1, Math.round(width * 0.9));
      height = Math.max(1, Math.round(height * 0.9));
      quality = 0.9;
    }
  }

  if (!blob || blob.size > MAX_OPTIMIZED_IMAGE_BYTES) {
    throw new Error('이미지가 너무 커서 고화질 최적화를 완료할 수 없습니다. 더 작은 이미지를 선택해주세요');
  }

  const baseName = source.name.replace(/\.[^.]+$/, '') || 'hench-image';
  const optimizedFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
  return {
    file: optimizedFile,
    dataUrl: await blobToDataUrl(blob),
    originalBytes: source.size,
    optimizedBytes: blob.size,
    width,
    height,
  };
}
