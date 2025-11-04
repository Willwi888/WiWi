import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';

// Allows access to the FFmpeg library loaded from the script tag in index.html
declare global {
  interface Window {
    FFmpeg: any;
  }
}

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  duration: number;
  onBack: () => void;
}

const fetchFile = async (url: string | Blob): Promise<Uint8Array> => {
  const response = await fetch(url instanceof Blob ? URL.createObjectURL(url) : url);
  const data = await response.arrayBuffer();
  return new Uint8Array(data);
};

const fontOptions = [
  { name: '思源黑體', value: "'Noto Sans TC', sans-serif" },
  { name: '思源宋體', value: "'Noto Serif TC', serif" },
  { name: '馬善政書法', value: "'Ma Shan Zheng', cursive" },
  { name: '站酷快樂體', value: "'ZCOOL KuaiLe', cursive" },
  { name: '龍藏體', value: "'Long Cang', cursive" },
];

const animationOptions = [
  { name: '垂直淡入', value: 'fade-in-up' },
  { name: '扇形淡入', value: 'fan-in' },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, duration, onBack }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [exportProgress, setExportProgress] = useState<{ message: string; progress: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState("'Noto Sans TC', sans-serif");
  const [fontColor, setFontColor] = useState<'white' | 'multicolor'>('white');
  const [artPosition, setArtPosition] = useState<'left' | 'right'>('left');
  const [artSize, setArtSize] = useState(40); // Album art width percentage
  const [animationStyle, setAnimationStyle] = useState('fade-in-up');
  const ffmpegRef = useRef<any>(null);
  const isExportCancelled = useRef(false);


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const timeUpdateHandler = () => setCurrentTime(audio.currentTime);
    const endedHandler = () => {
      setIsPlaying(false);
      // When the song ends, keep the "END" lyric displayed
      setCurrentTime(duration);
    };

    audio.addEventListener('timeupdate', timeUpdateHandler);
    audio.addEventListener('ended', endedHandler);

    return () => {
      audio.removeEventListener('timeupdate', timeUpdateHandler);
      audio.removeEventListener('ended', endedHandler);
    };
  }, [duration]);
  
  const lyricLines = useMemo(() => {
    const currentIndex = timedLyrics.findIndex(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime);
    if (currentIndex === -1) {
      // If before the first lyric or after the last, find the closest one to display context
      if (currentTime < (timedLyrics[0]?.startTime || 0)) {
         return { prev: null, current: null, next: timedLyrics[0] || null };
      }
      const lastLyric = timedLyrics[timedLyrics.length -1];
      if (lastLyric?.text === 'END' && currentTime >= lastLyric.startTime) {
         return { prev: timedLyrics[timedLyrics.length - 2] || null, current: lastLyric, next: null};
      }
      return { prev: null, current: null, next: null };
    }
    
    return {
      prev: timedLyrics[currentIndex - 1] || null,
      current: timedLyrics[currentIndex],
      next: timedLyrics[currentIndex + 1] || null,
    };
  }, [currentTime, timedLyrics]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // If playback is finished, restart from the beginning
        if (audioRef.current.currentTime >= duration - 0.1) {
          audioRef.current.currentTime = 0;
        }
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return isNaN(minutes) || isNaN(secs) ? '0:00' : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCancelExport = () => {
    isExportCancelled.current = true;
    if (ffmpegRef.current) {
      try {
        ffmpegRef.current.exit();
      } catch (e) {
        console.warn('Could not terminate FFmpeg process.', e);
      }
    }
    ffmpegRef.current = null;
    setExportProgress(null);
  };
  
  const drawTextOnArc = (ctx: CanvasRenderingContext2D, text: string, centerX: number, centerY: number, radius: number, startAngle: number, characterSpacing: number) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const textMetrics = ctx.measureText(char);
      ctx.rotate(characterSpacing / 2);
      ctx.fillText(char, 0, -radius);
      ctx.rotate(characterSpacing / 2 + textMetrics.width / (radius * 100)); // Adjust for char width
    }
    ctx.restore();
  };

  const handleExportMp4 = async () => {
    if (!audioRef.current || !imageUrl) return;

    isExportCancelled.current = false;
    setExportProgress({ message: '正在初始化...', progress: 0 });

    try {
      const VIDEO_WIDTH = 1280;
      const VIDEO_HEIGHT = 720;
      const FRAME_RATE = 30;

      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext('2d')!;

      const mimeTypes = ['video/webm; codecs=vp9', 'video/webm'];
      const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!supportedMimeType) {
        alert('您的瀏覽器不支援影片錄製功能，無法匯出 MP4。');
        setExportProgress(null);
        return;
      }
      
      const stream = canvas.captureStream(FRAME_RATE);
      const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });
      const videoChunks: Blob[] = [];
      recorder.ondataavailable = (e) => videoChunks.push(e.data);
      const recordingPromise = new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => resolve(videoChunks.length > 0 ? new Blob(videoChunks, { type: 'video/webm' }) : null);
      });

      const bgImage = new Image();
      bgImage.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        bgImage.onload = resolve;
        bgImage.onerror = reject;
        bgImage.src = imageUrl;
      });
      
      const songDuration = duration;
      audioRef.current.currentTime = 0;
      recorder.start();
      
      // Calculate layout based on settings before the loop
      const paddingX = VIDEO_WIDTH * 0.05;
      const contentAreaWidth = VIDEO_WIDTH * 0.9;
      const artContainerWidth = contentAreaWidth * (artSize / 100);
      const lyricsContainerWidth = contentAreaWidth * ((100 - artSize) / 100);
      
      const artSideForCanvas = Math.min(artContainerWidth, VIDEO_HEIGHT * 0.85);
      const artY = (VIDEO_HEIGHT - artSideForCanvas) / 2;

      let artX, lyricX;
      if (artPosition === 'left') {
        artX = paddingX + (artContainerWidth - artSideForCanvas) / 2;
        lyricX = paddingX + artContainerWidth + (lyricsContainerWidth / 2);
      } else { // right
        const lyricsContainerXStart = paddingX;
        const artContainerXStart = lyricsContainerXStart + lyricsContainerWidth;
        lyricX = lyricsContainerXStart + (lyricsContainerWidth / 2);
        artX = artContainerXStart + (artContainerWidth - artSideForCanvas) / 2;
      }

      for (let i = 0; i < songDuration * FRAME_RATE; i++) {
        if (isExportCancelled.current) {
          if (recorder.state === 'recording') recorder.stop();
          return;
        }

        const time = i / FRAME_RATE;

        ctx.drawImage(bgImage, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

        ctx.drawImage(bgImage, artX, artY, artSideForCanvas, artSideForCanvas);

        const currentIndex = timedLyrics.findIndex((l) => time >= l.startTime && time < l.endTime);
        const currentLyric = timedLyrics[currentIndex];

        if (currentLyric) {
          const timeInLyric = time - currentLyric.startTime;
          const animationDuration = 0.5;
          const progress = Math.min(1, timeInLyric / animationDuration);
          const opacity = progress;
          
          const lyricY = VIDEO_HEIGHT / 2;

          const prevLyric = timedLyrics[currentIndex - 1];
          const nextLyric = timedLyrics[currentIndex + 1];

          // Font and style setup
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 10;
          
          // Color setup
          let mainFillStyle: string | CanvasGradient;
          let subFillStyle: string | CanvasGradient;

          if (fontColor === 'multicolor') {
            const gradient = ctx.createLinearGradient(lyricX - 200, 0, lyricX + 200, 0);
            gradient.addColorStop(0, '#f87171');
            gradient.addColorStop(0.25, '#fb923c');
            gradient.addColorStop(0.5, '#a78bfa');
            gradient.addColorStop(0.75, '#38bdf8');
            gradient.addColorStop(1, '#4ade80');
            mainFillStyle = gradient;
            subFillStyle = `rgba(209, 213, 219, ${opacity * 0.7})`; // gray-300 for sub-lyrics
          } else {
            mainFillStyle = `rgba(255, 255, 255, ${opacity})`;
            subFillStyle = `rgba(209, 213, 219, ${opacity * 0.7})`;
          }
          
          ctx.save();
          ctx.translate(lyricX, lyricY);

          // Draw Lyrics
          if (animationStyle === 'fan-in') {
             // Main Lyric
            ctx.font = `bold ${fontSize * (VIDEO_WIDTH / 1280)}px ${fontFamily}`;
            ctx.fillStyle = mainFillStyle;
            drawTextOnArc(ctx, currentLyric.text, 0, 0, 1200, -0.1, 0.02);
            
            // Prev/Next Lyrics
            ctx.font = `bold ${fontSize * 0.6 * (VIDEO_WIDTH / 1280)}px ${fontFamily}`;
            ctx.fillStyle = subFillStyle;
            if (prevLyric) drawTextOnArc(ctx, prevLyric.text, 0, -20, 900, -0.1, 0.025);
            if (nextLyric) drawTextOnArc(ctx, nextLyric.text, 0, 20, 1600, -0.1, 0.015);

          } else { // Vertical
            const translateY = 20 * (1 - progress);
            
            // Main Lyric
            ctx.font = `bold ${fontSize * (VIDEO_WIDTH / 1280)}px ${fontFamily}`;
            ctx.fillStyle = mainFillStyle;
            ctx.fillText(currentLyric.text, 0, translateY);

            // Prev/Next Lyrics
            ctx.font = `bold ${fontSize * 0.6 * (VIDEO_WIDTH / 1280)}px ${fontFamily}`;
            ctx.fillStyle = subFillStyle;
            if (prevLyric) ctx.fillText(prevLyric.text, 0, -fontSize * 1.2 + translateY);
            if (nextLyric) ctx.fillText(nextLyric.text, 0, fontSize * 1.2 + translateY);
          }
          
          ctx.restore();
        }

        await new Promise(requestAnimationFrame);
        if (i % 10 === 0) {
          setExportProgress({ message: '正在渲染動畫...', progress: Math.round((time / songDuration) * 50) });
        }
      }

      if (recorder.state === 'recording') recorder.stop();
      const silentVideoBlob = await recordingPromise;

      if (isExportCancelled.current || !silentVideoBlob) return;

      setExportProgress({ message: '正在初始化編碼器...', progress: 50 });
      const { createFFmpeg } = window.FFmpeg;
      const ffmpeg = createFFmpeg({
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      ffmpegRef.current = ffmpeg;

      await ffmpeg.load();
      if (isExportCancelled.current) return;

      setExportProgress({ message: '正在準備檔案...', progress: 55 });
      ffmpeg.FS('writeFile', 'video.webm', await fetchFile(silentVideoBlob));
      ffmpeg.FS('writeFile', 'audio.mp3', await fetchFile(audioUrl));

      ffmpeg.setProgress(({ ratio }) => {
        if (isExportCancelled.current) return;
        setExportProgress({ message: '正在編碼影片...', progress: 55 + Math.round(ratio * 45) });
      });

      await ffmpeg.run('-i', 'video.webm', '-i', 'audio.mp3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', 'output.mp4');

      if (isExportCancelled.current) return;

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const videoUrl = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = 'lyric-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(videoUrl);
    } catch (error) {
      console.error('MP4 導出失敗:', error);
      alert('影片匯出失敗！請檢查瀏覽器控制台以獲取詳細資訊。');
    } finally {
      ffmpegRef.current = null;
      setExportProgress(null);
    }
  };
  
  const FanLyric = ({ text, isCurrent }: { text: string; isCurrent: boolean }) => {
    const chars = text.split('');
    const radius = isCurrent ? 1200 : 900;
    const angleSpread = text.length * (isCurrent ? 1.5 : 1.2);
    
    return (
      <div className="relative w-full flex justify-center items-center" style={{ height: isCurrent ? '80px' : '60px' }}>
          {chars.map((char, i) => {
              const charAngle = (i - (chars.length -1) / 2) * (angleSpread / chars.length);
              return (
                  <span key={i} className="absolute origin-bottom" style={{
                      transform: `rotate(${charAngle}deg) translateY(-${radius}px)`,
                      fontSize: isCurrent ? `${fontSize}px` : `${fontSize * 0.6}px`,
                      bottom: `${radius}px`,
                      fontFamily: fontFamily,
                  }}>
                      {char}
                  </span>
              )
          })}
      </div>
    )
  }

  return (
    <>
      {exportProgress && <Loader message={exportProgress.message} progress={exportProgress.progress} onCancel={handleCancelExport} />}
      <div className="w-full max-w-7xl mx-auto">
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        <div 
          className={`flex flex-col md:flex-row gap-8 items-center py-8 px-4 ${artPosition === 'right' ? 'md:flex-row-reverse' : ''}`}
          style={{ '--art-width': `${artSize}%`, '--lyrics-width': `${100 - artSize}%` } as React.CSSProperties}
        >
            <div className="w-full md:w-[var(--art-width)] flex-shrink-0 transition-all duration-300 ease-in-out">
                <img src={imageUrl} alt="專輯封面" className="w-full aspect-square object-cover rounded-xl shadow-2xl ring-1 ring-white/10"/>
            </div>

            <div className={`w-full md:w-[var(--lyrics-width)] h-64 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out`}>
                <div 
                  key={lyricLines.current?.startTime || 'start'}
                  className={`w-full text-center text-white flex flex-col justify-center items-center gap-4 animate-fade-in`}
                >
                  {animationStyle === 'fan-in' ? (
                      <>
                        <p className={`opacity-70 text-gray-300 transition-opacity duration-300 ${lyricLines.prev ? 'opacity-70' : 'opacity-0'}`}>
                          <FanLyric text={lyricLines.prev?.text || ''} isCurrent={false} />
                        </p>
                        <p className={`font-bold drop-shadow-lg ${fontColor === 'multicolor' ? 'bg-gradient-to-r from-red-400 via-purple-400 to-sky-400 bg-clip-text text-transparent' : ''}`}>
                          <FanLyric text={lyricLines.current?.text || ''} isCurrent={true} />
                        </p>
                        <p className={`transition-opacity duration-300 ${lyricLines.next ? 'opacity-70 text-gray-300' : 'opacity-0'}`}>
                           <FanLyric text={lyricLines.next?.text || ''} isCurrent={false} />
                        </p>
                      </>
                  ) : (
                      <>
                        <p 
                          className={`transition-opacity duration-300 ${lyricLines.prev ? 'opacity-70 text-gray-300' : 'opacity-0'}`}
                          style={{ fontSize: `${fontSize * 0.6}px`, fontFamily: fontFamily, }}>
                            {lyricLines.prev?.text || ' '}
                        </p>
                        <p 
                          className={`font-bold drop-shadow-lg ${fontColor === 'multicolor' ? 'bg-gradient-to-r from-red-400 via-purple-400 to-sky-400 bg-clip-text text-transparent' : ''}`}
                          style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily, minHeight: `${fontSize * 1.2}px` }}>
                            {lyricLines.current?.text || ' '}
                        </p>
                        <p 
                          className={`transition-opacity duration-300 ${lyricLines.next ? 'opacity-70 text-gray-300' : 'opacity-0'}`}
                           style={{ fontSize: `${fontSize * 0.6}px`, fontFamily: fontFamily, }}>
                            {lyricLines.next?.text || ' '}
                        </p>
                      </>
                  )}
                </div>
            </div>
        </div>

        <div className="p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700">
          <div className="w-full flex items-center gap-4">
            <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.01"
              value={currentTime}
              onChange={handleTimelineChange}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
            <span className="text-white text-sm font-mono">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
              <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm sm:text-base">
                  <PrevIcon className="w-6 h-6" />
                  返回
              </button>
              <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform">
                  {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
              </button>
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
                <div className="flex items-center gap-2 text-white">
                  <label htmlFor="font-size" className="text-xs">字體大小</label>
                  <input
                      id="font-size"
                      type="range"
                      min="24"
                      max="96"
                      step="1"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer accent-pink-500"
                  />
                  <span className="text-xs w-6 text-center font-mono">{fontSize}</span>
                </div>
                 <div className="flex items-center gap-2 text-white">
                  <label htmlFor="art-size" className="text-xs">封面大小</label>
                  <input
                      id="art-size"
                      type="range"
                      min="25"
                      max="50"
                      step="1"
                      value={artSize}
                      onChange={(e) => setArtSize(Number(e.target.value))}
                      className="w-20 h-1 bg-gray-600 rounded-full appearance-none cursor-pointer accent-pink-500"
                  />
                  <span className="text-xs w-8 text-center font-mono">{artSize}%</span>
                </div>
                <div className="flex items-center gap-2 text-white">
                  <span className="text-xs">位置</span>
                  <div className="flex items-center rounded-md bg-gray-900/50 border border-gray-600 p-0.5 text-xs">
                    <button onClick={() => setArtPosition('left')} className={`px-2 py-0.5 rounded ${artPosition === 'left' ? 'bg-purple-600' : ''}`}>靠左</button>
                    <button onClick={() => setArtPosition('right')} className={`px-2 py-0.5 rounded ${artPosition === 'right' ? 'bg-purple-600' : ''}`}>靠右</button>
                  </div>
                </div>
                 <div className="flex items-center gap-2 text-white">
                  <span className="text-xs">顏色</span>
                   <div className="flex items-center rounded-md bg-gray-900/50 border border-gray-600 p-0.5 text-xs">
                    <button onClick={() => setFontColor('white')} className={`px-2 py-0.5 rounded ${fontColor === 'white' ? 'bg-purple-600' : ''}`}>純白</button>
                    <button onClick={() => setFontColor('multicolor')} className={`px-2 py-0.5 rounded ${fontColor === 'multicolor' ? 'bg-purple-600' : ''}`}>多彩</button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white">
                    <label htmlFor="font-family" className="text-xs">字體</label>
                    <select
                        id="font-family"
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        {fontOptions.map(opt => (
                            <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.name}</option>

                        ))}
                    </select>
                </div>
                 <div className="flex items-center gap-2 text-white">
                    <label htmlFor="animation-style" className="text-xs">動畫</label>
                    <select
                        id="animation-style"
                        value={animationStyle}
                        onChange={(e) => setAnimationStyle(e.target.value)}
                        className="bg-gray-900/50 border border-gray-600 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                        {animationOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.name}</option>
                        ))}
                    </select>
                </div>
                <button onClick={handleExportMp4} className="px-3 py-2 text-sm bg-pink-600 text-white font-semibold rounded-lg hover:bg-pink-700 transition">
                    導出 MP4
                </button>
              </div>
          </div>
        </div>

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        `}</style>
      </div>
    </>
  );
};

export default VideoPlayer;