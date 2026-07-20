import React, { useRef, useState, useCallback, useEffect } from 'react';

type Props = {
  onSearch: (payload: {
    imageBase64?: string;
    contentType?: string;
    bbox?: number[]; // normalized [x,y,w,h]
    croppedImageBase64?: string;
    objectQuery?: string;
  }) => Promise<void>;
};

export default function ImageSearchCropper({ onSearch }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [objectQuery, setObjectQuery] = useState<string>('');
  const [candidates, setCandidates] = useState<Array<{ detection: any; preview: string | null }> | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
  const [selectedCandidateIndices, setSelectedCandidateIndices] = useState<number[]>([]);

  const toggleSelectCandidate = useCallback((idx: number) => {
    setSelectedCandidateIndices((s) => {
      if (s.includes(idx)) return s.filter((v) => v !== idx);
      return [...s, idx];
    });
    setSelectedCandidateIndex(idx);
    // update preview rect for selected
    const cand = candidates && candidates[idx];
    if (cand && imgRef.current && Array.isArray(cand.detection.bbox) && cand.detection.bbox.length === 4) {
      const displayW = imgRef.current.width;
      const displayH = imgRef.current.height;
      const [nx, ny, nw, nh] = cand.detection.bbox.map((v: any) => Number(v));
      setRect({ x: nx * displayW, y: ny * displayH, w: nw * displayW, h: nh * displayH });
    }
  }, [candidates]);

  const selectAllCandidates = useCallback(() => {
    if (!candidates) return;
    setSelectedCandidateIndices(candidates.map((_, i) => i));
    setSelectedCandidateIndex(candidates.length ? 0 : null);
    // set rect to first
    if (candidates.length && imgRef.current) {
      const cand = candidates[0];
      if (cand && Array.isArray(cand.detection.bbox) && cand.detection.bbox.length === 4) {
        const displayW = imgRef.current.width;
        const displayH = imgRef.current.height;
        const [nx, ny, nw, nh] = cand.detection.bbox.map((v: any) => Number(v));
        setRect({ x: nx * displayW, y: ny * displayH, w: nw * displayW, h: nh * displayH });
      }
    }
  }, [candidates]);

  const clearCandidateSelection = useCallback(() => {
    setSelectedCandidateIndices([]);
    setSelectedCandidateIndex(null);
  }, []);

  const moveSelectedPriority = useCallback((idx: number, dir: 'up' | 'down') => {
    setSelectedCandidateIndices((s) => {
      const pos = s.indexOf(idx);
      if (pos === -1) return s;
      const copy = [...s];
      const swap = dir === 'up' ? pos - 1 : pos + 1;
      if (swap < 0 || swap >= copy.length) return s;
      const tmp = copy[swap];
      copy[swap] = copy[pos];
      copy[pos] = tmp;
      return copy;
    });
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const onFile = useCallback((file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImageSrc(result);
      setShowModal(true);
      setRect(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleChooseFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (f) onFile(f);
  }, [onFile]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStart({ x, y });
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !start || !imgRef.current) return;
    const rectImg = imgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rectImg.left, rectImg.width));
    const y = Math.max(0, Math.min(e.clientY - rectImg.top, rectImg.height));
    const x0 = Math.min(start.x, x);
    const y0 = Math.min(start.y, y);
    const w = Math.max(1, Math.abs(x - start.x));
    const h = Math.max(1, Math.abs(y - start.y));
    setRect({ x: x0, y: y0, w, h });
  };

  const onMouseUp = () => {
    setIsDragging(false);
    setStart(null);
  };

  const drawCanvasCrop = useCallback(() => {
    if (!canvasRef.current || !imgRef.current || !rect) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = rect.w;
    canvas.height = rect.h;

    // compute scale from displayed image to natural size
    const displayW = img.width;
    const displayH = img.height;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;

    const sx = rect.x * (naturalW / displayW);
    const sy = rect.y * (naturalH / displayH);
    const sw = rect.w * (naturalW / displayW);
    const sh = rect.h * (naturalH / displayH);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [rect]);

  useEffect(() => {
    drawCanvasCrop();
  }, [rect, drawCanvasCrop]);

  const getCroppedData = useCallback(() => {
    if (!canvasRef.current || !imgRef.current) return null;
    const canvas = canvasRef.current;
    return canvas.toDataURL('image/jpeg');
  }, []);

  const submitSearch = useCallback(async () => {
    if (!imgRef.current || (!rect && !imageSrc)) return;

    const displayW = imgRef.current.width;
    const displayH = imgRef.current.height;
    const naturalW = imgRef.current.naturalWidth;
    const naturalH = imgRef.current.naturalHeight;

    let payload: any = {
      contentType: 'image/jpeg',
    };

    if (rect) {
      // normalized bbox in 0..1 relative to natural image
      const nx = (rect.x) / displayW;
      const ny = (rect.y) / displayH;
      const nw = rect.w / displayW;
      const nh = rect.h / displayH;
      payload.bbox = [nx, ny, nw, nh];

      // also send cropped image base64 to avoid server cropping cost
      const cropped = getCroppedData();
      if (cropped) payload.croppedImageBase64 = cropped;
    } else {
      // send full image
      payload.imageBase64 = imageSrc;
    }

    if (objectQuery && objectQuery.trim()) payload.objectQuery = objectQuery.trim();

    // Normalize keys for agent util
    const agentPayload: any = {};
    if (payload.croppedImageBase64) agentPayload.cropped_image_base64 = payload.croppedImageBase64;
    if (payload.bbox) agentPayload.bbox = payload.bbox;
    if (payload.imageBase64) agentPayload.image_base64 = payload.imageBase64;
    agentPayload.content_type = payload.contentType || 'image/jpeg';
    if (payload.objectQuery) agentPayload.object_query = payload.objectQuery;

    try {
      await onSearch(agentPayload);
    } catch (err) {
      console.error('Search failed', err);
      alert('Search failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setShowModal(false);
    }
  }, [rect, imageSrc, onSearch, objectQuery, getCroppedData]);

  const selectAllAndSearch = useCallback(async () => {
    // Use full image and optionally objectQuery
    if (!imageSrc) return;
    // Try server-side auto-detect first (if available). If detections returned,
    // pick the first one and search that crop. Otherwise fall back to whole-image search.
    try {
      const detectResp = await fetch('/api/v1/image_detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageSrc, content_type: 'image/jpeg' }),
      });

      if (detectResp.ok) {
        const body = await detectResp.json();
        const dets = body?.detections;
        if (Array.isArray(dets) && dets.length > 0) {
          if (dets.length === 1) {
            const d = dets[0];
            if (Array.isArray(d.bbox) && d.bbox.length === 4 && imgRef.current) {
              const [nx, ny, nw, nh] = d.bbox.map((v: any) => Number(v));
              const displayW = imgRef.current.width;
              const displayH = imgRef.current.height;
              setRect({ x: nx * displayW, y: ny * displayH, w: nw * displayW, h: nh * displayH });
              await new Promise((res) => setTimeout(res, 50));
              await submitSearch();
              return;
            }
          } else {
            // multiple candidates -> build previews and show selection UI
            const previews: Array<{ detection: any; preview: string | null }> = [];
            for (const d of dets) {
              if (!Array.isArray(d.bbox) || d.bbox.length !== 4) {
                previews.push({ detection: d, preview: null });
                continue;
              }

              if (imgRef.current) {
                const img = imgRef.current;
                const displayW = img.width;
                const displayH = img.height;
                const [nx, ny, nw, nh] = d.bbox.map((v: any) => Number(v));
                const sx = nx * displayW;
                const sy = ny * displayH;
                const sw = nw * displayW;
                const sh = nh * displayH;

                const c = document.createElement('canvas');
                c.width = Math.max(1, Math.round(sw));
                c.height = Math.max(1, Math.round(sh));
                const ctx = c.getContext('2d');
                if (ctx) {
                  const sx_n = sx * (img.naturalWidth / displayW);
                  const sy_n = sy * (img.naturalHeight / displayH);
                  const sw_n = sw * (img.naturalWidth / displayW);
                  const sh_n = sh * (img.naturalHeight / displayH);
                  ctx.drawImage(img, sx_n, sy_n, sw_n, sh_n, 0, 0, c.width, c.height);
                  previews.push({ detection: d, preview: c.toDataURL('image/jpeg') });
                  continue;
                }
              }

              previews.push({ detection: d, preview: null });
            }

            setCandidates(previews);
            setSelectedCandidateIndex(previews.length ? 0 : null);
            setSelectedCandidateIndices(previews.length ? [0] : []);
            return;
          }
        }
      }

      // fallback: whole-image search
      const payload: any = {
        image_base64: imageSrc,
        content_type: 'image/jpeg',
      };
      if (objectQuery && objectQuery.trim()) payload.object_query = objectQuery.trim();
      await onSearch(payload);
    } catch (err) {
      console.error('Auto-detect/search failed', err);
      alert('Search failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setShowModal(false);
    }
  }, [imageSrc, onSearch, objectQuery]);

  const confirmCandidateAndSearch = useCallback(async () => {
    if (!candidates || selectedCandidateIndices.length === 0) return;

    // For each selected candidate, call onSearch with bbox + optional cropped image
    for (const idx of selectedCandidateIndices) {
      const cand = candidates[idx];
      if (!cand) continue;
      const bbox = Array.isArray(cand.detection.bbox) ? cand.detection.bbox.map((v: any) => Number(v)) : null;

      const agentPayload: any = { content_type: 'image/jpeg' };
      if (cand.preview) {
        agentPayload.cropped_image_base64 = cand.preview;
      }
      if (bbox && bbox.length === 4) {
        agentPayload.bbox = bbox;
      }
      if (objectQuery && objectQuery.trim()) agentPayload.object_query = objectQuery.trim();

      try {
        // call onSearch sequentially
        // note: onSearch expects agent-style keys (already set)
        await onSearch(agentPayload);
      } catch (err) {
        console.error('Search failed for candidate', idx, err);
      }
    }

    setCandidates(null);
    setSelectedCandidateIndices([]);
    setShowModal(false);
  }, [candidates, selectedCandidateIndices, onSearch, objectQuery]);

  const cancelCandidates = useCallback(() => {
    setCandidates(null);
  }, []);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button onClick={handleChooseFile}>Upload Image for Search</button>

      {showModal && imageSrc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}>
          <div style={{ width: '90%', maxWidth: 1000, margin: '40px auto', background: '#fff', padding: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="to crop"
                  style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none' }}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                />
                {rect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: rect.x,
                      top: rect.y,
                      width: rect.w,
                      height: rect.h,
                      border: '2px dashed #00f',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>

              <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label>
                  Object query (optional)
                  <input type="text" value={objectQuery} onChange={(e) => setObjectQuery(e.target.value)} />
                </label>

                <button onClick={submitSearch} disabled={!imageSrc}>Search Selected Area</button>
                <button onClick={selectAllAndSearch} disabled={!imageSrc}>Select Whole Image (Auto-detect)</button>
                <button
                  onClick={() => {
                    setShowModal(false);
                  }}
                >
                  Cancel
                </button>

                <div>
                  <strong>Preview</strong>
                  <div style={{ marginTop: 6 }}>
                    <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', border: '1px solid #ddd' }} />
                  </div>
                </div>
                {candidates && (
                  <div style={{ marginTop: 8 }}>
                    <strong>Detection candidates</strong>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, overflowX: 'auto' }}>
                      {candidates.map((c, idx) => (
                        <div key={idx} style={{ border: selectedCandidateIndices.includes(idx) ? '2px solid #06f' : '1px solid #ccc', padding: 6, width: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              checked={selectedCandidateIndices.includes(idx)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCandidateIndices((s) => Array.from(new Set([...s, idx])));
                                else setSelectedCandidateIndices((s) => s.filter((v) => v !== idx));
                                setSelectedCandidateIndex(idx);
                              }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ width: 120, height: 80, overflow: 'hidden', background: '#f7f7f7' }}>
                                {c.preview ? <img src={c.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#eee' }} />}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, marginTop: 6 }}>
                            <div><strong>{c.detection.label || 'object'}</strong></div>
                            <div>score: {typeof c.detection.score !== 'undefined' ? Number(c.detection.score).toFixed(2) : 'n/a'}</div>
                          </div>
                          <div style={{ textAlign: 'center', marginTop: 6 }}>
                            <button onClick={() => { setSelectedCandidateIndices([idx]); confirmCandidateAndSearch(); }} style={{ marginRight: 4 }}>Use</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button onClick={confirmCandidateAndSearch} disabled={selectedCandidateIndex == null}>Confirm and Search</button>
                      <button onClick={cancelCandidates} style={{ marginLeft: 8 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
