import React from 'react';
import ImageSearchCropper from '../components/ImageSearchCropper';

export default function ImageSearchDemo() {
  const onSearch = async (payload: any) => {
    // Normalize to agent API expected keys
    const body: any = {};
    if (payload.image_base64) body.image_base64 = payload.image_base64;
    if (payload.cropped_image_base64) body.cropped_image_base64 = payload.cropped_image_base64;
    if (payload.bbox) body.bbox = payload.bbox;
    if (payload.object_query) body.object_query = payload.object_query;
    if (payload.content_type) body.content_type = payload.content_type;

    // Default: if UI used different casing
    if (payload.croppedImageBase64 && !body.cropped_image_base64) body.cropped_image_base64 = payload.croppedImageBase64;
    if (payload.imageBase64 && !body.image_base64) body.image_base64 = payload.imageBase64;
    if (payload.objectQuery && !body.object_query) body.object_query = payload.objectQuery;

    // call the UI API which forwards to the agent
    const res = await fetch('/api/image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      alert('Search failed: ' + txt);
      return;
    }

    const data = await res.json();
    // Display basic result summary
    alert('Found ' + (data.total ?? data.results?.length ?? 0) + ' result(s). Check console for details.');
    console.log('image search results', data);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Image Search Demo</h1>
      <p>Upload an image, draw a box or use whole-image mode.</p>
      <ImageSearchCropper onSearch={onSearch} />
    </div>
  );
}
