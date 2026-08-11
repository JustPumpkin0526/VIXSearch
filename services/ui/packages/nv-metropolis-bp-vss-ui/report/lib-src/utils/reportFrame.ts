function parseTimestamp(
  value: unknown,
): number | null {
  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function blobToDataUrl(
  blob: Blob,
): Promise<string> {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onloadend = () => {
        if (
          typeof reader.result ===
          'string'
        ) {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            'Failed to convert frame image',
          ),
        );
      };

      reader.onerror = () => {
        reject(
          reader.error ??
            new Error(
              'Failed to read frame image',
            ),
        );
      };

      reader.readAsDataURL(blob);
    },
  );
}

export async function fetchReportFrameDataUrl(
  vstApiUrl: string,
  sensorId: string,
  clipStartTime: string,
  pauseOffsetSeconds: number,
): Promise<string> {
  const startMs =
    parseTimestamp(
      clipStartTime,
    );

  if (startMs === null) {
    throw new Error(
      `Invalid clip start time: ${clipStartTime}`,
    );
  }

  const safePauseSeconds =
    Number.isFinite(
      pauseOffsetSeconds,
    )
      ? Math.max(
          0,
          pauseOffsetSeconds,
        )
      : 0;

  const timestamp =
    new Date(
      startMs +
        Math.round(
          safePauseSeconds * 1000,
        ),
    ).toISOString();

  const params =
    new URLSearchParams({
      startTime: timestamp,
    });

  const url =
    `${vstApiUrl}/v1/replay/stream/` +
    `${encodeURIComponent(sensorId)}/picture?` +
    params.toString();

  const response =
    await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'image/*',
        streamId: sensorId,
      },
    });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch report frame: ${response.status}`,
    );
  }

  const blob =
    await response.blob();

  if (
    blob.size === 0 ||
    (
      blob.type &&
      !blob.type.startsWith(
        'image/',
      )
    )
  ) {
    throw new Error(
      'Invalid report frame image',
    );
  }

  console.info(
    '[Report] frame fetched',
    {
      sensorId,
      clipStartTime,
      pauseOffsetSeconds:
        safePauseSeconds,
      timestamp,
    },
  );

  return blobToDataUrl(blob);
}