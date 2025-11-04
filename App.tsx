import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import SrtIcon from './components/icons/SrtIcon';
import { TimedLyric } from './types';

type AppState = 'FORM' | 'TIMING' | 'PREVIEW';

const DEFAULT_BG_IMAGE = 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg';

const parseSrt = (srt: string): TimedLyric[] => {
    const timecodeToSeconds = (time: string): number => {
        const parts = time.replace(',', '.').split(':');
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
    };

    const blocks = srt.trim().replace(/\r/g, '').split(/\n\n+/);
    
    return blocks.map(block => {
        const lines = block.split('\n');
        if (lines.length < 2) return null;

        const timeLineIndex = lines.findIndex(line => line.includes('-->'));
        if (timeLineIndex === -1 || timeLineIndex + 1 > lines.length) return null;

        const timeLine = lines[timeLineIndex];
        const textLines = lines.slice(timeLineIndex + 1).join('\n');
        
        const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{3}) --> (\d{2}:\d{2}:\d{2}[,.]\d{3})/);
        if (!timeMatch) return null;
        
        return {
            text: textLines,
            startTime: timecodeToSeconds(timeMatch[1]),
            endTime: timecodeToSeconds(timeMatch[2]),
        };
    }).filter((lyric): lyric is TimedLyric => lyric !== null);
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('FORM');
  const [lyricsText, setLyricsText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement>(null);


  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const audioUrl = useMemo(() => audioFile ? URL.createObjectURL(audioFile) : '', [audioFile]);
  const backgroundImageUrl = useMemo(() => backgroundImage ? URL.createObjectURL(backgroundImage) : DEFAULT_BG_IMAGE, [backgroundImage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioFile) {
      setAppState('TIMING');
    } else {
      alert('請貼上歌詞並上傳音訊檔案！');
    }
  };

  const handleTimingComplete = useCallback((lyrics: TimedLyric[], duration: number) => {
    if (lyrics.length === 0) {
      setTimedLyrics([]);
      setAudioDuration(duration);
      setAppState('PREVIEW');
      return;
    }

    // Prepend a blank lyric at the beginning
    const firstLyricStartTime = lyrics[0].startTime;
    const processedLyrics: TimedLyric[] = [];

    if (firstLyricStartTime > 0.1) { // Add blank only if there's a delay
        processedLyrics.push({ text: '', startTime: 0, endTime: firstLyricStartTime });
    }

    processedLyrics.push(...lyrics);

    // Append an "END" lyric
    const lastLyricEndTime = lyrics[lyrics.length - 1].endTime;
    if (duration > lastLyricEndTime) {
       processedLyrics.push({ text: 'END', startTime: lastLyricEndTime, endTime: duration });
    }

    setTimedLyrics(processedLyrics);
    setAudioDuration(duration);
    setAppState('PREVIEW');
  }, []);

  const handleBackToForm = useCallback(() => {
    setAppState('FORM');
  }, []);
  
  const handleBackToTiming = useCallback(() => {
    setAppState('TIMING');
  }, []);

  const handleSrtImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!audioFile) {
        alert('請先上傳音訊檔案！');
        e.target.value = ''; // Reset file input
        return;
    }

    const srtContent = await file.text();
    const parsedLyrics = parseSrt(srtContent);
    if(parsedLyrics.length === 0){
        alert('SRT 檔案解析失敗或內容為空。');
        e.target.value = '';
        return;
    }

    // Get audio duration
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(audioFile);
    audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(audio.src);
        handleTimingComplete(parsedLyrics, duration);
    };
    audio.onerror = () => {
      alert('無法讀取音訊檔案時長。');
      URL.revokeObjectURL(audio.src);
    }
  };


  const renderContent = () => {
    switch (appState) {
      case 'TIMING':
        return (
          <LyricsTiming
            lyricsText={lyricsText}
            audioUrl={audioUrl}
            backgroundImageUrl={backgroundImageUrl}
            onComplete={handleTimingComplete}
            onBack={handleBackToForm}
          />
        );
      case 'PREVIEW':
        return (
          <VideoPlayer
            timedLyrics={timedLyrics}
            audioUrl={audioUrl}
            imageUrl={backgroundImageUrl}
            duration={audioDuration}
            onBack={handleBackToTiming}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-lg p-8 space-y-8 bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700">
            <div className="text-center">
              <MusicIcon className="w-12 h-12 mx-auto text-purple-400" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                歌詞影片創作工具
              </h2>
              <p className="mt-2 text-md text-gray-400">
                上傳您的音訊與歌詞，開始創作。
              </p>
            </div>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="w-full">
                    <label htmlFor="audio-upload" className="block text-sm font-medium text-gray-300 mb-2">
                      1. 上傳音訊檔案
                    </label>
                    <input 
                      id="audio-upload" 
                      type="file" 
                      accept="audio/*"
                      onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      required
                    />
                    <label htmlFor="audio-upload" className="w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                      <MusicIcon className="w-5 h-5 mr-2" />
                      <span>{audioFile ? audioFile.name : '選擇檔案'}</span>
                    </label>
                  </div>
                  
                  <div className="w-full">
                    <label htmlFor="bg-upload" className="block text-sm font-medium text-gray-300 mb-2">
                      2. 更換背景 (選填)
                    </label>
                    <input 
                      id="bg-upload" 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setBackgroundImage(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                    />
                    <label htmlFor="bg-upload" className="w-full cursor-pointer bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                      <ImageIcon className="w-5 h-5 mr-2" />
                      <span>{backgroundImage ? backgroundImage.name : '選擇圖片'}</span>
                    </label>
                  </div>
              </div>

              <div>
                <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300 mb-2">
                  3. 貼上完整歌詞 (一行一句)
                </label>
                <textarea
                  id="lyrics"
                  rows={8}
                  className="w-full px-3 py-2 text-gray-200 bg-gray-900/50 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 transition"
                  placeholder="在這裡貼上您的歌詞..."
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                />
              </div>
              
              <button
                type="submit"
                className="w-full px-4 py-3 font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-300"
              >
                開始手動計時
              </button>

              <div className="relative flex items-center justify-center">
                <div className="flex-grow border-t border-gray-600"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-sm">或</span>
                <div className="flex-grow border-t border-gray-600"></div>
              </div>
              
               <div>
                  <input 
                    id="srt-upload" 
                    type="file" 
                    accept=".srt"
                    onChange={handleSrtImport}
                    className="hidden"
                  />
                  <label htmlFor="srt-upload" className="w-full cursor-pointer bg-teal-600/80 hover:bg-teal-500/80 text-white font-bold py-3 px-4 rounded-md inline-flex items-center justify-center transition">
                    <SrtIcon className="w-5 h-5 mr-2" />
                    <span>直接匯入 SRT 字幕檔</span>
                  </label>
                </div>
            </form>
          </div>
        );
    }
  };

  return (
    <main className="relative w-full h-screen flex items-center justify-center p-4 overflow-auto">
      <div 
        className={`app-bg absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${isMounted ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full flex items-center justify-center">
        {renderContent()}
      </div>
    </main>
  );
};

export default App;
