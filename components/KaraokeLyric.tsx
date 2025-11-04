import React from 'react';

interface KaraokeLyricProps {
  text: string;
  duration?: number;
  isPlaying: boolean;
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({ text, duration = 5000, isPlaying }) => {
  const animationStyle: React.CSSProperties = {
    // A linear gradient moving from left to right.
    // The highlighted color is bright white, the upcoming color is a muted gray.
    backgroundImage: `linear-gradient(to right, #FFFFFF 50%, #9ca3af 50%)`, // white to tailwind gray-400
    backgroundSize: '200% 100%',
    backgroundPosition: '100%', // Start with the gray color fully visible
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    animation: `karaoke-highlight ${duration}ms linear forwards`,
    animationPlayState: isPlaying ? 'running' : 'paused',
  };

  return (
    <>
      <style>
        {`
          @keyframes karaoke-highlight {
            from { background-position: 100%; }
            to { background-position: 0%; }
          }
        `}
      </style>
      <p style={animationStyle} className="text-center text-xl md:text-2xl font-semibold tracking-wide">
        {text}
      </p>
    </>
  );
};

export default KaraokeLyric;
