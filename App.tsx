import React, { useState, useCallback, useEffect, useMemo } from 'react';
import LyricsTiming from './components/LyricsTiming';
import VideoPlayer from './components/VideoPlayer';
import MusicIcon from './components/icons/MusicIcon';
import ImageIcon from './components/icons/ImageIcon';
import SrtIcon from './components/icons/SrtIcon';
import WillWiMusicLogo from './components/icons/WillWiMusicLogo';
import { TimedLyric } from './types';
import SparklesIcon from './components/icons/SparklesIcon';
import LockIcon from './components/icons/LockIcon';
import InfoIcon from './components/icons/InfoIcon';
import Modal from './components/Modal';


type AppState = 'FORM' | 'TIMING' | 'PREVIEW';

const encouragingMessages = [
  "別怕，音樂和畫面會引導你。",
  "你的獨特視角，就是最棒的MV。",
  "相信你的直覺，大膽創作吧！",
  "每一次點擊，都是一個新的故事。",
  "創作沒有對錯，只有獨一無二。",
  "將你的感動，用畫面傳達出來。",
];

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
  const [songTitle, setSongTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [backgroundImage, setBackgroundImage] = useState<File | null>(null);
  const [timedLyrics, setTimedLyrics] = useState<TimedLyric[]>([]);
  const [audioDuration, setAudioDuration] = useState(0);
  const [encouragement, setEncouragement] = useState('');
  const [showSplash, setShowSplash] = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [isAiUnlocked, setIsAiUnlocked] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setEncouragement(encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)]);
    
    const timer = setTimeout(() => {
      handleExitSplash();
    }, 4000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleExitSplash = () => {
    if (splashExiting) return;
    setSplashExiting(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 500);
  };
  
  const audioUrl = useMemo(() => audioFile ? URL.createObjectURL(audioFile) : '', [audioFile]);
  const backgroundImageUrl = useMemo(() => backgroundImage ? URL.createObjectURL(backgroundImage) : 'https://storage.googleapis.com/aistudio-hosting/workspace-template-assets/lyric-video-maker/default_bg.jpg', [backgroundImage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lyricsText && audioFile && songTitle && artistName) {
      setAppState('TIMING');
    } else {
      alert('請填寫所有必填欄位：歌曲、歌手、歌詞並上傳音訊檔案！');
    }
  };

  const handleTimingComplete = useCallback((lyrics: TimedLyric[], duration: number) => {
    if (lyrics.length === 0) {
      setTimedLyrics([]);
      setAudioDuration(duration);
      setAppState('PREVIEW');
      return;
    }

    const firstLyricStartTime = lyrics[0].startTime;
    const processedLyrics: TimedLyric[] = [];

    if (firstLyricStartTime > 0.1) {
        processedLyrics.push({ text: '', startTime: 0, endTime: firstLyricStartTime });
    }

    processedLyrics.push(...lyrics);

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
        e.target.value = '';
        return;
    }

    const srtContent = await file.text();
    const parsedLyrics = parseSrt(srtContent);
    if(parsedLyrics.length === 0){
        alert('SRT 檔案解析失敗或內容為空。');
        e.target.value = '';
        return;
    }

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
  
  const handleUnlockAi = () => {
    if (isAiUnlocked) return;
    const password = prompt('此為公益 APP，鼓勵手動創作。若需使用 AI 功能 (可能產生 API 費用)，請輸入密碼：');
    if (password === '8888') {
      setIsAiUnlocked(true);
      alert('AI 功能已解鎖！');
    } else if (password !== null && password !== '') {
      alert('密碼錯誤！');
    }
  };

  const renderContent = () => {
     if (showSplash) {
      return (
        <div 
          className={`w-full h-full flex flex-col items-center justify-center text-center text-cyan-300 cursor-pointer transition-opacity duration-500 ${splashExiting ? 'opacity-0' : 'opacity-100'}`}
          onClick={handleExitSplash}
        >
            <h1 className="text-6xl font-['Ma_Shan_Zheng'] mb-4" style={{textShadow: '0 0 8px rgba(0, 220, 255, 0.7)'}}>文字泡麵</h1>
            <p className="text-2xl font-['Noto_Serif_TC'] mb-12 text-cyan-400">純手打の溫度</p>
            <div className="space-y-4 font-['Noto_Sans_TC'] text-lg text-gray-300">
                <p>用你的故事，煮一碗好麵。</p>
                <p>世界太快，但你值得慢慢品嚐。</p>
            </div>
            <p className="mt-24 text-sm text-gray-500 animate-pulse">點擊任意處開始創作</p>
        </div>
      );
    }
    
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
            backgroundImage={backgroundImage}
            duration={audioDuration}
            onBack={handleBackToTiming}
            songTitle={songTitle}
            artistName={artistName}
            isAiUnlocked={isAiUnlocked}
          />
        );
      case 'FORM':
      default:
        return (
          <div className="w-full max-w-lg p-6 space-y-4 bg-black/70 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30">
            <div className="text-center">
              <h2 className="mt-4 text-cyan-300 font-['Noto_Sans_TC']">
                <span className="text-3xl font-bold tracking-tight" style={{textShadow: '0 0 5px rgba(0, 220, 255, 0.5)'}}>泡麵歌詞器</span>
                <span className="text-xl font-normal text-gray-300"> — 音樂調理說明</span>
              </h2>
              <p className="mt-2 text-md text-gray-400">
                上傳您的作品與歌詞，開始烹煮專屬的動態歌詞 MV。
              </p>
               <p className="mt-1 text-sm text-cyan-500/80">
                ( 提醒：泡麵煮太久會變抒情歌 )
              </p>
              <div className="mt-6 border-t border-cyan-800/50 pt-4 text-center">
                 <p className="text-cyan-300 text-base">
                    <span className="font-['Ma_Shan_Zheng'] text-lg">給創作者的加油打氣： </span>
                    <span className="text-yellow-300 font-['Ma_Shan_Zheng'] text-xl" style={{textShadow: '0 0 5px rgba(250, 204, 21, 0.5)'}}>{encouragement}</span>
                 </p>
              </div>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="song-title" className="block text-xl font-['Ma_Shan_Zheng'] text-cyan-300 mb-1">麵體（主歌）</label>
                  <p className="text-sm text-cyan-400/80 mb-2 h-10">一碗沒有麵的泡麵，就是空洞的旋律。</p>
                  <input id="song-title" type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} required className="w-full px-3 py-2 text-gray-200 bg-black/50 border border-cyan-700/50 rounded-md focus:ring-cyan-500 focus:border-cyan-500 transition" placeholder="例如：上水的花" />
                </div>
                <div>
                  <label htmlFor="artist-name" className="block text-xl font-['Ma_Shan_Zheng'] text-cyan-300 mb-1">湯頭（歌手）</label>
                   <p className="text-sm text-cyan-400/80 mb-2 h-10">誰熬的湯，誰的味道最濃。</p>
                  <input id="artist-name" type="text" value={artistName} onChange={(e) => setArtistName(e.target.value)} required className="w-full px-3 py-2 text-gray-200 bg-black/50 border border-cyan-700/50 rounded-md focus:ring-cyan-500 focus:border-cyan-500 transition" placeholder="例如：Will" />
                </div>
              </div>

               <div className="w-full">
                  <label className="block text-xl font-['Ma_Shan_Zheng'] text-cyan-300 mb-1">
                    🍲 主湯音訊檔（選擇乾濕吃法）
                  </label>
                  <div className="text-sm text-cyan-400/80 space-y-1 my-2">
                    <p><strong className="text-cyan-300">乾吃法：</strong>適合清唱版本或純伴奏。歌詞乾乾淨淨，節奏清晰入味。</p>
                    <p><strong className="text-cyan-300">濕吃法：</strong>適合完整版音軌（含人聲＋伴奏）。聽完要配衛生紙，情緒湯濃得化不開。</p>
                  </div>
                  <input 
                    id="audio-upload" 
                    type="file" 
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)}
                    className="hidden" 
                    required
                  />
                  <label htmlFor="audio-upload" className="w-full cursor-pointer bg-cyan-900/50 border border-cyan-700 hover:bg-cyan-800/60 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                    <MusicIcon className="w-5 h-5 mr-2" />
                    <span>{audioFile ? audioFile.name : '上傳檔案'}</span>
                  </label>
                </div>
                
                <div className="w-full">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xl font-['Ma_Shan_Zheng'] text-cyan-300">
                      配料加成（專輯／背景）
                    </label>
                    <button 
                      type="button"
                      onClick={handleUnlockAi}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition shadow-[0_0_8px_rgba(0,220,255,0.5)] ${
                          isAiUnlocked 
                          ? 'bg-cyan-500 text-black cursor-default' 
                          : 'bg-yellow-400 text-black hover:bg-yellow-300'
                      }`}
                    >
                      {isAiUnlocked ? <SparklesIcon className="w-4 h-4" /> : <LockIcon className="w-4 h-4" />}
                      天選之桶
                    </button>
                  </div>
                   <p className="text-sm text-cyan-400/80 mb-2">選對配料，整碗更香。（也可用專輯封面或現場照片當背景）</p>
                  <input 
                    id="bg-upload" 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setBackgroundImage(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                  />
                  <label htmlFor="bg-upload" className="w-full cursor-pointer bg-cyan-900/50 border border-cyan-700 hover:bg-cyan-800/60 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                    <ImageIcon className="w-5 h-5 mr-2" />
                    <span>{backgroundImage ? backgroundImage.name : '上傳圖片'}</span>
                  </label>
                </div>

              <div>
                <label className="block text-xl font-['Ma_Shan_Zheng'] text-cyan-300 mb-1">
                  加蛋加菜區（歌詞）
                </label>
                <p className="text-sm text-cyan-400/80 mb-2">匯入 SRT 或直接貼上歌詞，讓湯頭更有層次、味道更溫柔。</p>
                <textarea
                  id="lyrics"
                  rows={6}
                  className="w-full px-3 py-2 text-gray-200 bg-black/50 border border-cyan-700/50 rounded-md focus:ring-cyan-500 focus:border-cyan-500 transition"
                  placeholder="在這裡貼上您的歌詞 (一行一句)..."
                  value={lyricsText}
                  onChange={(e) => setLyricsText(e.target.value)}
                  required
                />
                 <div className="relative flex items-center justify-center my-3">
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
                      <label htmlFor="srt-upload" className="w-full cursor-pointer bg-teal-600/80 hover:bg-teal-500/80 text-white font-bold py-2 px-4 rounded-md inline-flex items-center justify-center transition">
                        <SrtIcon className="w-5 h-5 mr-2" />
                        <span>上傳 SRT</span>
                      </label>
                    </div>
              </div>
              
              <button
                type="submit"
                className="w-full px-4 py-3 font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-all duration-300 text-xl shadow-[0_0_15px_rgba(0,220,255,0.5)]"
              >
                開始烹麵
              </button>
            </form>
            <div className="text-center text-xs text-gray-500 pt-4 space-y-2">
              <p className="text-sm text-cyan-400/80 font-['Ma_Shan_Zheng']">用心煮好麵 阿嬤說慢慢敲</p>
              <p>阿嬤說：煮麵要穩，別邊滑手機邊撈麵。建議用電腦操作，手機煮麵容易變燒焦。</p>
              <div className="flex items-center justify-center gap-2">
                <p>
                  公益活動 by <a href="https://willwi.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">willwi.com</a>
                </p>
                <button onClick={() => setIsModalOpen(true)} className="text-cyan-400 hover:text-cyan-200 transition">
                  <InfoIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <main className="relative w-full h-screen flex items-center justify-center p-4 overflow-hidden">
      <WillWiMusicLogo />
      {!showSplash && <div className="absolute inset-0 bg-black/80" />}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {renderContent()}
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <h3 className="text-2xl font-bold text-cyan-300 mb-4 font-['Noto_Sans_TC']">關於 Willwi 陳威兒</h3>
        <div className="space-y-3 text-gray-300 text-sm">
            <p>台灣出生 澳洲長大，擁有英國皇家音樂學院鋼琴鑑定5級。回台就讀台南成功大學。曾任中華航空空服員。</p>
            <p>全球首位同時獲得 Spotify 認證歌手、YouTube 官方藝人頻道 (OAC)、Musixmatch 國際大師策展人，並獲得 Apple Music 與 Amazon Music 官方認證 的五重主權音樂人。</p>
            <p>Willwi 不僅在音樂創作上展現跨語言、多風格的才華，更在數位平台生態中建立了獨一無二的地位，精通中、日、韓、泰、義大利、法文、英文、台語。</p>
            <p className="italic text-cyan-400">音樂是我的生活，每一首歌我都熱愛，並真心感謝所有朋友支持。</p>
            <p className="font-bold">代表作品：《放下遺憾》、《折執為詞》、《再愛一次》。2025/6 月獲得 Apple Music 及 Spotify 四大編輯聯合推薦，成為了佳話，更突破現代音樂人的韌性。其中YouTube 更是Willwi第一時間發表作品的重要平台，在不依賴演算法，屢屢作品皆突破上萬次收看完播。</p>
            <div className="border-t border-cyan-700 my-4"></div>
            <p className="text-center font-['Noto_Serif_TC'] text-lg text-yellow-300" style={{textShadow: '0 0 5px rgba(250, 204, 21, 0.5)'}}>
                "世界的定義，不是由標籤決定，而是由我們的故事決定。"
            </p>
        </div>
      </Modal>
    </main>
  );
};

export default App;
