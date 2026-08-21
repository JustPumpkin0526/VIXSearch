import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';

import type {
  ImageSearchRequest,
} from '../../types/imageSearch';

type ErrorResponse = {
  message: string;
  detail?: unknown;
};

const MAX_BASE64_LENGTH =
  15 * 1024 * 1024;

const MAX_IMAGE_BYTES =
  2 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

function resolveAgentBaseUrl(): string {
  const value =
    process.env.VSS_AGENT_URL;

  if (!value) {
    throw new Error(
      'VSS Agent URL is not configured. ' +
        'Set VSS_AGENT_URL in the UI environment.',
    );
  }

  return value.replace(/\/+$/, '');
}

function stripImageDataUri(
  value: string,
): string {
  return value.replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    '',
  );
}

function getImageExtension(
  contentType: string,
): string {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    unknown | ErrorResponse
  >,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    res.status(405).json({
      message: 'Method not allowed',
    });

    return;
  }

  const body =
    req.body as ImageSearchRequest;

  if (
    !body.imageBase64 ||
    typeof body.imageBase64 !== 'string'
  ) {
    res.status(400).json({
      message:
        'imageBase64 is required',
    });

    return;
  }

  const searchMode =
    body.searchMode ?? 'object';

  if (
    searchMode !== 'object' &&
    searchMode !== 'face'
  ) {
    res.status(400).json({
      message:
        'searchMode must be either object or face',
    });

    return;
  }

  const contentType =
    body.contentType ??
    'image/jpeg';

  if (
    !ALLOWED_CONTENT_TYPES.has(
      contentType,
    )
  ) {
    res.status(415).json({
      message:
        'Only JPEG, PNG and WEBP images are supported',
    });

    return;
  }

  /*
   * 크롭 이미지가 있으면 크롭 이미지를
   * 실제 검색 이미지로 사용합니다.
   */
  const selectedImageBase64 =
    typeof body.croppedImageBase64 ===
      'string' &&
    body.croppedImageBase64.trim()
      ? body.croppedImageBase64.trim()
      : body.imageBase64;

  /*
   * 실제로 전송할 이미지 기준으로
   * Base64 문자열 크기를 검사합니다.
   */
  if (
    selectedImageBase64.length >
    MAX_BASE64_LENGTH
  ) {
    res.status(413).json({
      message:
        'Uploaded image is too large',
    });

    return;
  }

  const requestedMaxResults =
    typeof body.maxResults ===
      'number' &&
    Number.isFinite(body.maxResults)
      ? Math.floor(body.maxResults)
      : 10;

  const maxResults = Math.min(
    Math.max(
      requestedMaxResults,
      1,
    ),
    100,
  );

  try {
    const normalizedBase64 =
      stripImageDataUri(
        selectedImageBase64,
      );

    if (!normalizedBase64) {
      res.status(400).json({
        message:
          'Decoded image data is empty',
      });

      return;
    }

    const imageBuffer =
      Buffer.from(
        normalizedBase64,
        'base64',
      );

    if (imageBuffer.length === 0) {
      res.status(400).json({
        message:
          'Decoded image data is empty',
      });

      return;
    }

    /*
     * Agent image_search.py의 제한과
     * 동일하게 실제 파일 크기를 검사합니다.
     */
    if (
      imageBuffer.length >
      MAX_IMAGE_BYTES
    ) {
      res.status(413).json({
        message:
          'Uploaded image exceeds the 2 MiB limit',
      });

      return;
    }

    const agentBaseUrl =
      resolveAgentBaseUrl();

    const formData =
      new FormData();

    const extension =
      getImageExtension(
        contentType,
      );

    const imageBytes =
      new Uint8Array(
        imageBuffer,
      );

    formData.append(
      'file',
      new Blob(
        [imageBytes],
        {
          type: contentType,
        },
      ),
      `search-image.${extension}`,
    );

    /*
     * Chat.tsx의 camelCase 값을
     * Python API의 snake_case 필드로
     * 변환해 전달합니다.
     */
    formData.append(
      'search_mode',
      searchMode,
    );

    /*
     * 값이 명시적으로 전달된 경우에만
     * Agent에 전달합니다.
     *
     * 전달되지 않았다면 image_search.py가
     * 모드별 기본 임계값을 결정합니다.
     */
    if (
      typeof body.minSimilarity ===
        'number' &&
      Number.isFinite(
        body.minSimilarity,
      )
    ) {
      const minSimilarity =
        Math.min(
          Math.max(
            body.minSimilarity,
            0,
          ),
          1,
        );

      formData.append(
        'min_similarity',
        String(minSimilarity),
      );
    }

    const sensorIds =
      Array.isArray(body.sensorIds)
        ? body.sensorIds
            .filter(
              (
                value,
              ): value is string =>
                typeof value ===
                  'string' &&
                value.trim().length >
                  0,
            )
            .map(value =>
              value.trim(),
            )
        : [];

    if (sensorIds.length > 0) {
      formData.append(
        'sensor_ids',
        sensorIds.join(','),
      );
    }

    const requestUrl =
      new URL(
        `${agentBaseUrl}/api/v1/image-search`,
      );

    requestUrl.searchParams.set(
      'top_k',
      String(maxResults),
    );

    console.info(
      '[ImageSearch API] forwarding request',
      {
        searchMode,
        maxResults,
        sensorCount:
          sensorIds.length,
        minSimilarity:
          body.minSimilarity,
        usingCroppedImage:
          selectedImageBase64 !==
          body.imageBase64,
      },
    );

    const response =
      await fetch(
        requestUrl,
        {
          method: 'POST',
          body: formData,
        },
      );

    const responseText =
      await response.text();

    let responseBody: unknown;

    try {
      responseBody =
        responseText
          ? JSON.parse(
              responseText,
            )
          : {};
    } catch {
      responseBody = {
        message: responseText,
      };
    }

    if (!response.ok) {
      res
        .status(response.status)
        .json({
          message:
            'Image similarity search failed',
          detail: responseBody,
        });

      return;
    }

    res
      .status(200)
      .json(responseBody);
  } catch (error) {
    console.error(
      'Image search API route failed:',
      error,
    );

    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : 'Unexpected image search error',
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};