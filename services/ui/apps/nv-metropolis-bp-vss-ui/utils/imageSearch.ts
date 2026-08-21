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
  startTime?: string;
  endTime?: string;
  bbox?: number[]; // normalized [x,y,w,h]
  croppedImageBase64?: string;
  objectQuery?: string;
};

type AgentImageSearchRequest = {
  image_base64: string;
  content_type: string;
  max_results: number;
  min_similarity?: number;
  sensor_ids?: string[];
  start_time?: string;
  end_time?: string;
  bbox?: number[];
  cropped_image_base64?: string;
  object_query?: string;
};

type ErrorResponse = {
  message: string;
  detail?: unknown;
};

export type ImageSearchBbox = {
  leftX: number;
  topY: number;
  rightX: number;
  bottomY: number;
};

export type ImageSearchResultItem = {
  video_name: string;
  description: string;
  start_time: string;
  end_time: string;
  sensor_id: string;
  screenshot_url: string;

  /*
   * 현재 Agent image_search.py는
   * similarity 필드로 반환합니다.
   * 기존 응답과의 호환성을 위해
   * similarity_score도 허용합니다.
   */
  similarity?: number;
  similarity_score?: number;

  object_ids?: Array<
    string | number
  >;

  matched_object_timestamp?: string;
  matched_object_type?: string;
  matched_object_bbox?: ImageSearchBbox;
};

export type ImageSearchResponse = {
  /*
   * 현재 Agent API 응답 형식
   */
  data?: ImageSearchResultItem[];

  /*
   * 기존 프론트엔드 응답과의
   * 호환성을 위해 유지
   */
  results?: ImageSearchResultItem[];

  total?: number;
  search_type?: string;
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

  const agentRequest: AgentImageSearchRequest = {
    image_base64: body.imageBase64,
    content_type: contentType,
    max_results: maxResults,
  };

  if (
    typeof body.minSimilarity === 'number'
  ) {
    agentRequest.min_similarity =
      body.minSimilarity;
  }

  if (
    Array.isArray(body.sensorIds) &&
    body.sensorIds.length > 0
  ) {
    agentRequest.sensor_ids =
      body.sensorIds.filter(
        (value): value is string =>
          typeof value === 'string' &&
          value.trim().length > 0,
      );
  }

  if (body.startTime) {
    agentRequest.start_time = body.startTime;
  }

  if (body.endTime) {
    agentRequest.end_time = body.endTime;
  }

  if (Array.isArray((body as any).bbox) && (body as any).bbox.length === 4) {
    (agentRequest as any).bbox = (body as any).bbox.map((v: unknown) => Number(v));
  }

  if (typeof (body as any).croppedImageBase64 === 'string') {
    (agentRequest as any).cropped_image_base64 = (body as any).croppedImageBase64;
  }

  if (typeof (body as any).objectQuery === 'string') {
    (agentRequest as any).object_query = (body as any).objectQuery;
  }

  try {
    const agentBaseUrl = resolveAgentBaseUrl();

    const imageBuffer = Buffer.from(
      body.imageBase64.replace(
        /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
        '',
      ),
      'base64',
    );

    const formData = new FormData();

    formData.append(
      'file',
      new Blob(
        [imageBuffer],
        {
          type: contentType,
        },
      ),
      `search-image.${
        contentType === 'image/png'
          ? 'png'
          : contentType === 'image/webp'
            ? 'webp'
            : 'jpg'
      }`,
    );

    formData.append(
      'min_similarity',
      String(body.minSimilarity ?? 0),
    );
    
    if (
      Array.isArray(body.sensorIds) &&
      body.sensorIds.length > 0
    ) {
      formData.append(
        'sensor_ids',
        body.sensorIds.join(','),
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