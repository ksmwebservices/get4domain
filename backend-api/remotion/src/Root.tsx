import React from 'react';
import { Composition } from 'remotion';
import { Reel, ReelProps } from './Reel';

const FPS = 30;
const SECONDS_PER_IMAGE = 2.5;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={FPS * 10}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ images: [], text: '', audioSrc: null, accent: '#0f766e' } as ReelProps}
      // Duration follows the number of photos (min 1) — 2.5s each.
      calculateMetadata={({ props }) => {
        const n = Math.max((props.images ?? []).length, 1);
        return { durationInFrames: Math.round(FPS * SECONDS_PER_IMAGE * n) };
      }}
    />
  );
};
