import React, { useState } from 'react';
import { Search, Download, AlertCircle, Key, ExternalLink, Globe, Film, Clapperboard, Layers, LogOut } from 'lucide-react';
import { UnifiedSubtitle } from '../types';
import JSZip from 'jszip';

interface SubtitleSearchProps {
  onSelectSubtitle: (fileContent: string, fileName: string) => void;
}

type SearchMode = 'query' | 'imdb' | 'tmdb';
type Provider = 'OpenSubtitles' | 'Subdl' | 'External';

const SubtitleSearch: React.FC<SubtitleSearchProps> = ({ onSelectSubtitle }) => {
  const [provider, setProvider] = useState<Provider>('OpenSubtitles');
  
  // Search State
  const [query, setQuery] = useState('');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('query');
  
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    
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

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Api-Key': key, 'Accept': 'application/json' }
      });

      if (!response.ok) {
        let errorMsg = `Error ${response.status}: ${response.statusText}`;
        try {
            const data = await response.json();
            if (data.message) errorMsg = data.message;
        } catch {}
        if (response.status === 403) errorMsg += ". Ensure you are using a Consumer Key from opensubtitles.com.";
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
      }
  };

  const searchSubdl = async (key: string) => {
      // Subdl API Endpoint
      const url = new URL('https://api.subdl.com/api/v1/subtitles');
      url.searchParams.append('api_key', key);
      url.searchParams.append('languages', 'EN'); // Subdl uses 2-letter codes usually

      if (searchMode === 'imdb') {
           url.searchParams.append('imdb_id', query.toLowerCase().startsWith('tt') ? query.trim() : `tt${query.trim()}`);
      } else if (searchMode === 'tmdb') {
           url.searchParams.append('tmdb_id', query.trim());
      } else {
           url.searchParams.append('film_name', query.trim());
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
      
      if (data.results && Array.isArray(data.results)) {
          data.results.forEach((movie: any) => {
              if (movie.subtitles && Array.isArray(movie.subtitles)) {
                  movie.subtitles.forEach((sub: any) => {
                      if (season && sub.season && parseInt(sub.season) !== parseInt(season)) return;
                      if (episode && sub.episode && parseInt(sub.episode) !== parseInt(episode)) return;

                      unified.push({
                          id: sub.url, // Using URL as ID for Subdl
                          provider: 'Subdl',
                          title: sub.release_name || movie.name,
                          language: sub.language,
                          format: 'zip',
                          downloadCount: sub.downloads,
                          score: sub.rating,
                          uploadDate: sub.date,
                          hearingImpaired: sub.hearing_impaired,
                          downloadUrl: sub.url,
                          fileName: sub.release_name ? `${sub.release_name}.srt` : 'subtitle.srt'
                      });
                  });
              }
          });
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

      if (!linkRes.ok) throw new Error("Failed to get download link from OpenSubtitles");
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

  const externalProviders = [
    {
        name: 'OpenSubtitles.org',
        url: (q: string) => `https://www.opensubtitles.org/en/search/sublanguageid-eng/q-${encodeURIComponent(q)}`,
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
    }
  ];

  return (
    <div className="space-y-6">
      {/* Provider & API Key Section */}
      <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 space-y-4">
        
        {/* Provider Tabs */}
        <div className="flex gap-4 border-b border-zinc-700 pb-2">
            <button 
                onClick={() => { setProvider('OpenSubtitles'); setResults([]); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'OpenSubtitles' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            >
                <Layers className="w-4 h-4" /> OpenSubtitles
            </button>
            <button 
                onClick={() => { setProvider('Subdl'); setResults([]); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'Subdl' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            >
                <Layers className="w-4 h-4" /> Subdl
            </button>
            <button 
                onClick={() => { setProvider('External'); setResults([]); setError(''); }}
                className={`flex items-center gap-2 px-3 py-1 rounded transition-colors ${provider === 'External' ? 'bg-yellow-500 text-black font-semibold' : 'text-zinc-400 hover:text-white'}`}
            >
                <Globe className="w-4 h-4" /> External Sites
            </button>
        </div>

        {provider !== 'External' && (
            <div className="flex items-start gap-3">
                <Key className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                    {provider === 'OpenSubtitles' ? (
                        <>
                            <h3 className="font-semibold text-zinc-100">OpenSubtitles Consumer Key</h3>
                            <p className="text-sm text-zinc-400 mb-2">
                                Get one from <a href="https://www.opensubtitles.com/en/consumers" target="_blank" className="text-yellow-400 hover:underline">opensubtitles.com</a>.
                            </p>
                            <input
                                type="password"
                                placeholder="Enter OpenSubtitles Key"
                                value={osApiKey}
                                onChange={handleOsKeyChange}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-200 font-mono text-sm focus:border-yellow-500 focus:outline-none"
                            />
                        </>
                    ) : (
                        <>
                            <h3 className="font-semibold text-zinc-100">Subdl API Key</h3>
                            <p className="text-sm text-zinc-400 mb-2">
                                Get one from <a href="https://subdl.com/panel/api" target="_blank" className="text-yellow-400 hover:underline">subdl.com/panel/api</a>.
                            </p>
                            <input
                                type="password"
                                placeholder="Enter Subdl API Key"
                                value={subdlApiKey}
                                onChange={handleSubdlKeyChange}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-200 font-mono text-sm focus:border-yellow-500 focus:outline-none"
                            />
                        </>
                    )}
                </div>
            </div>
        )}
        
        {provider === 'External' && (
             <div className="flex items-start gap-3">
                <LogOut className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                    <h3 className="font-semibold text-zinc-100">Manual Search</h3>
                    <p className="text-sm text-zinc-400">
                        These sites do not provide a public API for apps. We will generate search links for you. 
                        Download the .srt file manually, then switch to the <strong>Upload File</strong> tab to process it.
                    </p>
                </div>
            </div>
        )}
      </div>

      {/* Search Controls */}
      <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-zinc-800 rounded-lg w-fit">
              <button onClick={() => setSearchMode('query')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${searchMode === 'query' ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  <Search className="w-4 h-4" /> Text
              </button>
              <button onClick={() => setSearchMode('imdb')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${searchMode === 'imdb' ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  <Clapperboard className="w-4 h-4" /> IMDB
              </button>
              <button onClick={() => setSearchMode('tmdb')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${searchMode === 'tmdb' ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:text-white'}`}>
                  <Film className="w-4 h-4" /> TMDB
              </button>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col gap-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={
                        searchMode === 'imdb' ? "tt1375666" :
                        searchMode === 'tmdb' ? "27205" :
                        "Search movie/show..."
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 focus:border-yellow-500 focus:outline-none"
                />
                
                <div className="flex gap-2">
                    <input type="number" min="1" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="S" className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg text-center focus:border-yellow-500 focus:outline-none" title="Season" />
                    <input type="number" min="1" value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="E" className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg text-center focus:border-yellow-500 focus:outline-none" title="Episode" />
                </div>

                {provider !== 'External' && (
                    <button
                        type="submit"
                        disabled={loading || !getApiKey()}
                        className="bg-yellow-500 text-black font-semibold px-6 py-3 rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? '...' : <Search className="w-5 h-5" />}
                    </button>
                )}
            </div>
          </form>
      </div>
      
      {/* External Links Grid */}
      {provider === 'External' && query && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {externalProviders.map((site) => (
                  <a 
                    key={site.name}
                    href={site.url(query)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 hover:border-yellow-500 hover:bg-zinc-750 transition-all group flex justify-between items-center"
                  >
                      <div>
                          <h4 className="font-semibold text-lg text-zinc-100 group-hover:text-yellow-400 transition-colors">{site.name}</h4>
                          <p className="text-sm text-zinc-400">{site.desc}</p>
                      </div>
                      <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-yellow-500" />
                  </a>
              ))}
          </div>
      )}
      
      {/* API Error & Fallback */}
      {error && provider !== 'External' && (
        <div className="bg-red-900/20 border border-red-800 text-red-200 p-4 rounded-lg flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
            </div>
            {manualDownloadLink && (
                <div className="ml-7 mt-1">
                    <a href={manualDownloadLink.url} download className="text-yellow-400 hover:underline font-medium inline-flex items-center gap-1">
                        <Download className="w-4 h-4" /> Download manually
                    </a>
                </div>
            )}
        </div>
      )}

      {/* API Results List */}
      {provider !== 'External' && (
          <div className="space-y-3">
            {results.map((item) => (
            <div key={item.id} className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 flex justify-between items-center hover:bg-zinc-800 transition-colors">
                <div className="overflow-hidden pr-4">
                <div className="flex items-center gap-2">
                    <h4 className="font-medium text-lg text-zinc-100 truncate">{item.title}</h4>
                    <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 rounded">{item.provider}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-400 mt-1">
                    <span className="bg-zinc-700/50 px-2 py-0.5 rounded text-xs border border-zinc-600 uppercase">{item.format}</span>
                    {item.downloadCount !== undefined && <span>DLs: {item.downloadCount}</span>}
                    {item.score !== undefined && <span>Score: {item.score}</span>}
                    {item.uploadDate && <span>{new Date(item.uploadDate).toLocaleDateString()}</span>}
                    {item.hearingImpaired && <span className="text-yellow-500/80" title="Hearing Impaired">HI</span>}
                </div>
                </div>
                <button
                    onClick={() => handleDownload(item)}
                    disabled={!!downloading}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded flex-shrink-0 flex items-center gap-2 transition-colors min-w-[100px] justify-center"
                >
                    {downloading === item.id ? 'Loading...' : <><Download className="w-4 h-4" /> Get</>}
                </button>
            </div>
            ))}
            {results.length === 0 && !loading && query && !error && (
                <div className="text-center py-8 space-y-2">
                    <p className="text-zinc-500">No results found on {provider}.</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default SubtitleSearch;