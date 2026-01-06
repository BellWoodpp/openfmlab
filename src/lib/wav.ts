export type WavPcm = {
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  pcmData: Buffer;
};

function readFourCC(buf: Buffer, offset: number): string {
  return buf.toString("ascii", offset, offset + 4);
}

export function parseWav(buffer: Buffer): WavPcm {
  if (buffer.length < 44) {
    throw new Error("WAV buffer too small");
  }
  if (readFourCC(buffer, 0) !== "RIFF" || readFourCC(buffer, 8) !== "WAVE") {
    throw new Error("Invalid WAV header");
  }

  let audioFormat: number | undefined;
  let numChannels: number | undefined;
  let sampleRate: number | undefined;
  let bitsPerSample: number | undefined;
  let dataOffset: number | undefined;
  let dataSize: number | undefined;

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = readFourCC(buffer, offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;

    if (chunkDataEnd > buffer.length) {
      throw new Error("Invalid WAV chunk size");
    }

    if (chunkId === "fmt ") {
      if (chunkSize < 16) throw new Error("Invalid WAV fmt chunk");
      audioFormat = buffer.readUInt16LE(chunkDataStart + 0);
      numChannels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkDataStart;
      dataSize = chunkSize;
    }

    offset = chunkDataEnd + (chunkSize % 2);
  }

  if (!audioFormat || !numChannels || !sampleRate || !bitsPerSample) {
    throw new Error("Missing WAV fmt chunk");
  }
  if (dataOffset === undefined || dataSize === undefined) {
    throw new Error("Missing WAV data chunk");
  }

  const pcmData = buffer.subarray(dataOffset, dataOffset + dataSize);
  return { audioFormat, numChannels, sampleRate, bitsPerSample, pcmData };
}

export function encodePcmWav(opts: {
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
  pcmData: Buffer;
}): Buffer {
  const { numChannels, sampleRate, bitsPerSample, pcmData } = opts;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0, 4, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, 4, "ascii");
  header.write("fmt ", 12, 4, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, 4, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmData]);
}

export function silencePcmBytes(opts: {
  durationMs: number;
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}): Buffer {
  const bytesPerSample = opts.bitsPerSample / 8;
  const frames = Math.max(0, Math.round((opts.sampleRate * opts.durationMs) / 1000));
  const totalBytes = frames * opts.numChannels * bytesPerSample;
  return Buffer.alloc(totalBytes, 0);
}

