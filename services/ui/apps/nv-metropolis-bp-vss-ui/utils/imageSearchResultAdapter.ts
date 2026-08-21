import type {
  ImageSearchBbox,
  ImageSearchResponse,
  ImageSearchResultItem,
} from '../types/imageSearch';

export type SearchResultData = {
  video_name: string;
  description: string;
  start_time: string;
  end_time: string;
  sensor_id: string;
  screenshot_url: string;
  similarity_score: number;
  search_type: 'image_similarity';

  object_ids: string[];
  matched_object_timestamp?: string;
  matched_object_type?: string;
  matched_object_bbox?: ImageSearchBbox;
};

export type SearchResultPayload = {
  data: SearchResultData[];
  total: number;
  search_type: 'image_similarity';
};

function convertItem(
  item: ImageSearchResultItem,
): SearchResultData {
  const similarity =
    typeof item.similarity === 'number'
      ? item.similarity
      : typeof item.similarity_score ===
          'number'
        ? item.similarity_score
        : 0;

  return {
    video_name:
      item.video_name,
    description:
      item.description,
    start_time:
      item.start_time,
    end_time:
      item.end_time,
    sensor_id:
      item.sensor_id,
    screenshot_url:
      item.screenshot_url,
    similarity_score:
      similarity,
    search_type:
      'image_similarity',

    object_ids:
      Array.isArray(
        item.object_ids,
      )
        ? item.object_ids.map(String)
        : [],

    matched_object_timestamp:
      item.matched_object_timestamp,

    matched_object_type:
      item.matched_object_type,

    matched_object_bbox:
      item.matched_object_bbox,
  };
}

export function adaptImageSearchResponse(
  response: ImageSearchResponse,
): SearchResultPayload {
  /*
   * Agent API는 data를 사용하고,
   * 이전 프론트엔드는 results를 사용할 수 있으므로
   * 두 형식을 모두 지원합니다.
   */
  const sourceResults =
    Array.isArray(response.data)
      ? response.data
      : Array.isArray(
            response.results,
          )
        ? response.results
        : [];

  const data =
    sourceResults.map(
      convertItem,
    );

  return {
    data,
    total:
      typeof response.total ===
      'number'
        ? response.total
        : data.length,
    search_type:
      'image_similarity',
  };
}

export function formatImageSearchAsAgentMessage(
  response: ImageSearchResponse,
): string {
  return JSON.stringify(
    adaptImageSearchResponse(
      response,
    ),
    null,
    2,
  );
}