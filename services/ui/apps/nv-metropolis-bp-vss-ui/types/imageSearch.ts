export type ImageSearchMode =
  | 'object'
  | 'face';

export type ImageSearchRequest = {
  imageBase64?: string;
  contentType?: string;
  maxResults?: number;
  minSimilarity?: number;
  sensorIds?: string[];
  startTime?: string;
  endTime?: string;
  bbox?: number[];
  croppedImageBase64?: string;
  objectQuery?: string;
  searchMode?: ImageSearchMode;
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
  data?: ImageSearchResultItem[];
  results?: ImageSearchResultItem[];
  total?: number;
  search_type?: string;
  search_mode?: ImageSearchMode;
};

export type SelectedSearchImage = {
  file: File;
  previewUrl: string;
  base64: string;
  contentType: string;
};