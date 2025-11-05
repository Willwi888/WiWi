import React from 'react';

interface KaraokeLyricProps {
  text: string;
  duration?: number;
  isPlaying: boolean;
  className?: string; // Base styling like font-bold
  highlightClassName?: string; // Color styling for highlight
  style?: React.CSSProperties; // Dynamic styles like font size
}

const KaraokeLyric: React.FC<KaraokeLyricProps> = ({
  text,
  duration = 5000,
  isPlaying,
  className = '',
  highlightClassName = '',
  style = {},
}) => {
  return (
    <div className="relative" style={style}>
      {/* Base layer: upcoming text (gray) with base styling */}
      <p className={`${className} text-gray-400`} style={style}>
        {text}
      </p>

      {/* Top layer: highlighted text, revealed with clip-path */}
      <p
        className={`${className} ${highlightClassName} absolute top-0 left-0 w-full h-full`}
        style={{
          ...style,
          clipPath: 'inset(0 100% 0 0)',
          animation: `karaoke-reveal ${duration}ms linear forwards`,
          animationPlayState: isPlaying ? 'running' : 'paused',
        }}
      >
        {text}
      </p>
    </div>
  );
};

export default KaraokeLyric;
