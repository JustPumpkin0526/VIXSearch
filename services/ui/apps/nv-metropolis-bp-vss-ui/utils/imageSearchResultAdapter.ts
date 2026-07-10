import type {
  ImageSearchResponse,
  ImageSearchResultItem,
} from './imageSearch';

export type SearchResultData = {
  video_name: string;
  description: string;
  start_time: string;
  end_time: string;
  sensor_id: string;
  screenshot_url: string;
  similarity_score: number;
  search_type: 'image_similarity';
};

export type SearchResultPayload = {
  data: SearchResultData[];
  total: number;
  search_type: 'image_similarity';
};

function convertItem(
  item: ImageSearchResultItem,
): SearchResultData {
  return {
    video_name: item.video_name,
    description: item.description,
    start_time: item.start_time,
    end_time: item.end_time,
    sensor_id: item.sensor_id,
    screenshot_url: item.screenshot_url,
    similarity_score:
      item.similarity_score,
    search_type: 'image_similarity',
  };
}

export function adaptImageSearchResponse(
  response: ImageSearchResponse,
): SearchResultPayload {
  const data =
    response.results.map(convertItem);

  return {
    data,
    total: data.length,
    search_type: 'image_similarity',
  };
}

export function formatImageSearchAsAgentMessage(
  response: ImageSearchResponse,
): string {
  return JSON.stringify(
    adaptImageSearchResponse(response),
    null,
    2,
  );
}