import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TimedLyric } from '../types';
import { generateVisualsForLyrics } from '../services/geminiService';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import PrevIcon from './icons/PrevIcon';
import Loader from './Loader';
import KaraokeLyric from './KaraokeLyric';
import SparklesIcon from './icons/SparklesIcon';

declare global {
  interface Window {
    FFmpeg: any;
  }
}

interface AiImage {
  url: string;
  startTime: number;
  endTime: number;
}

interface VideoPlayerProps {
  timedLyrics: TimedLyric[];
  audioUrl: string;
  imageUrl: string;
  backgroundImage: File | null;
  duration: number;
  onBack: () => void;
  songTitle: string;
  artistName: string;
  isAiUnlocked: boolean;
}

const fontOptions = [
  { name: '思源黑體', value: "'Noto Sans TC', sans-serif" },
  { name: '思源宋體', value: "'Noto Serif TC', serif" },
  { name: '馬善政書法', value: "'Ma Shan Zheng', cursive" },
  { name: '站酷快樂體', value: "'ZCOOL KuaiLe', cursive" },
  { name: '龍藏體', value: "'Long Cang', cursive" },
];

const VideoPlayer: React.FC<VideoPlayerProps> = ({ timedLyrics, audioUrl, imageUrl, duration, onBack, songTitle, artistName, isAiUnlocked }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number>();
  
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState("'Noto Sans TC', sans-serif");
  const [fontColor, setFontColor] = useState<'white' | 'multicolor'>('white');
  const [artPosition, setArtPosition] = useState<'left' | 'right'>('left');
  const [artSize, setArtSize] = useState(40);
  
  const [aiImages, setAiImages] = useState<AiImage[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGenerationProgress, setAiGenerationProgress] = useState<{ message: string; progress: number } | null>(null);

  const handleAiGenerate = async () => {
    if (!isAiUnlocked) {
      alert("請先返回主畫面，點擊『天選之桶』解鎖 AI 功能！");
      return;
    }
    setIsGeneratingAi(true);
    setAiGenerationProgress({ message: '準備中...', progress: 0 });
    try {
      const images = await generateVisualsForLyrics(timedLyrics, songTitle, artistName, (progress, message) => {
        setAiGenerationProgress({ progress, message });
      });
      setAiImages(images);
    } catch(error) {
      console.error(error);
      alert(`AI影像生成失敗: ${error.message}`);
    } finally {
      setIsGeneratingAi(false);
      setAiGenerationProgress(null);
    }
  };


  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const endedHandler = () => {
      setIsPlaying(false);
      setCurrentTime(duration);
    };
    audio.addEventListener('ended', endedHandler);
    return () => {
      audio.removeEventListener('ended', endedHandler);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [duration]);
  
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isRecordingMode) {
          setIsRecordingMode(false);
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [isRecordingMode]);


  useEffect(() => {
    const animate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);
  
  const lyricLines = useMemo(() => {
    const currentIndex = timedLyrics.findIndex(lyric => currentTime >= lyric.startTime && currentTime < lyric.endTime);
    if (currentIndex === -1) {
      if (currentTime < (timedLyrics[0]?.startTime || 0)) {
         return { prev: null, current: null, next: timedLyrics[0] || null };
      }
      const lastLyric = timedLyrics[timedLyrics.length -1];
      if (lastLyric?.text === 'END' && currentTime >= lastLyric.startTime) {
         return { prev: timedLyrics[timedLyrics.length - 2] || null, current: lastLyric, next: null};
      }
      return { prev: timedLyrics[timedLyrics.length-1] || null, current: null, next: null };
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

 const handleExport = () => {
    if (audioRef.current) {
        setIsRecordingMode(true);
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        audioRef.current.play();
        setIsPlaying(true);
    } else {
        alert("音訊尚未準備好！");
    }
};

  const baseLyricClass = 'font-bold drop-shadow-lg';
  const highlightLyricClass = fontColor === 'multicolor' 
      ? 'bg-gradient-to-r from-red-400 via-purple-400 to-sky-400 bg-clip-text text-transparent' 
      : 'text-white';
      
  const currentBg = useMemo(() => {
    if (aiImages.length === 0) return { current: imageUrl, next: null, blend: 0 };
    const currentImageIndex = aiImages.findIndex(img => currentTime >= img.startTime && currentTime < img.endTime);
    const current = aiImages[currentImageIndex] || aiImages[0];
    return { current: current?.url || imageUrl, next: null, blend: 0 };
  }, [currentTime, aiImages, imageUrl]);

  return (
    <>
      {isGeneratingAi && aiGenerationProgress && <Loader message={aiGenerationProgress.message} progress={aiGenerationProgress.progress} />}
      
      <div className="w-full max-w-7xl mx-auto flex flex-col h-screen bg-black rounded-xl overflow-hidden border border-cyan-500/30">
        <div className="flex-grow relative">
            <div className="absolute inset-0">
                <img src={currentBg.current} className="w-full h-full object-cover transition-opacity duration-1000" />
                <div className="absolute inset-0 bg-black/60"></div>
            </div>
            
            <div className="absolute inset-0 flex flex-col p-4 sm:p-8">
                <div 
                  className={`flex-grow flex flex-col md:flex-row gap-8 items-center justify-center ${artPosition === 'right' ? 'md:flex-row-reverse' : ''}`}
                  style={{ '--art-width': `${artSize}%`, '--lyrics-width': `${100 - artSize}%` } as React.CSSProperties}
                >
                    <div className="w-4/5 md:w-[var(--art-width)] flex-shrink-0 transition-all duration-300 ease-in-out">
                        <img src={imageUrl} alt="專輯封面" className="w-full aspect-square object-cover rounded-xl shadow-2xl ring-1 ring-cyan-500/30"/>
                    </div>

                    <div className={`w-full md:w-[var(--lyrics-width)] h-64 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out`}>
                        <div 
                          key={lyricLines.current?.startTime || 'start'}
                          className={`w-full text-center text-white flex flex-col justify-center items-center gap-4 animate-fade-in`}
                          style={{transform: 'rotate(-5deg)', textShadow: '0 0 8px rgba(0,0,0,0.7)'}}
                        >
                          <p 
                            className={`transition-opacity duration-300 ${baseLyricClass} ${lyricLines.prev ? 'opacity-70 text-gray-300' : 'opacity-0'}`}
                            style={{ fontSize: `${fontSize * 0.6}px`, fontFamily: fontFamily, }}>
                              {lyricLines.prev?.text || ' '}
                          </p>

                          {lyricLines.current && lyricLines.current.text !== 'END' ? (
                            <KaraokeLyric
                              key={lyricLines.current.startTime}
                              text={lyricLines.current.text}
                              duration={(lyricLines.current.endTime - lyricLines.current.startTime) * 1000}
                              isPlaying={isPlaying}
                              style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily, minHeight: `${fontSize * 1.2}px` }}
                              className={baseLyricClass}
                              highlightClassName={highlightLyricClass}
                            />
                           ) : (
                            <p 
                              className={baseLyricClass}
                              style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily, minHeight: `${fontSize * 1.2}px` }}>
                                {lyricLines.current?.text === 'END' ? '' : (lyricLines.current?.text || ' ')}
                            </p>
                           )}

                          <p 
                            className={`transition-opacity duration-300 ${baseLyricClass} ${lyricLines.next && lyricLines.next.text !== 'END' ? 'opacity-70 text-gray-300' : 'opacity-0'}`}
                              style={{ fontSize: `${fontSize * 0.6}px`, fontFamily: fontFamily, }}>
                              {lyricLines.next?.text === 'END' ? '' : (lyricLines.next?.text || ' ')}
                          </p>
                        </div>
                    </div>
                </div>
            </div>
             {isRecordingMode && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white cursor-pointer" onClick={() => setIsRecordingMode(false)}>
                  <div className="animate-pulse text-center">
                    <h3 className="text-3xl font-bold font-['Ma_Shan_Zheng'] text-cyan-300" style={{textShadow: '0 0 8px rgba(0, 220, 255, 0.7)'}}>特務趕工中...</h3>
                    <p className="mt-4 text-gray-300">已進入錄影模式，請手動開啟您的螢幕錄影工具。</p>
                    <p className="mt-2 text-sm text-gray-400">( 錄製完成後，按 <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-300 border border-gray-400 rounded-lg">Esc</kbd> 鍵或點擊畫面即可退出 )</p>
                  </div>
                </div>
              )}
        </div>
        
        <audio ref={audioRef} src={audioUrl} onLoadedMetadata={() => setCurrentTime(0)} />
        
        {!isRecordingMode && (
          <div className="flex-shrink-0 p-4 bg-black/70 backdrop-blur-sm border-t border-cyan-700/50 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-white text-sm font-mono">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.01"
                value={currentTime}
                onChange={handleTimelineChange}
                className="w-full h-2 bg-cyan-900/50 border border-cyan-800/50 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-white text-sm font-mono">{formatTime(duration)}</span>
            </div>
            
            <div className="flex items-center justify-between flex-wrap gap-4">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors text-sm sm:text-base">
                    <PrevIcon className="w-6 h-6" />
                    返回計時
                </button>
                <div className="flex items-center gap-4">
                  <button onClick={handlePlayPause} className="bg-white text-gray-900 rounded-full p-3 transform hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                      {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                  </button>
                  <div className="flex flex-col items-center">
                      <button 
                          onClick={handleAiGenerate}
                          disabled={!isAiUnlocked || isGeneratingAi || aiImages.length > 0}
                          title={!isAiUnlocked ? "請返回主畫面解鎖 AI 功能" : ""}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition shadow-[0_0_10px_rgba(0,220,255,0.6)] ${
                              isAiUnlocked 
                              ? 'bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none' 
                              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          }`}
                      >
                          <SparklesIcon className="w-5 h-5" />
                          <span>{aiImages.length > 0 ? '動畫已生成' : 'AI 動畫生成'}</span>
                      </button>
                       <p className="text-xs text-gray-500 mt-1">
                          {isAiUnlocked ? 'AI 將根據歌詞意境生成動態背景。' : '功能已鎖定，請返回主頁解鎖。'}
                      </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <button onClick={handleExport} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-[0_0_10px_rgba(59,130,246,0.6)]">
                      導出 MP4
                  </button>
                </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
          
          @keyframes karaoke-reveal {
            from { clip-path: inset(0 100% 0 0); }
            to   { clip-path: inset(0 0 0 0); }
          }
        `}</style>
      </div>
    </>
  );
};

export default VideoPlayer;
