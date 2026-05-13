import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Puzzle,
  Copy,
  Check,
  ExternalLink,
  FileCode,
  Folder,
  Loader2,
  AlertCircle,
  X,
  Terminal,
  Download,
  BookOpen,
} from "lucide-react";

const GITHUB_REPO = "xinmayoujiang12621/skyplatform-public-skill";
const REPO_URL = `https://github.com/${GITHUB_REPO}`;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "已复制" : label || "复制"}
    </button>
  );
}

function SkillCard({ skill, onClick }) {
  return (
    <button
      onClick={() => onClick(skill)}
      className="w-full text-left bg-white rounded-xl border border-slate-200/80 p-5 hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Puzzle className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
            {skill.meta.name || skill.name}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{skill.meta.description || "无描述"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {skill.meta.trigger && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-xs font-mono text-slate-500 border border-slate-100">
            <Terminal className="w-3 h-3" />
            {skill.meta.trigger}
          </span>
        )}
        {skill.fileCount > 0 && (
          <span className="text-xs text-slate-400">{skill.fileCount} 个文件</span>
        )}
      </div>
    </button>
  );
}

function CodeViewer({ content, filename }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60 border-b border-slate-700/50">
        <span className="text-xs font-mono text-slate-400">{filename}</span>
        <button onClick={handle} className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer">
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="px-4 py-3 text-sm leading-6 text-slate-100 font-mono overflow-x-auto max-h-[500px] overflow-y-auto">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function SkillDetail({ skill, onClose }) {
  const [activeTab, setActiveTab] = useState("docs");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);

  const installCmd = `Download all files from ${REPO_URL}/tree/main/skills/${skill.name} and save to ~/.claude/skills/`;

  // Use pre-built file tree from manifest
  const files = (skill.files || []).filter((f) => !f.path.includes("/"));

  // For source tab, get top-level files from manifest
  const topLevelFiles = (skill.files || []).filter((f) => f.type === "file");

  const loadFile = useCallback(
    (file) => {
      setSelectedFile(file);
      setLoadingFile(true);
      setFileContent("");
      fetch(`${RAW_BASE}/${file.path}`)
        .then((r) => r.text())
        .then((text) => setFileContent(text))
        .catch(() => setFileContent("// 加载失败"))
        .finally(() => setLoadingFile(false));
    },
    []
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Puzzle className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">{skill.meta.name || skill.name}</h2>
              {skill.meta.trigger && <span className="text-xs font-mono text-slate-400">{skill.meta.trigger}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100">
          {[
            { key: "docs", label: "文档", icon: BookOpen },
            { key: "source", label: "源码", icon: Folder },
            { key: "install", label: "安装", icon: Download },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                activeTab === key ? "border-blue-500 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "docs" && (
            <div className="markdown-body">
              {skill.body ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{skill.body}</ReactMarkdown>
              ) : (
                <p className="text-slate-400 text-sm">暂无文档内容</p>
              )}
            </div>
          )}

          {activeTab === "source" && (
            <div className="flex gap-4 min-h-[400px]">
              <div className="w-52 flex-shrink-0 border-r border-slate-100 pr-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">文件列表</p>
                <ul className="space-y-1">
                  {(skill.files || []).length === 0 && <li className="text-xs text-slate-400">无文件</li>}
                  {(skill.files || []).map((f) => (
                    <li key={f.path}>
                      <button
                        onClick={() => f.type === "file" && loadFile(f)}
                        className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          selectedFile?.path === f.path
                            ? "bg-blue-50 text-blue-600 font-medium"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {f.type === "dir" ? <Folder className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <FileCode className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                        <span className="truncate text-xs">{f.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 min-w-0">
                {selectedFile ? (
                  loadingFile ? (
                    <div className="flex items-center justify-center h-40 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />加载中...
                    </div>
                  ) : (
                    <CodeViewer content={fileContent} filename={selectedFile.name} />
                  )
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-400 text-sm">点击左侧文件查看源码</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "install" && (
            <div className="space-y-6 max-w-2xl">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">一键安装命令（推荐）</h3>
                <p className="text-xs text-blue-600 mb-3">在 Claude Code 中直接粘贴以下命令：</p>
                <div className="relative rounded-lg bg-slate-900 p-4">
                  <pre className="text-sm text-slate-100 font-mono pr-20 break-all whitespace-pre-wrap">{installCmd}</pre>
                  <div className="absolute top-3 right-3">
                    <CopyBtn text={installCmd} label="复制命令" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">手动安装</h3>
                <p className="text-xs text-slate-500 mb-3">克隆仓库并复制 Skill 目录：</p>
                <div className="space-y-2">
                  <div className="rounded-lg bg-slate-900 p-3">
                    <pre className="text-xs text-slate-100 font-mono">{`git clone ${REPO_URL}.git /tmp/skyplatform-skills`}</pre>
                  </div>
                  <div className="rounded-lg bg-slate-900 p-3">
                    <pre className="text-xs text-slate-100 font-mono">{`cp -r /tmp/skyplatform-skills/skills/${skill.name} ~/.claude/skills/`}</pre>
                  </div>
                </div>
              </div>

              <a href={`${REPO_URL}/tree/main/skills/${skill.name}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <ExternalLink className="w-4 h-4" />在 GitHub 上查看
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/skills.json")
      .then((r) => {
        if (!r.ok) throw new Error("加载 Skill 清单失败");
        return r.json();
      })
      .then((data) => {
        setSkills(data.skills || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? skills.filter((s) =>
        [s.meta.name, s.meta.description, s.meta.trigger]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(query.toLowerCase()))
      )
    : skills;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200/80 px-5 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Puzzle className="w-5 h-5 text-blue-600" />
          <span>SkyPlatform Skill Store</span>
        </div>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />GitHub
        </a>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Skill 仓库</h1>
          <p className="text-xs text-slate-400 mt-0.5">浏览和安装 Claude Code Skill 扩展</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Skill（名称、描述、触发命令）..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 animate-pulse">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-2/3" />
                    <div className="h-3 bg-slate-50 rounded w-full" />
                  </div>
                </div>
                <div className="h-5 bg-slate-50 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-6 bg-red-50/50 rounded-xl border border-red-100 text-sm text-red-600">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">加载失败</p>
              <p className="text-xs text-red-400 mt-0.5">{error}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Puzzle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">{query ? "未找到匹配的 Skill" : "暂无 Skill"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((skill) => (
              <SkillCard key={skill.name} skill={skill} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && <SkillDetail skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
