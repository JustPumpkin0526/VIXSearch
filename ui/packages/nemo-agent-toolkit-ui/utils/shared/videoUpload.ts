/**
 * Shared video upload utilities
 * Agent API upload (for search profiles) - get upload URL first, then PUT
 */

/**
 * Response from agent API when getting upload URL
 */
interface AgentUploadUrlResponse {
  url: string;
}

/**
 * Response from agent API after file upload
 */
export interface FileUploadResult {
  filename: string;
  bytes: number;
  sensorId: string;
  streamId: string;
  filePath: string;
  timestamp: string;
}

/**
 * Get upload URL from Agent API
 * This is step 1 for agent API uploads (search profile)
 */
export async function getUploadUrl(
  filename: string,
  uploadUrl: string,
  formData?: Record<string, any>,
  signal?: AbortSignal
): Promise<string> {
  // console.log("uploadUrl: ", uploadUrl,"/videos");
  const response = await fetch(`${uploadUrl}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename, ...formData }),
    signal,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorData = await response.json();
      if (errorData?.detail != null) {
        message = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore JSON parse failure, use statusText
    }
    throw new Error(message);
  }

  const data: AgentUploadUrlResponse = await response.json();
  return data.url;
}

/**
 * Upload file (two-step process)
 * Step 1: Get upload URL
 * Step 2: PUT file to the URL
 */
export async function uploadFile(
  file: File,
  uploadUrl: string,
  formData: Record<string, any>,
  onProgress?: (progress: number) => void,
  abortSignal?: AbortSignal,
  onTransferComplete?: () => void,
): Promise<FileUploadResult> {
  // Create AbortController for the getUploadUrl request
  const getUrlController = new AbortController();
  
  // If parent signal is aborted, abort the getUploadUrl request
  if (abortSignal?.aborted) {
    throw new Error('Upload was cancelled');
  }
  
  const abortListener = () => getUrlController.abort();
  abortSignal?.addEventListener('abort', abortListener);

  try {
    // Step 1: Get upload URL
    const presignedUrl = await getUploadUrl(file.name, uploadUrl, formData, getUrlController.signal);
    
    // Clean up abort listener after getting URL
    abortSignal?.removeEventListener('abort', abortListener);
    
    // Check if aborted between steps
    if (abortSignal?.aborted) {
      throw new Error('Upload was cancelled');
    }

    // Step 2: Upload file using XHR (for progress tracking)
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let transferCompleteNotified = false;

      const notifyTransferComplete = () => {
        if (transferCompleteNotified) {
          return;
        }

        transferCompleteNotified = true;
        onTransferComplete?.();
      };

      // Listen to parent abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => xhr.abort());
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      // Upload transfer to the agent has finished at this point; the server may
      // still be processing follow-up work such as embedding before it responds.
      xhr.upload.addEventListener('load', () => {
        notifyTransferComplete();
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result: FileUploadResult = JSON.parse(xhr.responseText);
            resolve(result);
          } catch {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      console.log("uploadURL: ",presignedUrl);
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      // Attach Authorization header from localStorage if available so the agent can forward it to the UI
      try {
        const token = typeof window !== 'undefined' ? window.localStorage.getItem('vss.auth.token') : null;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
      } catch (e) {
        // ignore if localStorage is unavailable
      }
      xhr.send(file);
    });
  } finally {
    abortSignal?.removeEventListener('abort', abortListener);
  }
}
