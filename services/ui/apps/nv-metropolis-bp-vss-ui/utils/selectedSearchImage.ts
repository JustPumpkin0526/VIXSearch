import type {
  SelectedSearchImage,
} from '../types/imageSearch';

const MAX_IMAGE_BYTES =
  2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

function readFileAsDataUrl(
  file: File,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result ===
          'string'
        ) {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            '이미지 데이터를 읽지 못했습니다.',
          ),
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            '이미지 파일을 읽는 중 오류가 발생했습니다.',
          ),
        );
      };

      reader.readAsDataURL(file);
    },
  );
}

export async function createSelectedSearchImage(
  file: File,
): Promise<SelectedSearchImage> {
  if (
    !ALLOWED_IMAGE_TYPES.has(
      file.type,
    )
  ) {
    throw new Error(
      'JPEG, PNG 및 WEBP 이미지만 사용할 수 있습니다.',
    );
  }

  if (file.size === 0) {
    throw new Error(
      '비어 있는 이미지 파일은 사용할 수 없습니다.',
    );
  }

  if (
    file.size >
    MAX_IMAGE_BYTES
  ) {
    throw new Error(
      '이미지 파일은 2 MiB 이하여야 합니다.',
    );
  }

  const base64 =
    await readFileAsDataUrl(
      file,
    );

  return {
    file,
    previewUrl: base64,
    base64,
    contentType: file.type,
  };
}