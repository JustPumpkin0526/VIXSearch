// SPDX-License-Identifier: MIT
import { useState, useCallback, useEffect } from 'react';
import { FilterProps, SearchParams, StreamInfo } from '../types';
import { formatDatetime } from '../utils/Formatter';

export const useFilter = ({vstApiUrl}: FilterProps) => {
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [filterParams, setFilterParams] = useState({
    startDate: null,
    endDate: null,
    videoSources: [],
    similarity: 0,
    agentMode: false,
    query: '',
    sourceType: 'video_file'
  })
  const [filterTags, setFilterTags] = useState<any[]>([]);

  const fetchSensorList = useCallback(async () => {
    if (!vstApiUrl) return;
    
    try {
      const response = await fetch(`${vstApiUrl}/v1/sensor/list`);
      if (!response.ok) {
        console.error(`Failed to fetch sensor list: ${response.status}`);
        return;
      }
      const sensors = await response.json();
      
      const streamList: StreamInfo[] = [];
      sensors.forEach((sensor: any) => {
        if (sensor.name && sensor.sensorId && sensor.state === 'online') {
          streamList.push({
            name: sensor.name,
            type: sensor.type || ''
          });
        }
      });
      setStreams(streamList);
    } catch (err) {
      console.error('Error fetching sensor list:', err);
    }
  }, [vstApiUrl]);

  const addFilter = (params?: any) => {
    const paramsToUse = params || filterParams;
    const { startDate, endDate, videoSources, similarity } = paramsToUse;
      
    let tags = [];
    if (startDate) {
      tags.push({key: 'startDate', title: '시작', value: formatDatetime(startDate)});
    } 
    if (endDate) {
      tags.push({key: 'endDate', title: '종료', value: formatDatetime(endDate)});
    }
    if (videoSources && videoSources.length > 0) {
      tags.push({key: 'videoSources', title: '비디오 소스', value: videoSources.join(', ')});
    }
    if (similarity) {
      tags.push({key: 'similarity', title: '유사도', value: Number(similarity)?.toFixed(2)});
    }
    setFilterTags(tags as any);
  };

  const removeFilterTag = (tag: any) => {
    if (!tag) {
      setFilterTags([]);
    } else {
      setFilterTags(filterTags.filter((t: any) => t !== tag));
    }
  };

  const fetchData = useCallback(async () => {
    await fetchSensorList();
  }, [fetchSensorList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    streams,
    filterParams,
    setFilterParams,
    refetch: fetchData,
    addFilter,
    filterTags,
    removeFilterTag
  };
};