import type { NextApiRequest, NextApiResponse } from 'next';

type AnalyzeRequestBody = {
  videoUrl?: string;
  imageUrl?: string;
  prompt?: string;
  clip?: {
    videoName?: string;
    sensorId?: string;
    startTime?: string;
    endTime?: string;
    screenshotUrl?: string;
  };
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function translateMediaUrlForContainer(url: string): string {
  const externalBase = process.env.VST_EXTERNAL_URL || '';
  const internalBase = process.env.VST_INTERNAL_URL || '';

  if (externalBase && internalBase && url.startsWith(externalBase)) {
    return internalBase.replace(/\/+$/, '') + url.slice(externalBase.length);
  }

  return url;
}

function extractAssistantText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = (req.body || {}) as AnalyzeRequestBody;

  const rawVideoUrl =
    typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';

  const rawImageUrl =
    typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';

  if (!rawVideoUrl && !rawImageUrl) {
    return res.status(400).json({
      error: 'videoUrl or imageUrl is required',
    });
  }

  const baseUrl = normalizeBaseUrl(
    process.env.COSMOS_REASON2_BASE_URL || 'http://172.16.7.64:30082',
  );

  const model =
    process.env.COSMOS_REASON2_MODEL || 'nvidia/cosmos-reason2-8b';

  const mediaUrl = translateMediaUrlForContainer(rawVideoUrl || rawImageUrl);

  const prompt =
    typeof body.prompt === 'string' && body.prompt.trim()
      ? body.prompt.trim()
      : [
          '이 영상 클립을 분석해주세요.',
          '사람 쓰러짐, 화재, 연기, 위험 행동, 비정상 이벤트 여부를 한국어로 설명해주세요.',
          '사람의 인상착의도 같이 설명해주세요.',
          `Video name: ${body.clip?.videoName || 'unknown'}`,
          `Sensor ID: ${body.clip?.sensorId || 'unknown'}`,
          `Start time: ${body.clip?.startTime || 'unknown'}`,
          `End time: ${body.clip?.endTime || 'unknown'}`,
        ].join('\n');

  const mediaPart = rawVideoUrl
    ? {
        type: 'video_url',
        video_url: {
          url: mediaUrl,
        },
      }
    : {
        type: 'image_url',
        image_url: {
          url: mediaUrl,
        },
      };

  const requestBody = {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a visual safety analysis assistant. Answer clearly and concisely in Korean.',
      },
      {
        role: 'user',
        content: [
          mediaPart,
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
    max_tokens: 1024,
    stream: false,
    media_io_kwargs: rawVideoUrl
      ? {
          video: {
            fps: 2.0,
          },
        }
      : undefined,
  };

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const text = await response.text();

    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Cosmos Reason2 request failed',
        status: response.status,
        detail: payload,
      });
    }

    return res.status(200).json({
      analysis: extractAssistantText(payload),
      raw: payload,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to call Cosmos Reason2 NIM',
      detail: String(error?.message || error),
    });
  }
}