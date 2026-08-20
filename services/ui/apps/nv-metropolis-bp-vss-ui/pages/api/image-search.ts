import type {
  NextApiRequest,
  NextApiResponse,
} from 'next';

type ImageSearchRequest = {
  imageBase64?: string;
  contentType?: string;
  maxResults?: number;
  minSimilarity?: number;
  sensorIds?: string[];
  croppedImageBase64?: string; // optional pre-cropped image data URI or base64
};

type ErrorResponse = {
  message: string;
  detail?: unknown;
};

const MAX_BASE64_LENGTH = 15 * 1024 * 1024;

function resolveAgentBaseUrl(): string {
  const value = process.env.VSS_AGENT_URL;

  if (!value) {
    throw new Error(
      'VSS Agent URL is not configured. ' +
        'Set VSS_AGENT_URL in the UI environment.',
    );
  }

  return value.replace(/\/+$/, '');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<unknown | ErrorResponse>,
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    res.status(405).json({
      message: 'Method not allowed',
    });

    return;
  }

  const body = req.body as ImageSearchRequest;

  if (
    !body.imageBase64 ||
    typeof body.imageBase64 !== 'string'
  ) {
    res.status(400).json({
      message: 'imageBase64 is required',
    });

    return;
  }

  if (body.imageBase64.length > MAX_BASE64_LENGTH) {
    res.status(413).json({
      message: 'Uploaded image is too large',
    });

    return;
  }

  const contentType =
    body.contentType || 'image/jpeg';

  const allowedTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  if (!allowedTypes.has(contentType)) {
    res.status(415).json({
      message:
        'Only JPEG, PNG and WEBP images are supported',
    });

    return;
  }

  const maxResults = Math.min(
    Math.max(body.maxResults || 10, 1),
    100,
  );

  try {
    const agentBaseUrl =
      resolveAgentBaseUrl();

    /*
     * croppedImageBase64가 있으면 크롭 이미지를 우선 사용하고,
     * 없으면 원본 이미지를 사용합니다.
     */
    const selectedImageBase64 =
      body.croppedImageBase64?.trim() ||
      body.imageBase64;

    const normalizedBase64 =
      selectedImageBase64.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        '',
      );

    const imageBuffer = Buffer.from(
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
     * Agent image_search.py의 제한과 동일하게
     * 디코딩된 실제 파일 크기를 검사합니다.
     */
    const maxImageBytes =
      2 * 1024 * 1024;

    if (
      imageBuffer.length >
      maxImageBytes
    ) {
      res.status(413).json({
        message:
          'Uploaded image exceeds the 2 MiB limit',
      });

      return;
    }

    const formData = new FormData();

    const extension =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : 'jpg';

    const imageBytes =
      new Uint8Array(imageBuffer);

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

    formData.append(
      'min_similarity',
      String(
        body.minSimilarity ?? 0,
      ),
    );

    const sensorIds =
      Array.isArray(body.sensorIds)
        ? body.sensorIds
            .filter(
              (value): value is string =>
                typeof value === 'string' &&
                value.trim().length > 0,
            )
            .map(value => value.trim())
        : [];

    if (sensorIds.length > 0) {
      formData.append(
        'sensor_ids',
        sensorIds.join(','),
      );
    }

    const requestUrl = new URL(
      `${agentBaseUrl}/api/v1/image-search`,
    );

    requestUrl.searchParams.set(
      'top_k',
      String(maxResults),
    );

    const response = await fetch(
      requestUrl,
      {
        method: 'POST',
        body: formData,
      },
    );

    const responseText = await response.text();

    let responseBody: unknown;

    try {
      responseBody = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      responseBody = {
        message: responseText,
      };
    }

    if (!response.ok) {
      res.status(response.status).json({
        message: 'Image similarity search failed',
        detail: responseBody,
      });

      return;
    }

    res.status(200).json(responseBody);
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