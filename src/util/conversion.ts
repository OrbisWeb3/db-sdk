export const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  if (typeof Buffer !== "undefined") {
    return Buffer.from(arrayBuffer).toString("base64");
  }

  if (typeof btoa !== "undefined") {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  }

  throw "[Conversion] Buffer and btoa unavailable, unable to convert Blob to base64.";
};

export const base64ToBlob = async (base64: string): Promise<Blob> => {
  if (typeof Buffer !== "undefined") {
    return new Blob([new Uint8Array(Buffer.from(base64, "base64"))]);
  }

  if (typeof atob !== "undefined") {
    const binstr = atob(base64);
    const uint8 = new Uint8Array(binstr.length);

    for (let i = 0; i < binstr.length; ++i) {
      uint8[i] = binstr.charCodeAt(i);
    }

    return new Blob([uint8]);
  }

  throw "[Conversion] Buffer and atob unavailable, unable to convert base64 to Blob.";
};
