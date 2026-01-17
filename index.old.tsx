import React, { useState, useEffect, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Clapperboard, 
  Image as ImageIcon, 
  Film, 
  FileText, 
  Plus, 
  Trash2, 
  Wand2, 
  Play, 
  Loader2, 
  ChevronRight,
  LayoutGrid,
  Download
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Types & Interfaces ---

interface Project {
  id: string;
  name: string;
  lastModified: number;
  script: string;
  scenes: Scene[];
}

interface Scene {
  id: string;
  scriptSegment: string;
  visualPrompt: string;
  negPrompt: string;
  shotType: string; // e.g., Close-up, Wide
  status: 'pending' | 'generating_image' | 'image_ready' | 'generating_video' | 'video_ready' | 'error';
  imageUrl?: string;
  videoUrl?: string;
}

// --- Agent System Prompts (Localized) ---

const AGENT_PROMPTS = {
  WRITER: `你是一位专业的短剧编剧。
  你的任务是将用户的简短想法扩展为引人入胜、节奏紧凑的短剧剧本。
  请专注于短剧特有的冲突感、快节奏对话和情绪钩子。
  请直接输出中文剧本内容。`,
  
  STORYBOARDER: `你是一位专业的分镜师和导演。
  输入：一段中文剧本。
  输出：一个 JSON 格式的场景数组。对于每个场景，请提供：
  1. 'scriptSegment': 涵盖该镜头的原始中文对白或动作描述。
  2. 'visualPrompt': 一个非常详细的**英文**画面生成提示词（Prompt），描述主体、环境、光线和风格（Cinematic, photorealistic, 8k）。**注意：必须翻译为英文，以便绘图模型理解。**
  3. 'shotType': 镜头景别（如：特写 Close-up, 中景 Mid Shot, 广角 Wide Shot 等，保留英文或使用中文皆可，建议使用标准的电影术语）。
  
  格式严格指令：仅返回有效的 JSON 数组。不要包含 markdown 代码块标记。`,
};

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-red-400 p-4">
          <h2 className="text-2xl font-bold mb-4">系统遇到了一些问题</h2>
          <p className="text-slate-400 mb-4">请尝试刷新页面。如果问题持续，请查看控制台日志。</p>
          <pre className="bg-slate-900 p-4 rounded text-xs overflow-auto max-w-full border border-red-900/50">
            {this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Components ---

// 1. Project List View
const ProjectList = ({ onSelect, onDelete, onCreate }: { onSelect: (p: Project) => void, onDelete: (id: string) => void, onCreate: () => void }) => {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('drama_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = Array.isArray(parsed) ? parsed.map((p: any) => ({
          ...p,
          scenes: Array.isArray(p.scenes) ? p.scenes : []
        })) : [];
        setProjects(sanitized);
      }
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
    try {
      const saved = localStorage.getItem('drama_projects');
      if (saved) setProjects(JSON.parse(saved));
    } catch(e) {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              CinemaForge AI | 剧本工坊
            </h1>
            <p className="text-slate-400">短剧 AIGC 全流程生产系统</p>
          </div>
          <button 
            onClick={onCreate}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 text-white"
          >
            <Plus size={20} /> 新建项目
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(p => (
            <div 
              key={p.id}
              onClick={() => onSelect(p)}
              className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-6 cursor-pointer transition-all hover:shadow-2xl hover:shadow-indigo-500/10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                  <FileText className="text-indigo-400" size={24} />
                </div>
                <button 
                  onClick={(e) => handleDelete(e, p.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-xl font-semibold mb-2">{p.name}</h3>
              <p className="text-slate-500 text-sm">
                最后编辑: {new Date(p.lastModified).toLocaleDateString()}
              </p>
              <div className="mt-4 flex gap-2 text-xs text-slate-400">
                <span className="bg-slate-800 px-2 py-1 rounded">{p.scenes?.length || 0} 个分镜</span>
                <span className="bg-slate-800 px-2 py-1 rounded">{((p.script?.length || 0) / 1000).toFixed(1)}k 字</span>
              </div>
            </div>
          ))}
          
          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
              <Clapperboard size={48} className="mb-4 opacity-50" />
              <p>暂无项目，快去开始你的创作吧。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 2. Main Workspace
const Workspace = ({ project, onBack, onUpdate }: { project: Project, onBack: () => void, onUpdate: (p: Project) => void }) => {
  const [activeTab, setActiveTab] = useState<'script' | 'storyboard' | 'visuals' | 'cinema'>('script');
  const [loading, setLoading] = useState(false);
  const [localProject, setLocalProject] = useState<Project>(project);

  // Auto-save logic
  useEffect(() => {
    onUpdate(localProject);
  }, [localProject]);

  // Ensure scenes array exists
  useEffect(() => {
    if (!localProject.scenes) {
      setLocalProject(prev => ({ ...prev, scenes: [] }));
    }
  }, []);

  // --- Logic Handlers ---

  const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

  const handleAIScriptExpand = async (prompt: string) => {
    setLoading(true);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${AGENT_PROMPTS.WRITER}\n\n用户指令: ${prompt}\n\n当前剧本上下文: ${localProject.script}`,
      });
      if (response.text) {
        setLocalProject(prev => ({ ...prev, script: prev.script + "\n" + response.text }));
      }
    } catch (e) {
      console.error(e);
      alert("AI 生成失败，请检查控制台日志。");
    }
    setLoading(false);
  };

  const handleGenerateStoryboard = async () => {
    setLoading(true);
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${AGENT_PROMPTS.STORYBOARDER}\n\n剧本内容:\n${localProject.script}`,
        config: { responseMimeType: "application/json" }
      });
      
      const text = response.text || "[]";
      // Robust JSON extraction
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text.replace(/```json\n?|\n?```/g, '').trim();
      
      let scenesData;
      try {
        scenesData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON Parse Error", parseError);
        alert("解析 AI 响应失败，请重试。");
        setLoading(false);
        return;
      }
      
      const newScenes: Scene[] = Array.isArray(scenesData) ? scenesData.map((s: any) => ({
        id: crypto.randomUUID(),
        scriptSegment: s.scriptSegment || "",
        visualPrompt: s.visualPrompt || "",
        negPrompt: "blurry, low quality, distortion, watermark",
        shotType: s.shotType || "Mid Shot",
        status: 'pending'
      })) : [];

      if (newScenes.length === 0) {
        alert("AI 未返回任何分镜。");
        setLoading(false);
        return;
      }

      setLocalProject(prev => ({ ...prev, scenes: newScenes }));
      setActiveTab('storyboard');
    } catch (e) {
      console.error(e);
      alert("分镜生成失败。");
    }
    setLoading(false);
  };

  const handleGenerateImage = async (sceneId: string) => {
    const sceneIndex = localProject.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;

    const updatedScenes = [...localProject.scenes];
    updatedScenes[sceneIndex].status = 'generating_image';
    setLocalProject({ ...localProject, scenes: updatedScenes });

    try {
      const scene = localProject.scenes[sceneIndex];
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: {
          parts: [{ text: `${scene.shotType}, ${scene.visualPrompt}` }]
        },
        config: {
          imageConfig: { aspectRatio: "16:9" }
        }
      });

      let imageUrl = "";
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      if (imageUrl) {
        updatedScenes[sceneIndex].imageUrl = imageUrl;
        updatedScenes[sceneIndex].status = 'image_ready';
      } else {
        updatedScenes[sceneIndex].status = 'error';
      }
    } catch (e) {
      console.error(e);
      updatedScenes[sceneIndex].status = 'error';
    }
    setLocalProject({ ...localProject, scenes: updatedScenes });
  };

  const handleGenerateVideo = async (sceneId: string) => {
    const sceneIndex = localProject.scenes.findIndex(s => s.id === sceneId);
    if (sceneIndex === -1) return;
    const scene = localProject.scenes[sceneIndex];
    if (!scene.imageUrl) {
        alert("请先生成图片！");
        return;
    }

    // Veo API Key Check
    try {
      if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey() === false) {
         await (window as any).aistudio.openSelectKey();
      }
    } catch(e) { 
      console.log("AI Studio key selection skipped/unavailable."); 
    }

    const updatedScenes = [...localProject.scenes];
    updatedScenes[sceneIndex].status = 'generating_video';
    setLocalProject({ ...localProject, scenes: updatedScenes });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = scene.imageUrl.split(',')[1];

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        image: {
            imageBytes: base64Data,
            mimeType: 'image/png'
        },
        prompt: scene.visualPrompt.slice(0, 200),
        config: {
            numberOfVideos: 1,
            aspectRatio: '16:9',
            resolution: '720p'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation});
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (videoUri) {
          const fetchUrl = `${videoUri}&key=${process.env.API_KEY}`;
          updatedScenes[sceneIndex].videoUrl = fetchUrl;
          updatedScenes[sceneIndex].status = 'video_ready';
      } else {
          updatedScenes[sceneIndex].status = 'error';
      }

    } catch (e) {
      console.error(e);
      updatedScenes[sceneIndex].status = 'error';
    }
    setLocalProject({ ...localProject, scenes: updatedScenes });
  };

  const ScriptView = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      <div className="flex-1 bg-slate-900 rounded-xl p-6 flex flex-col shadow-lg border border-slate-800">
        <label className="text-slate-400 text-sm mb-2 font-medium flex items-center gap-2">
          <FileText size={16} /> 剧本编辑器
        </label>
        <textarea
          className="flex-1 bg-slate-800/50 text-slate-100 p-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono leading-relaxed resize-none border border-slate-700/50"
          value={localProject.script}
          onChange={(e) => setLocalProject({ ...localProject, script: e.target.value })}
          placeholder="第一场 - 咖啡厅 - 日&#10;[清晨的阳光洒在桌面上，主角..."
        />
      </div>
      <div className="w-full lg:w-80 bg-slate-900 rounded-xl p-6 flex flex-col shadow-lg border border-slate-800">
        <div className="flex items-center gap-2 mb-4 text-indigo-400">
          <Wand2 size={20} />
          <h3 className="font-semibold">AI 编剧助手</h3>
        </div>
        <div className="flex-1 bg-slate-800/50 rounded-lg p-4 mb-4 text-sm text-slate-400 overflow-y-auto">
          <p>我可以帮你扩写创意、润色对白或格式化场景。请在下方输入指令。</p>
        </div>
        <div className="flex gap-2">
          <input 
            id="ai-prompt"
            type="text" 
            placeholder="例如：增加一个反转..." 
            className="flex-1 bg-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAIScriptExpand(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
          <button 
            disabled={loading}
            className="bg-indigo-600 p-2 rounded hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
            onClick={() => {
              const input = document.getElementById('ai-prompt') as HTMLInputElement;
              if(input.value) {
                handleAIScriptExpand(input.value);
                input.value = '';
              }
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>
        <button 
          onClick={handleGenerateStoryboard}
          disabled={loading || !localProject.script}
          className="mt-6 w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 rounded-lg font-medium flex items-center justify-center gap-2 text-white shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Clapperboard size={18} />}
          拆解为分镜表
        </button>
      </div>
    </div>
  );

  const StoryboardView = () => (
    <div className="h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-10">
      <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-4 w-16 bg-slate-950">#</th>
              <th className="p-4 w-1/4 bg-slate-950">剧本片段</th>
              <th className="p-4 w-1/5 bg-slate-950">景别</th>
              <th className="p-4 bg-slate-950">画面提示词 (AI 生成 - 英文推荐)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {localProject.scenes?.map((scene, idx) => (
              <tr key={scene.id} className="hover:bg-slate-800/50 transition-colors group">
                <td className="p-4 font-mono text-slate-500 align-top pt-5">{idx + 1}</td>
                <td className="p-4 text-slate-300 text-sm align-top">
                  <div className="p-2 rounded bg-slate-800/30 border border-slate-800/50">
                    {scene.scriptSegment}
                  </div>
                </td>
                <td className="p-4 align-top">
                   <input 
                      value={scene.shotType}
                      onChange={(e) => {
                        const newScenes = [...localProject.scenes];
                        newScenes[idx].shotType = e.target.value;
                        setLocalProject({ ...localProject, scenes: newScenes });
                      }}
                      className="bg-transparent text-indigo-400 text-sm font-medium focus:outline-none border-b border-transparent focus:border-indigo-500 w-full"
                   />
                </td>
                <td className="p-4 align-top">
                  <textarea 
                    value={scene.visualPrompt}
                    onChange={(e) => {
                      const newScenes = [...localProject.scenes];
                      newScenes[idx].visualPrompt = e.target.value;
                      setLocalProject({ ...localProject, scenes: newScenes });
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded p-3 text-sm text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                    rows={3}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!localProject.scenes || localProject.scenes.length === 0) && (
            <div className="p-20 text-center text-slate-500 flex flex-col items-center">
                <Clapperboard size={48} className="mb-4 opacity-20" />
                <p>暂无分镜。</p>
                <p className="text-sm mt-2">请前往 <strong className="text-indigo-400">剧本</strong> 标签页并点击“拆解为分镜表”。</p>
            </div>
        )}
      </div>
    </div>
  );

  const VisualsView = () => (
    <div className="h-[calc(100vh-140px)] overflow-y-auto pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {localProject.scenes?.map((scene, idx) => (
          <div key={scene.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col shadow-lg transition-transform hover:scale-[1.01]">
            <div className="aspect-video bg-slate-950 relative group">
              {scene.imageUrl ? (
                <img src={scene.imageUrl} alt="Scene" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-950/50">
                  <ImageIcon size={32} className="mb-2 opacity-50" />
                  <span className="text-xs">暂无图片</span>
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <button 
                  onClick={() => handleGenerateImage(scene.id)}
                  disabled={scene.status === 'generating_image'}
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-white font-medium flex items-center gap-2 transform active:scale-95 transition-all shadow-lg"
                >
                  {scene.status === 'generating_image' ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                  {scene.imageUrl ? '重新生成' : '生成图片'}
                </button>
              </div>

              {scene.status === 'generating_image' && (
                <div className="absolute top-2 right-2 bg-indigo-600/90 text-white text-[10px] px-2 py-1 rounded-full animate-pulse">
                  生成中...
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono font-bold text-slate-500">场景 {idx + 1}</span>
                <span className="text-[10px] bg-indigo-900/30 border border-indigo-500/30 px-1.5 py-0.5 rounded text-indigo-300">{scene.shotType}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed" title={scene.visualPrompt}>{scene.visualPrompt}</p>
            </div>
          </div>
        ))}
        {(!localProject.scenes || localProject.scenes.length === 0) && (
            <div className="col-span-full py-20 text-center text-slate-500">
                请先生成分镜表，才能在此处查看和生成图片。
            </div>
        )}
      </div>
    </div>
  );

  const CinemaView = () => (
    <div className="h-[calc(100vh-140px)] overflow-y-auto pb-10">
       <div className="mb-6 bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-indigo-500/20 p-6 rounded-xl flex gap-4 items-start shadow-lg">
         <div className="p-3 bg-indigo-500/10 rounded-lg">
            <Film className="text-indigo-400" size={24} />
         </div>
         <div className="flex-1">
            <h4 className="font-semibold text-indigo-100 text-base">影片合成实验室 (Veo 驱动)</h4>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              将静态分镜图转化为动态视频。
              选择下方场景并使用 <strong className="text-slate-300">Veo 3.1</strong> 模型进行制作。
              <br/>
              <span className="text-xs opacity-70 mt-2 block">* 注意：使用 Veo 需要选择付费的 Google Cloud 项目 API Key。每个镜头生成约需 1-2 分钟。</span>
            </p>
         </div>
       </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {localProject.scenes?.filter(s => s.imageUrl).map((scene, idx) => (
          <div key={scene.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex flex-col shadow-xl">
            <div className="aspect-video bg-black relative">
              {scene.videoUrl ? (
                <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
              ) : (
                <img src={scene.imageUrl} className="w-full h-full object-cover opacity-60 grayscale-[30%]" />
              )}
              
              {!scene.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button 
                        onClick={() => handleGenerateVideo(scene.id)}
                        disabled={scene.status === 'generating_video'}
                        className="group relative inline-flex items-center justify-center px-6 py-3 font-bold text-white transition-all duration-200 bg-indigo-600 font-lg rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 hover:bg-indigo-500 active:scale-95"
                    >
                        {scene.status === 'generating_video' ? (
                            <><Loader2 className="animate-spin mr-2" size={20} /> 生成中...</>
                        ) : (
                            <><Play className="mr-2 fill-current" size={20} /> 生成视频</>
                        )}
                        <div className="absolute inset-0 rounded-full ring-4 ring-white/20 group-hover:ring-white/40 transition-all" />
                    </button>
                  </div>
              )}
              
              {scene.status === 'generating_video' && (
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                     <span className="text-xs text-white/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
                        这可能需要一分钟...
                     </span>
                  </div>
              )}
            </div>
            <div className="p-4 bg-slate-800/50 border-t border-slate-800">
               <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold text-slate-500">场景 {idx + 1}</span>
                      <span className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{scene.scriptSegment}</span>
                  </div>
                  {scene.videoUrl && (
                      <a 
                        href={scene.videoUrl} 
                        download={`scene-${idx+1}.mp4`} 
                        target="_blank" 
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                        title="下载视频"
                      >
                          <Download size={20} />
                      </a>
                  )}
               </div>
            </div>
          </div>
        ))}
         {(!localProject.scenes || localProject.scenes.filter(s => s.imageUrl).length === 0) && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-500 border border-slate-800 border-dashed rounded-xl bg-slate-900/50">
                <ImageIcon size={40} className="mb-4 opacity-20" />
                <p>暂无可用图片用于生成视频。</p>
                <button 
                  onClick={() => setActiveTab('visuals')}
                  className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium hover:underline"
                >
                    前往绘图工坊
                </button>
            </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-6 justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors hover:bg-slate-800 p-2 rounded-lg">
            <LayoutGrid size={20} />
          </button>
          <div className="h-6 w-px bg-slate-800" />
          <h2 className="font-semibold text-lg max-w-[200px] truncate">{localProject.name}</h2>
        </div>

        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 overflow-x-auto">
          {[
            { id: 'script', label: '剧本', icon: FileText },
            { id: 'storyboard', label: '分镜表', icon: Clapperboard },
            { id: 'visuals', label: '绘图工坊', icon: ImageIcon },
            { id: 'cinema', label: '影片合成', icon: Film },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-24 flex justify-end">
           <div className="text-xs text-slate-500 flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
             <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
             {loading ? '繁忙' : '就绪'}
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-hidden relative">
        {activeTab === 'script' && <ScriptView />}
        {activeTab === 'storyboard' && <StoryboardView />}
        {activeTab === 'visuals' && <VisualsView />}
        {activeTab === 'cinema' && <CinemaView />}
      </div>
    </div>
  );
};

// 3. Root App
function App() {
  const [view, setView] = useState<'list' | 'workspace'>('list');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Initialize storage if needed
  useEffect(() => {
      try {
        const saved = localStorage.getItem('drama_projects');
        if(!saved) {
            localStorage.setItem('drama_projects', JSON.stringify([]));
        }
      } catch(e) { console.error("Storage init failed", e); }
  }, []);

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `短剧项目 ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
      lastModified: Date.now(),
      script: '',
      scenes: []
    };
    try {
        const savedRaw = localStorage.getItem('drama_projects');
        const saved = savedRaw ? JSON.parse(savedRaw) : [];
        const validSaved = Array.isArray(saved) ? saved : [];
        const updated = [newProject, ...validSaved];
        localStorage.setItem('drama_projects', JSON.stringify(updated));
        setActiveProject(newProject);
        setView('workspace');
    } catch(e) {
        console.error("Create failed", e);
        alert("Could not create project. Check console.");
    }
  };

  const handleUpdateProject = (updated: Project) => {
    try {
        const savedRaw = localStorage.getItem('drama_projects');
        const saved = savedRaw ? JSON.parse(savedRaw) : [];
        if (!Array.isArray(saved)) return;
        
        const index = saved.findIndex((p: Project) => p.id === updated.id);
        if (index !== -1) {
          updated.lastModified = Date.now();
          saved[index] = updated;
          localStorage.setItem('drama_projects', JSON.stringify(saved));
        }
    } catch(e) { console.error("Save failed", e); }
  };

  const handleDeleteProject = (id: string) => {
      try {
        const savedRaw = localStorage.getItem('drama_projects');
        const saved = savedRaw ? JSON.parse(savedRaw) : [];
        if (!Array.isArray(saved)) return;
        
        const filtered = saved.filter((p: Project) => p.id !== id);
        localStorage.setItem('drama_projects', JSON.stringify(filtered));
      } catch(e) { console.error("Delete failed", e); }
  };

  return (
    <ErrorBoundary>
      {view === 'list' && (
        <ProjectList 
          onSelect={(p) => { setActiveProject(p); setView('workspace'); }} 
          onCreate={handleCreateProject}
          onDelete={handleDeleteProject}
        />
      )}
      {view === 'workspace' && activeProject && (
        <Workspace 
          project={activeProject} 
          onBack={() => setView('list')}
          onUpdate={handleUpdateProject}
        />
      )}
    </ErrorBoundary>
  );
}

// Mount the app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}