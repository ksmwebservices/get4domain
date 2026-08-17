import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useVideoConfig } from 'remotion';

export interface ReelProps {
  /** Vendor's own photo URLs (their content — not AI-generated). */
  images: string[];
  /** Optional text overlay shown across the reel. */
  text?: string;
  /** Optional licensed music track: an MP3 filename in the render's public dir
   *  (backend-api/remotion/tracks). Empty for a silent reel. */
  audioFile?: string | null;
  /** Brand accent for the text band. */
  accent?: string;
}

/** A simple slideshow reel: each photo shows for an equal slice, with an optional
 *  text band and optional background music. This is the "slideshow + audio" model
 *  (Aug 10 decision), composited from the vendor's OWN photos — not AI video. */
export const Reel: React.FC<ReelProps> = ({ images, text, audioFile, accent = '#0f766e' }) => {
  const { durationInFrames } = useVideoConfig();
  const count = Math.max(images.length, 1);
  const per = Math.floor(durationInFrames / count);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {images.map((src, i) => (
        <Sequence key={i} from={i * per} durationInFrames={per}>
          <AbsoluteFill>
            <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {text ? (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', padding: 80 }}>
          <div
            style={{
              background: accent,
              color: '#fff',
              padding: '24px 40px',
              borderRadius: 24,
              fontSize: 64,
              fontWeight: 800,
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              maxWidth: '90%',
            }}
          >
            {text}
          </div>
        </AbsoluteFill>
      ) : null}

      {audioFile ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
