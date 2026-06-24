// SPDX-License-Identifier: MIT
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFilter } from '../../lib-src/hooks/useFilter';

interface FilterTag {
  key: string;
  title: string;
  value: string;
}

const mockSensors = [
  { name: 'Camera-1', sensorId: 'cam-1', state: 'online', type: 'sensor_file' },
  { name: 'Camera-2', sensorId: 'cam-2', state: 'online', type: 'sensor_rtsp' },
  { name: 'Camera-3', sensorId: 'cam-3', state: 'offline', type: 'sensor_file' },
];

const mockFetchResponse = (data: any, ok = true) =>
  jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });

describe('useFilter', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('initializes with default state', () => {
    global.fetch = mockFetchResponse([]);

    const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

    expect(result.current.filterParams).toEqual({
      startDate: null,
      endDate: null,
      videoSources: [],
      similarity: 0,
      agentMode: false,
      query: '',
      sourceType: 'video_file',
    });

    expect(result.current.filterTags).toEqual([]);
  });

  it('does not fetch when vstApiUrl is not provided', async () => {
    const fetchSpy = mockFetchResponse([]);
    global.fetch = fetchSpy;

    renderHook(() => useFilter({ vstApiUrl: undefined }));
    // Allow effects to flush
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches sensor list and filters online sensors', async () => {
    global.fetch = mockFetchResponse(mockSensors);

    const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

    await waitFor(() => {
      expect(result.current.streams).toHaveLength(2);
    });

    expect(global.fetch).toHaveBeenCalledWith('http://vst.test/v1/sensor/list');
    expect(result.current.streams).toEqual([
      { name: 'Camera-1', type: 'sensor_file' },
      { name: 'Camera-2', type: 'sensor_rtsp' },
    ]);
  });

  it('handles fetch error gracefully', async () => {
    global.fetch = mockFetchResponse(null, false);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(result.current.streams).toEqual([]);
    consoleSpy.mockRestore();
  });

  it('handles network error gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(result.current.streams).toEqual([]);
    consoleSpy.mockRestore();
  });

  describe('addFilter', () => {
    it('creates tags for all provided filter params', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter({
          startDate: new Date(2024, 0, 1),
          endDate: new Date(2024, 0, 31),
          videoSources: ['cam-1', 'cam-2'],
          similarity: 0.75,
        });
      });

      const tagKeys = result.current.filterTags.map((t: FilterTag) => t.key);
      expect(tagKeys).toContain('startDate');
      expect(tagKeys).toContain('endDate');
      expect(tagKeys).toContain('videoSources');
      expect(tagKeys).toContain('similarity');
    });

    it('creates no tags when no filters are set', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter({
          startDate: null,
          endDate: null,
          videoSources: [],
          similarity: 0,
        });
      });

      expect(result.current.filterTags).toEqual([]);
    });

    it('uses filterParams when no params argument passed', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter();
      });

      expect(result.current.filterTags).toEqual([]);
    });

    it('formats similarity value to 2 decimal places', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter({ similarity: 0.7 });
      });

      const simTag = result.current.filterTags.find((t: FilterTag) => t.key === 'similarity');
      expect(simTag.value).toBe('0.70');
    });
  });

  describe('removeFilterTag', () => {
    it('removes a specific tag', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter({
          startDate: new Date(2024, 0, 1),
          similarity: 0.5,
        });
      });

      const startTag = result.current.filterTags.find((t: FilterTag) => t.key === 'startDate');

      act(() => {
        result.current.removeFilterTag(startTag);
      });

      const tagKeys = result.current.filterTags.map((t: FilterTag) => t.key);
      expect(tagKeys).not.toContain('startDate');
      expect(tagKeys).toContain('similarity');
    });

    it('clears all tags when null is passed', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.addFilter({
          startDate: new Date(2024, 0, 1),
          endDate: new Date(2024, 0, 31),
        });
      });

      act(() => {
        result.current.removeFilterTag(null);
      });

      expect(result.current.filterTags).toEqual([]);
    });
  });

  describe('setFilterParams', () => {
    it('allows updating filter params directly', () => {
      global.fetch = mockFetchResponse([]);

      const { result } = renderHook(() => useFilter({ vstApiUrl: 'http://vst.test' }));

      act(() => {
        result.current.setFilterParams({
          ...result.current.filterParams,
          query: 'test query',
          agentMode: true,
        });
      });

      expect(result.current.filterParams.query).toBe('test query');
      expect(result.current.filterParams.agentMode).toBe(true);
    });
  });
});
