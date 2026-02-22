
import React, { useState } from 'react';
import { Search, Download, AlertCircle, Key, ExternalLink, Globe, Film, Layers, LogOut, X } from 'lucide-react';
import { UnifiedSubtitle } from '../types';
import JSZip from 'jszip';

interface SubtitleSearchProps {
  onSelectSubtitle: (fileContent: string, fileName: string) => void;
}

type SearchMode = 'query' | 'imdb' | 'tmdb';
type Provider = 'OpenSubtitles' | 'Subdl' | 'External';

const EXTERNAL_PROVIDERS = [
    {
        name: 'OpenSubtitles.org',
        url: (q: string) => `https://www.opensubtitles.org/en/search2/moviename-${encodeURIComponent(q)}/sublanguageid-eng`,
        desc: 'The classic website database'
    },
    {
        name: 'Addic7ed',
        url: (q: string) => `https://www.addic7ed.com/search.php?search=${encodeURIComponent(q)}&Submit=Search`,
        desc: 'Fast updates for TV shows'
    },
    {
        name: 'TVsubtitles.net',
        url: (q: string) => `http://www.tvsubtitles.net/search.php?q=${encodeURIComponent(q)}`,
        desc: 'Dedicated to TV series'
    },
    {
        name: 'YIFY Subtitles',
        url: (q: string) => `https://yts-subs.com/search/${encodeURIComponent(q)}`,
        desc: 'Movie subtitles source'
    },
    {
        name: 'Podnapisi',
        url: (q: string) => `https://www.podnapisi.net/subtitles/search/?keywords=${encodeURIComponent(q)}`,
        desc: 'Community driven, high quality'
    },
    {
        name: 'SubsMax',
        url: (q: string) => `https://subsmax.com/subtitles-search/${encodeURIComponent(q)}`,
        desc: 'Subtitle search engine'
    }
];

const SubtitleSearch: React.FC<SubtitleSearchProps> = ({ onSelectSubtitle }) => {
  const [provider, setProvider] = useState<Provider>('OpenSubtitles');
  
  // Search State
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('query');
  
  // History State
  const [history, setHistory] = useState<string[]>(() => {
    try {
        const item = localStorage.getItem('search_history');
        return item ? JSON.parse(item) : [];
    } catch { return []; }
  });
  
  // API Keys - Load from localStorage
  const [osApiKey, setOsApiKey] = useState(() => localStorage.getItem('os_api_key') || '');
  const [subdlApiKey, setSubdlApiKey] = useState(() => localStorage.getItem('subdl_api_key') || '');
  
  // Results & UI State
  const [results, setResults] = useState<UnifiedSubtitle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [manualDownloadLink, setManualDownloadLink] = useState<{url: string, name: string} | null>(null);

  const getApiKey = () => (provider === 'OpenSubtitles' ? osApiKey : subdlApiKey).trim();

  const handleOsKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setOsApiKey(newVal);
    localStorage.setItem('os_api_key', newVal);
  };

  const handleSubdlKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setSubdlApiKey(newVal);
    localStorage.setItem('subdl_api_key', newVal);
  };

  const addToHistory = (q: string) => {
    if (!q.trim()) return;
    const cleanQ = q.trim();
    const newHist = [cleanQ, ...history.filter(h => h !== cleanQ)].slice(0, 5);
    setHistory(newHist);
    localStorage.setItem('search_history', JSON.stringify(newHist));
  };

  const removeFromHistory = (e: React.MouseEvent, q: string) => {
      e.stopPropagation();
      const newHist = history.filter(h => h !== q);
      setHistory(newHist);
      localStorage.setItem('search_history', JSON.stringify(newHist));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query) return;
    
    // Save to history
    addToHistory(query);

    // For external providers, we don't need to fetch anything
    if (provider === 'External') {
        return; 
    }

    const key = getApiKey();
    if (!key) {
      setError(`Please enter your ${provider} API Key.`);
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setManualDownloadLink(null);

    try {
        if (provider === 'OpenSubtitles') {
            await searchOpenSubtitles(key);
        } else {
            await searchSubdl(key);
        }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch subtitles.");
    } finally {
      setLoading(false);
    }
  };

  const searchOpenSubtitles = async (key: string) => {
      const url = new URL('https://api.opensubtitles.com/api/v1/subtitles');
      url.searchParams.append('languages', 'en');

      if (searchMode === 'imdb') {
          const cleanId = query.toLowerCase().replace('tt', '').trim();
          url.searchParams.append('imdb_id', cleanId);
      } else if (searchMode === 'tmdb') {
          url.searchParams.append('tmdb_id', query.trim());
      } else {
          url.searchParams.append('query', query.trim());
      }

      if (season) url.searchParams.append('season_number', season);
      if (episode) url.searchParams.append('episode_number', episode);

      // Attempt to include Content-Type even for GET, and ensure Api-Key is set correctly
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 
            'Api-Key': key, 
            'Accept': 'application/json',
            'Content-Type': 'application/json' 
        }
      });

      if (!response.ok) {
        let errorMsg = `Error ${response.status}: ${response.statusText || 'Unknown Error'}`;
        try {
            // Try to parse text first to capture HTML or raw errors
            const rawText = await response.text();
            try {
                 const data = JSON.parse(rawText);
                 if (data.message) errorMsg = data.message;
                 else if (data.errors) errorMsg = JSON.stringify(data.errors);
            } catch {
                // If JSON parse fails, check if raw text is short enough to be a message
                if (rawText && rawText.length < 200) errorMsg = rawText;
            }
        } catch {}
        
        if (response.status === 403) {
             errorMsg = "Access Denied (403). Your API Key is likely invalid or quota exceeded. Please double-check you copied the 'Consumer Key' correctly from the OpenSubtitles.com dashboard.";
        }
        if (response.status === 401) {
             errorMsg = "Unauthorized (401). Invalid API Key.";
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      if (data.data) {
          const unified: UnifiedSubtitle[] = data.data.map((item: any) => ({
              id: item.id,
              provider: 'OpenSubtitles',
              title: item.attributes.release,
              language: item.attributes.language,
              format: item.attributes.format || 'srt',
              downloadCount: item.attributes.download_count,
              score: item.attributes.votes,
              uploadDate: item.attributes.upload_date,
              hearingImpaired: item.attributes.hearing_impaired,
              fps: item.attributes.fps,
              fileId: item.attributes.files[0]?.file_id,
              fileName: item.attributes.files[0]?.file_name || 'subtitle.srt'
          }));
          setResults(unified);
      } else {
          setResults([]);
      }
  };

  const searchSubdl = async (key: string) => {
      // Subdl API Endpoint
      const url = new URL('https://api.subdl.com/api/v1/subtitles');
      url.searchParams.append('api_key', key);
      url.searchParams.append('languages', 'en'); // Changed 'EN' to 'en'

      if (searchMode === 'imdb') {
           url.searchParams.append('imdb_id', query.toLowerCase().startsWith('tt') ? query.trim() : `tt${query.trim()}`);
      } else if (searchMode === 'tmdb') {
           url.searchParams.append('tmdb_id', query.trim());
      } else {
           url.searchParams.append('film_name', query.trim());
      }
      
      if (season && episode) {
          url.searchParams.append('type', 'tv');
      }

      const response = await fetch(url.toString());
      
      if (!response.ok) {
          throw new Error(`Subdl API Error: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.status) {
          throw new Error(data.error || "Subdl API returned an error");
      }

      // Flatten results
      const unified: UnifiedSubtitle[] = [];
      
      // Helper to process a subtitle object
      const processSubtitle = (sub: any, movieName: string) => {
          if (season && sub.season && parseInt(sub.season) !== parseInt(season)) return;
          if (episode && sub.episode && parseInt(sub.episode) !== parseInt(episode)) return;

          unified.push({
              id: sub.url, // Using URL as ID for Subdl
              provider: 'Subdl',
              title: sub.release_name || movieName,
              language: sub.language,
              format: 'zip',
              downloadCount: sub.downloads,
              score: sub.rating,
              uploadDate: sub.date,
              hearingImpaired: sub.hearing_impaired,
              downloadUrl: sub.url,
              fileName: sub.release_name ? `${sub.release_name}.srt` : 'subtitle.srt'
          });
      };

      // Scenario 1: 'results' contains movies, which contain 'subtitles'
      if (data.results && Array.isArray(data.results)) {
          data.results.forEach((movie: any) => {
              if (movie.subtitles && Array.isArray(movie.subtitles)) {
                  movie.subtitles.forEach((sub: any) => processSubtitle(sub, movie.name));
              }
          });
      }
      
      // Scenario 2: 'subtitles' is at the root (sometimes returned by ID searches)
      if (data.subtitles && Array.isArray(data.subtitles)) {
          data.subtitles.forEach((sub: any) => processSubtitle(sub, query));
      }

      setResults(unified);
  };

  const handleDownload = async (item: UnifiedSubtitle) => {
    const key = getApiKey();
    setDownloading(item.id);
    setError('');
    setManualDownloadLink(null);

    try {
        if (item.provider === 'OpenSubtitles') {
            await downloadOpenSubtitles(item.fileId!, item.fileName, key);
        } else {
            await downloadSubdl(item.downloadUrl!, item.fileName);
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Download failed");
    } finally {
        setDownloading(null);
    }
  };

  const downloadOpenSubtitles = async (fileId: number, fileName: string, key: string) => {
      const linkRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
          method: 'POST',
          headers: {
              'Api-Key': key,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
          },
          body: JSON.stringify({ file_id: fileId })
      });

      if (!linkRes.ok) {
           let msg = "Failed to get download link";
           try {
               const errJson = await linkRes.json();
               if(errJson.message) msg = errJson.message;
           } catch {}
           throw new Error(msg);
      }
      
      const linkData = await linkRes.json();
      const downloadUrl = linkData.link;

      try {
          const contentRes = await fetch(downloadUrl);
          if (!contentRes.ok) throw new Error("Failed to download file content");
          const text = await contentRes.text();
          onSelectSubtitle(text, fileName);
      } catch (e) {
          setManualDownloadLink({ url: downloadUrl, name: fileName });
          throw new Error("Browser blocked automatic download (CORS). Use the manual link below.");
      }
  };

  const downloadSubdl = async (url: string, fileName: string) => {
      const fullUrl = url.startsWith('http') ? url : `https://subdl.com/${url}`;

      try {
          const response = await fetch(fullUrl);
          if (!response.ok) throw new Error("Network response was not ok");
          
          const blob = await response.blob();
          const zip = new JSZip();
          const contents = await zip.loadAsync(blob);
          const srtFile: any = Object.values(contents.files).find((f: any) => f.name.toLowerCase().endsWith('.srt'));
          
          if (!srtFile) {
              throw new Error("No .srt file found in the downloaded archive.");
          }
          
          const text = await srtFile.async('string');
          onSelectSubtitle(text, srtFile.name);

      } catch (e) {
          console.error("Subdl download/extract error", e);
          setManualDownloadLink({ url: fullUrl, name: fileName + ".zip" });
          throw new Error("Automatic download/extraction failed (likely CORS or Zip format). Use the manual link below.");
      }
  };

  return (
    <div className="space-y-6">
      {/* Provider & API Key Section */}
      <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-4 transition-colors duration-300">
        
        {/* Provider Tabs */}
        <div role="tablist" className="flex gap-4 border-b border-zinc-200 dark:border-zinc-700 pb-2">
            <button 
                role="tab"
                aria-selected={provider === 'OpenSubtitles'}
                onClick={() => { setProvider('OpenSubtitles'); setResults([]); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'OpenSubtitles' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Search using OpenSubtitles.com API"
            >
                <Layers className="w-4 h-4" /> OpenSubtitles
            </button>
            <button 
                role="tab"
                aria-selected={provider === 'Subdl'}
                onClick={() => { setProvider('Subdl'); setResults([]); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'Subdl' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Search using Subdl.com API"
            >
                <Layers className="w-4 h-4" /> Subdl
            </button>
            <button 
                role="tab"
                aria-selected={provider === 'External'}
                onClick={() => { setProvider('External'); setResults([]); setError(''); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'External' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                title="Get links to external subtitle websites"
            >
                <Globe className="w-4 h-4" /> External Sites
            </button>
        </div>

        {provider !== 'External' && (
            <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-yellow-500 dark:text-yellow-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                    {provider === 'OpenSubtitles' ? (
                        <>
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">OpenSubtitles Consumer Key</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                                Get one from <a href="https://www.opensubtitles.com/en/consumers" target="_blank" className="text-yellow-600 dark:text-yellow-400 hover:underline">opensubtitles.com</a>.
                            </p>
                            <input
                                aria-label="OpenSubtitles API Key"
                                type="password"
                                placeholder="Enter OpenSubtitles Key"
                                value={osApiKey}
                                onChange={handleOsKeyChange}
                                title="Enter your OpenSubtitles API key here"
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-zinc-200 font-mono text-sm focus:border-yellow-500 focus:outline-none transition-colors"
                            />
                        </>
                    ) : (
                        <>
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Subdl API Key</h3>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                                Get one from <a href="https://subdl.com/panel/api" target="_blank" className="text-yellow-600 dark:text-yellow-400 hover:underline">subdl.com/panel/api</a>.
                            </p>
                            <input
                                aria-label="Subdl API Key"
                                type="password"
                                placeholder="Enter Subdl API Key"
                                value={subdlApiKey}
                                onChange={handleSubdlKeyChange}
                                title="Enter your Subdl API key here"
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded p-2 text-zinc-900 dark:text-zinc-200 font-mono text-sm focus:border-yellow-500 focus:outline-none transition-colors"
                            />
                        </>
                    )}
                </div>
            </div>
        )}
        
        {provider === 'External' && (
             <div className="flex items-start gap-3">
                <LogOut className="w-5 h-5 text-yellow-500 dark:text-yellow-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Manual Search</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        These sites do not provide a public API for apps. We will generate search links for you. 
                        Download the .srt file manually, then switch to the <strong>Upload File</strong> tab to process it.
                    </p>
                </div>
            </div>
        )}
      </div>

      {/* Search Controls */}
      <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-fit">
               <button onClick={() => setSearchMode('query')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${searchMode === 'query' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>Text</button>
               <button onClick={() => setSearchMode('imdb')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${searchMode === 'imdb' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>IMDb ID</button>
               <button onClick={() => setSearchMode('tmdb')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${searchMode === 'tmdb' ? 'bg-white dark:bg-zinc-600 shadow-sm text-black dark:text-white' : 'text-zinc-500'}`}>TMDB ID</button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                      autoFocus
                      type="text" 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={searchMode === 'query' ? "Search movie or TV show..." : searchMode === 'imdb' ? "tt1234567" : "12345"}
                      className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:border-yellow-500 transition-colors"
                  />
                  {history.length > 0 && !query && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden">
                          <div className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50">Recent Searches</div>
                          {history.map(h => (
                              <div key={h} onClick={() => { setQuery(h); handleSearch(); }} className="px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex justify-between group">
                                  <span>{h}</span>
                                  <X onClick={(e) => removeFromHistory(e, h)} className="w-4 h-4 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                          ))}
                      </div>
                  )}
              </div>
              
              {(searchMode !== 'imdb' && searchMode !== 'tmdb') && (
                  <>
                    <input 
                        type="number" 
                        placeholder="S" 
                        value={season} 
                        onChange={e => setSeason(e.target.value)}
                        className="w-16 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:border-yellow-500 text-center"
                        title="Season Number"
                    />
                    <input 
                        type="number" 
                        placeholder="E" 
                        value={episode} 
                        onChange={e => setEpisode(e.target.value)}
                        className="w-16 px-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus:outline-none focus:border-yellow-500 text-center"
                        title="Episode Number"
                    />
                  </>
              )}
              
              <button 
                type="submit" 
                disabled={loading || !query}
                className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                  {loading ? <span className="animate-spin">⌛</span> : <Search className="w-5 h-5" />}
                  Search
              </button>
          </form>
      </div>

      {/* External Links Generator */}
      {provider === 'External' && query && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2">
              {EXTERNAL_PROVIDERS.map((prov) => (
                  <a 
                    key={prov.name} 
                    href={prov.url(query)} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-yellow-500 dark:hover:border-yellow-500 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
                  >
                      <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg group-hover:text-yellow-500 transition-colors">
                          <ExternalLink className="w-4 h-4" />
                      </div>
                      <div>
                          <div className="font-bold text-sm">{prov.name}</div>
                          <div className="text-[10px] text-zinc-500">{prov.desc}</div>
                      </div>
                  </a>
              ))}
          </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-300 text-sm flex items-start gap-3">
             <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
             <div>{error}</div>
        </div>
      )}

      {/* Manual Download Link Fallback */}
      {manualDownloadLink && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-blue-800 dark:text-blue-200 text-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Automatic Download Blocked</span>
              </div>
              <p>The browser blocked the file download or the API response format was unexpected (CORS/Zip). Please download manually:</p>
              <a href={manualDownloadLink.url} download={manualDownloadLink.name} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline break-all font-mono">
                  {manualDownloadLink.url}
              </a>
          </div>
      )}

      {/* Results List */}
      {results.length > 0 && (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
              <div className="grid grid-cols-[1fr_80px_100px_100px] gap-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  <div>Release Name</div>
                  <div className="text-center">Lang</div>
                  <div className="text-center">Format</div>
                  <div className="text-right">Action</div>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
                  {results.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px] gap-4 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors items-center">
                          <div className="min-w-0">
                              <div className="font-medium text-sm truncate" title={item.title}>{item.title}</div>
                              <div className="flex gap-2 text-[10px] text-zinc-500 mt-1">
                                  {item.uploadDate && <span>{item.uploadDate.split('T')[0]}</span>}
                                  {item.downloadCount !== undefined && <span>• {item.downloadCount} DLs</span>}
                                  {item.hearingImpaired && <span className="text-yellow-600 dark:text-yellow-500 font-bold">• HI</span>}
                                  {item.score !== undefined && <span>• ⭐ {item.score}</span>}
                              </div>
                          </div>
                          <div className="text-center">
                              <span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">{item.language}</span>
                          </div>
                          <div className="text-center">
                              <span className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono uppercase">{item.format}</span>
                          </div>
                          <div className="text-right">
                              <button 
                                onClick={() => handleDownload(item)} 
                                disabled={!!downloading}
                                className="px-3 py-1.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-bold hover:opacity-80 disabled:opacity-50 transition-opacity flex items-center gap-1 ml-auto"
                              >
                                  {downloading === item.id ? <span className="animate-spin">⌛</span> : <Download className="w-3.5 h-3.5" />}
                                  {downloading === item.id ? '...' : 'Get'}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {!loading && results.length === 0 && query && provider !== 'External' && (
          <div className="text-center py-12 text-zinc-400">
              <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No subtitles found for "{query}".</p>
          </div>
      )}
    </div>
  );
};

export default SubtitleSearch;
