type TextPattern = {
  pattern: RegExp;
  replace: (match: RegExpMatchArray) => string;
};

const EXACT_TRANSLATIONS: Record<string, string> = {
  "AI-Video-Stitching-Pipeline": "AI-Video-Stitching-Pipeline",
  "Open Reel": "AI-Video-Stitching-Pipeline",
  "Open Reel Video": "AI-Video-Stitching-Pipeline",
  "From idea to export.": "AI-Video-Stitching-Pipeline",
  "In your browser.": "在浏览器中完成。",

  "AI Stitch": "AI 拼接",
  "AI Generate": "AI 生成",
  Media: "媒体",
  Text: "文字",
  Graphics: "图形",
  Effects: "效果",
  Transitions: "转场",
  Recipes: "配方",
  "Project Templates": "项目模板",
  Project: "项目",
  History: "历史",
  Local: "本地",
  "Local media": "本地素材",
  "Project media": "项目素材",
  "AI Tools": "AI 工具",
  "Back to AI Tools": "返回 AI 工具",
  "AI Stitch Tools": "AI 拼接工具",
  "Recover clip order and automate assisted edits":
    "恢复片段顺序并自动执行辅助剪辑",
  "AI STITCHING": "AI 拼接",
  "AI Stitching": "AI 拼接",
  "CONTENT GENERATION": "内容生成",
  "Content Generation": "内容生成",
  "TEMPLATES & PRESETS": "模板和预设",
  "Templates & Presets": "模板和预设",
  "MEDIA LIBRARY": "媒体库",
  "Media Library": "媒体库",
  TOOLS: "工具",
  Tools: "工具",
  "Text to Speech": "文本转语音",
  "Generate natural voiceovers from text": "从文字生成自然旁白",
  "Auto Captions": "自动字幕",
  "Automatically generate subtitles from audio": "从音频自动生成字幕",
  "Build a 7-slot car sales pitch timeline":
    "构建 7 槽位汽车销售介绍时间线",
  "Recover continuous-source clip order": "恢复连续源视频片段顺序",
  "Start with pre-built project structures": "使用预建项目结构开始",
  "Filter Presets": "滤镜预设",
  "Apply cinematic color grades instantly": "快速应用电影感调色",
  "Music & Sound Effects": "音乐和音效",
  "Browse royalty-free audio for your projects": "浏览可用于项目的免版税音频",
  "Multi-Camera Editing": "多机位剪辑",
  "Sync and switch between multiple angles": "同步并切换多个机位",
  "More AI features coming soon — image generation, auto-edit, and more":
    "更多 AI 功能即将上线：图片生成、自动剪辑等",

  "Recover clip order and run assisted editing tools.":
    "恢复片段顺序并运行辅助剪辑工具。",
  "Import footage, audio, and stills.": "导入视频、音频和图片素材。",
  "Add title presets and caption elements.": "添加标题预设和字幕元素。",
  "Create shapes, arrows, and SVG overlays.": "创建形状、箭头和 SVG 叠加层。",
  "Drag effects onto a clip to apply them.": "将效果拖到片段上即可应用。",
  "Drag transitions onto a clip's edge.": "将转场拖到片段边缘即可应用。",
  "Apply clip-scoped looks, overlays, and text stacks.":
    "应用片段级样式、叠加层和文字组合。",
  "Load full-project starter layouts and presets.":
    "加载完整项目起始布局和预设。",

  "Search media": "搜索素材",
  "No media imported": "未导入素材",
  "Drag files here or click to import": "将文件拖到此处，或点击导入",
  "Import Media": "导入素材",
  "Import media": "导入素材",
  Import: "导入",
  "Add media": "添加媒体",
  "Add to timeline": "添加到时间线",
  "Add to Timeline": "添加到时间线",
  "Create with KieAI": "使用 KieAI 创建",
  "Generation failed — click to retry": "生成失败，点击重试",
  "KieAI generation in progress…": "KieAI 生成中…",
  "Retry generation": "重试生成",
  Generating: "生成中",
  "Generating…": "生成中…",
  "Replace asset": "替换素材",
  Delete: "删除",
  Failed: "失败",
  Missing: "缺失",
  "Large icons": "大图标",
  "Small icons": "小图标",
  "List view": "列表视图",
  "Show Only Missing Assets": "只显示缺失素材",
  "Relink from Folder…": "从文件夹重新关联…",
  "Folder picker not supported": "当前浏览器不支持选择文件夹",
  "Please relink assets individually using the refresh button on each missing asset.":
    "请使用每个缺失素材上的刷新按钮逐个重新关联。",
  "No matches found": "未找到匹配文件",
  "None of the files in the selected folder matched the missing assets by filename.":
    "所选文件夹中没有文件名匹配缺失素材。",
  "Unsaved audio discarded": "未保存音频已丢弃",
  "Save to media or download next time to keep it.":
    "下次请保存到媒体库或下载，以保留该音频。",
  "Asset not found": "未找到素材",
  "Cannot load the image data for this asset.": "无法加载该素材的图片数据。",
  "Failed to open KieAI": "打开 KieAI 失败",
  "Unknown error": "未知错误",
  "Wrong media type": "媒体类型错误",
  "Import failed": "导入失败",
  "Could not import media.": "无法导入媒体。",
  "Imported type mismatch": "导入类型不匹配",
  "The imported media could not be found in the library.":
    "在媒体库中找不到刚导入的素材。",
  "Media added": "媒体已添加",

  "Stitching Templates": "拼接模板",
  "Car sales pitch template: 3 AI videos, 2 user videos, and 2 AI audio clips. Later these AI slots can be filled by API responses. User video segments are time-stretched to match their paired AI narration audio.":
    "汽车销售介绍模板：3 个 AI 视频、2 个用户视频和 2 段 AI 音频。后续这些 AI 槽位可通过 API 响应自动填充。用户视频片段会按匹配的 AI 旁白音频进行变速对齐。",
  "Sales pitch timeline template": "销售介绍时间线模板",
  "AI opening video": "AI 开场视频",
  "AI middle video": "AI 中段视频",
  "AI closing video": "AI 收尾视频",
  "User walk-around video 1": "用户绕车视频 1",
  "User walk-around video 2": "用户绕车视频 2",
  "AI narration audio 1": "AI 旁白音频 1",
  "AI narration audio 2": "AI 旁白音频 2",
  "AI Video 1": "AI 视频 1",
  "AI Video 2": "AI 视频 2",
  "AI Video 3": "AI 视频 3",
  "User Video 1": "用户视频 1",
  "User Video 2": "用户视频 2",
  "AI Audio 1": "AI 音频 1",
  "AI Audio 2": "AI 音频 2",
  "Optional background music": "可选背景音乐",
  "Optional background music fitted to the full appended video length":
    "可选背景音乐，会适配完整拼接视频时长",
  "Optional music bed": "可选背景音乐",
  BGM: "背景音乐",
  "Video 1": "视频 1",
  "Audio 1": "音频 1",
  "Background Music": "背景音乐",
  "Trim last 2 frames from AI videos": "裁掉 AI 视频最后 2 帧",
  "Removes possible unfinished AI-model tail frames. User videos and audio clips are not shortened.":
    "用于去除 AI 模型可能生成的未完成尾帧。用户视频和音频片段不会被缩短。",
  "Apply Volume Leveling to all timeline audio":
    "对整条时间线音频执行音量均衡",
  "Balances sudden loud and quiet sections across all unmuted video/audio clips before timeline loudness matching.":
    "在时间线响度匹配前，均衡所有未静音视频/音频片段中的突然过响和过轻部分。",
  "Apply Sales Pitch Template": "应用销售介绍模板",
  "Applying Template": "正在应用模板",
  "Template incomplete": "模板未填写完整",
  "Add media to all 7 template slots first.": "请先为 7 个模板槽位全部添加素材。",
  "Stitching template applied": "拼接模板已应用",
  "Template application failed": "应用模板失败",
  "Could not apply the sales pitch template.": "无法应用销售介绍模板。",
  "Could not apply the stitching template.": "无法应用拼接模板。",
  "Volume leveling applied": "音量均衡已应用",
  "Volume leveling partially applied": "音量均衡已部分应用",
  "Volume leveling skipped": "已跳过音量均衡",
  "Volume leveling unavailable": "音量均衡不可用",
  "Timeline audio could not be balanced, so loudness matching will continue.":
    "时间线音频无法完成均衡，将继续进行响度匹配。",
  "Could not run volume leveling.": "无法运行音量均衡。",
  "Loudness matching will continue.": "将继续进行响度匹配。",
  "Video clips were appended": "视频片段已顺序拼接",
  "user videos were fitted to their matching AI audio":
    "用户视频已适配对应 AI 音频时长",
  "AI videos were trimmed by 2 frames": "AI 视频已裁掉 2 帧",
  "BGM was fitted to the video length": "背景音乐已适配视频总时长",
  "timeline volume leveling is starting": "正在开始时间线音量均衡",
  "loudness matching will follow": "随后将进行响度匹配",

  "AI Clip Ordering": "AI 片段排序",
  "Reconstructs continuous-source clip order by matching each clip's last frame to another clip's first frame. Supports up to 8 clips.":
    "通过匹配片段边界帧，重建同一连续源视频的片段顺序。最多支持 8 个片段。",
  "Select clips to order": "选择要排序的片段",
  "All video clips": "全部视频片段",
  "Some selected": "已选择部分",
  "Choose any clip combination. Best for continuous-source reconstruction, up to 8 clips.":
    "可选择任意片段组合。适合同一连续源视频重建，最多 8 个片段。",
  "Add at least two local video clips first.": "请先添加至少两个本地视频片段。",
  "Run AI Clip Ordering": "运行 AI 片段排序",
  "Ordering result": "排序结果",
  "No video clips found": "未找到视频片段",
  "Need more clips": "片段数量不足",
  "Select at least two local video clips.": "请选择至少两个本地视频片段。",
  "Too many clips": "片段过多",
  "AI Clip Ordering currently supports up to 8 clips.":
    "AI 片段排序目前最多支持 8 个片段。",
  "AI Clip Ordering needs at least two selected local video clips.":
    "AI 片段排序需要至少选择两个本地视频片段。",
  "Extracting boundary frames...": "正在提取边界帧...",
  "Applying predicted order...": "正在应用预测顺序...",
  "Clip order applied": "片段顺序已应用",
  "AI Clip Ordering applied": "AI 片段排序已应用",
  "AI Clip Ordering failed": "AI 片段排序失败",
  "Could not order clips.": "无法对片段排序。",
  "Some selected clips changed while AI Clip Ordering was running. Please run it again.":
    "AI 片段排序运行期间部分已选片段发生变化，请重新运行。",
  "No destination video track found for clip ordering.":
    "未找到用于应用排序结果的视频轨道。",

  Canvas: "画布",
  Ready: "就绪",
  "Back to home": "返回首页",
  Notifications: "通知",
  "Auto saved:": "已自动保存：",
  "Initializing editor…": "正在初始化编辑器…",
  "Starting...": "正在启动...",
  "Initializing video engine...": "正在初始化视频引擎...",
  "Initializing media bridge...": "正在初始化媒体桥接...",
  "Initializing playback bridge...": "正在初始化播放桥接...",
  "Initializing render bridge...": "正在初始化渲染桥接...",
  "Initializing effects bridge...": "正在初始化效果桥接...",
  "Initializing transition bridge...": "正在初始化转场桥接...",
  "Engine initialization failed": "引擎初始化失败",
  "Failed to initialize engines/bridges:": "初始化引擎/桥接失败：",

  "No selection": "未选择",
  "Select a clip to view its properties": "选择一个片段以查看属性",
  Player: "播放器",
  Transform: "变换",
  Color: "颜色",
  Audio: "音频",
  Speed: "速度",
  Animate: "动画",
  Style: "样式",
  "Position X": "位置 X",
  "Position Y": "位置 Y",
  "Scale X": "缩放 X",
  "Scale Y": "缩放 Y",
  Scale: "缩放",
  Position: "位置",
  Rotation: "旋转",
  Opacity: "不透明度",
  "Border Radius": "圆角",
  "Fit Mode": "适配模式",
  Fill: "填充",
  Fit: "适配",
  Crop: "裁剪",
  "Reset attributes": "重置属性",
  Reset: "重置",
  "3D Transforms": "3D 变换",
  "Color Grading": "调色",
  Applied: "已应用",
  "Key Color": "键控颜色",
  "Speed & Direction": "速度与方向",
  "Speed Curves": "速度曲线",

  "Volume Leveling": "音量均衡",
  "Loudness Matching": "响度匹配",
  "Auto Cut Silence": "自动裁剪静音",
  "Background Noise Removal": "背景噪声移除",
  "Audio Effects": "音频效果",
  "Audio Ducking": "音频闪避",
  "LUFS loudness matching": "LUFS 响度匹配",
  "One-click narration matching using Broadcast (-23.0 LUFS), -1.0 dBTP.":
    "一键按广播标准匹配旁白（-23.0 LUFS，-1.0 dBTP）。",
  "Advanced Options": "高级选项",
  Analyze: "分析",
  "Match loudness": "匹配响度",
  Selected: "已选片段",
  Timeline: "时间线",
  "Target preset": "目标预设",
  "Custom target": "自定义目标",
  "True-peak ceiling": "真峰值上限",
  "Speech / narration (-16 LUFS)": "语音/旁白（-16 LUFS）",
  "Broadcast (-23 LUFS)": "广播（-23 LUFS）",
  "Music streaming (-14 LUFS)": "音乐流媒体（-14 LUFS）",
  "Run Volume Leveling": "运行音量均衡",
  "Apply volume leveling": "应用音量均衡",
  "Analyze audio": "分析音频",
  "Original": "原始",
  "Processed": "处理后",

  "Video Clip": "视频片段",
  "Audio Clip": "音频片段",
  "Image Clip": "图片片段",
  Clip: "片段",
  "Copy Clip": "复制片段",
  Duplicate: "复制副本",
  "Split at Playhead": "在播放头处分割",
  "Close Gap to Previous": "向前闭合空隙",
  "Copy Effects": "复制效果",
  "Paste Effects": "粘贴效果",
  "Separate Audio": "分离音频",
  "Copy Audio Effects": "复制音频效果",
  "Paste Audio Effects": "粘贴音频效果",
  "Ripple Delete": "波纹删除",
  "No audio": "无音频",
  "Select a clip with keyframes to edit": "选择带关键帧的片段进行编辑",
  "Keyframe Editor": "关键帧编辑器",
  "Audio Mixer": "音频混音器",
  "Audio Mixing Console": "音频混音台",
  "Live preview": "实时预览",
  "Rendering with WEBGPU": "使用 WEBGPU 渲染",
  "Skip back 5s": "后退 5 秒",
  Play: "播放",
  Pause: "暂停",
  "Skip forward 5s": "前进 5 秒",
  Mute: "静音",
  Unmute: "取消静音",
  "Preview Zoom": "预览缩放",
  "Zoom out": "缩小",
  "Zoom in": "放大",
  "Full Screen": "全屏",
  "Exit Full Screen": "退出全屏",
  "Maximize Preview": "最大化预览",
  "Minimize Preview": "还原预览",
  "Undo (⌘Z)": "撤销（⌘Z）",
  "Redo (⇧⌘Z)": "重做（⇧⌘Z）",
  "Split (S)": "分割（S）",
  "Delete (Del)": "删除（Del）",
  "Add track": "添加轨道",
  "Manage track layers": "管理轨道层",
  "Snap on (N)": "吸附开启（N）",
  "Snap off (N)": "吸附关闭（N）",
  "Large tracks": "大轨道",
  "Compact tracks": "紧凑轨道",
  "Maximize timeline (more room)": "最大化时间线",
  "Restore timeline": "还原时间线",

  Undo: "撤销",
  Redo: "重做",
  Search: "搜索",
  "Sync cloud": "同步云端",
  "Load local": "加载本地",
  Export: "导出",
  "Export Video": "导出视频",
  "Export Audio": "导出音频",
  "Export Project": "导出项目",
  "Export Settings": "导出设置",
  Presets: "预设",
  Custom: "自定义",
  Recommended: "推荐",
  Platform: "平台",
  Format: "格式",
  Codec: "编码",
  Resolution: "分辨率",
  "Frame Rate": "帧率",
  Bitrate: "码率",
  Quality: "质量",
  "Audio Settings": "音频设置",
  Cancel: "取消",
  Save: "保存",
  Close: "关闭",
  "Complete!": "完成！",
  "Saved!": "已保存！",
  "Export failed": "导出失败",
  "Initializing...": "正在初始化...",
  "Media file": "媒体文件",
  "Estimated time": "预计耗时",
  "Run Benchmark": "运行性能测试",
  "Device Performance": "设备性能",

  Settings: "设置",
  General: "通用",
  "API Keys": "API 密钥",
  "Configure preferences and manage API keys for external services.":
    "配置偏好设置并管理外部服务的 API 密钥。",
  "Default AI Providers": "默认 AI 服务提供商",
  "Choose which service to use by default for AI features.":
    "选择 AI 功能默认使用的服务。",
  "Text to Speech/Voice To Speech/Sound Effects":
    "文本转语音/语音转换/音效",
  "AI Assistant (LLM)": "AI 助手（大语言模型）",
  "AI Aggregator": "AI 聚合服务",
  "Video/image generation, upscaling, and creative AI tools":
    "视频/图片生成、超分辨率和创意 AI 工具",
  "Piper (Hosted demo)": "Piper（托管演示）",
  OpenAI: "OpenAI",

  "Start from Scratch": "从空白项目开始",
  "Pick a format and start creating. You can change this anytime.":
    "选择画幅并开始创作。之后可以随时更改。",
  "Start creating": "开始创作",
  "Browse templates": "浏览模板",
  Templates: "模板",
  Back: "返回",
  "Open editor": "打开编辑器",
  "Skip on startup": "启动时跳过",
  "Press Esc to skip": "按 Esc 跳过",
  "Loading editor...": "正在加载编辑器...",
  "Project Name": "项目名称",
  "My Awesome Video": "我的精彩视频",
  "Select Format": "选择格式",
  "Vertical (9:16)": "竖屏（9:16）",
  "Square (1:1)": "方形（1:1）",
  "Horizontal (16:9)": "横屏（16:9）",
  Other: "其他",
  "New Project": "新建项目",
  "New Vertical Video": "新建竖屏视频",
  "New Horizontal Video": "新建横屏视频",
  "New Square Video": "新建方形视频",
  Creating: "正在创建",
  "Creating...": "正在创建...",
  "Create Project": "创建项目",
  "Recent Projects": "最近项目",
  "Recent projects": "最近项目",
  "Template Gallery": "模板库",
  "Choose an aspect ratio": "选择画面比例",
  Vertical: "竖屏",
  Horizontal: "横屏",
  Square: "方形",
  "Mobile Blocked": "移动端暂不可用",
  "Please use a desktop browser for the editor.": "请使用桌面浏览器打开编辑器。",
};

const PATTERN_TRANSLATIONS: TextPattern[] = [
  {
    pattern: /^Auto saved:\s*(.+)$/u,
    replace: (match) => `已自动保存：${match[1]}`,
  },
  {
    pattern: /^(\d+)\/7 filled$/u,
    replace: (match) => `已填写 ${match[1]}/7`,
  },
  {
    pattern: /^(\d+)\/(\d+) selected$/u,
    replace: (match) => `已选择 ${match[1]}/${match[2]}`,
  },
  {
    pattern: /^(\d+) clips$/u,
    replace: (match) => `${match[1]} 个片段`,
  },
  {
    pattern: /^(\d+) clip$/u,
    replace: (match) => `${match[1]} 个片段`,
  },
  {
    pattern: /^Importing (.+) \((\d+)\/(\d+)\)\.\.\.$/u,
    replace: (match) => `正在导入 ${match[1]}（${match[2]}/${match[3]}）...`,
  },
  {
    pattern: /^Extracting audio from (.+)\.\.\.$/u,
    replace: (match) => `正在从 ${match[1]} 提取音频...`,
  },
  {
    pattern: /^Replacing asset\.\.\.$/u,
    replace: () => "正在替换素材...",
  },
  {
    pattern: /^Relinking (.+)…$/u,
    replace: (match) => `正在重新关联 ${match[1]}…`,
  },
  {
    pattern: /^Relinked (\d+) of (\d+) assets?$/u,
    replace: (match) => `已重新关联 ${match[1]}/${match[2]} 个素材`,
  },
  {
    pattern: /^(.+) assigned to (.+)\.$/u,
    replace: (match) => `${match[1]} 已分配到 ${translateUiText(match[2])}。`,
  },
  {
    pattern: /^(.+) expects a (video|audio) file\.$/u,
    replace: (match) =>
      `${translateUiText(match[1])} 需要一个${match[2] === "video" ? "视频" : "音频"}文件。`,
  },
  {
    pattern: /^(.+) is missing media\.$/u,
    replace: (match) => `${translateUiText(match[1])} 缺少媒体。`,
  },
  {
    pattern: /^(\d+) selected clips reordered with (.+)% confidence\.$/u,
    replace: (match) =>
      `已重新排序 ${match[1]} 个已选片段，置信度 ${match[2]}%。`,
  },
  {
    pattern: /^Missing clip (.+) while applying clip ordering\.$/u,
    replace: (match) => `应用片段排序时缺少片段 ${match[1]}。`,
  },
  {
    pattern: /^Clip (.+) has no linked media item and will be ignored\.$/u,
    replace: (match) => `片段 ${match[1]} 没有关联媒体，将被忽略。`,
  },
  {
    pattern: /^(.+) is not a video clip and will be ignored\.$/u,
    replace: (match) => `${match[1]} 不是视频片段，将被忽略。`,
  },
  {
    pattern: /^(.+) is missing local video data and will be ignored\.$/u,
    replace: (match) => `${match[1]} 缺少本地视频数据，将被忽略。`,
  },
  {
    pattern: /^(\d+) timeline audio clips? balanced before loudness matching\.$/u,
    replace: (match) => `已在响度匹配前均衡 ${match[1]} 个时间线音频片段。`,
  },
  {
    pattern: /^(\d+) clips? balanced; (\d+) skipped\. Loudness matching will continue\.$/u,
    replace: (match) =>
      `已均衡 ${match[1]} 个片段，跳过 ${match[2]} 个。将继续进行响度匹配。`,
  },
  {
    pattern: /^(.+) Loudness matching will continue\.$/u,
    replace: (match) => `${match[1]} 将继续进行响度匹配。`,
  },
];

const TRANSLATABLE_ATTRIBUTES = [
  "aria-label",
  "alt",
  "placeholder",
  "title",
] as const;

let observer: MutationObserver | null = null;
let translating = false;

export function translateUiText(value: string): string {
  const trimmed = value.replace(/\s+/gu, " ").trim();
  if (!trimmed) return value;

  const exact = EXACT_TRANSLATIONS[trimmed];
  if (exact) {
    return value.replace(trimmed, exact);
  }

  for (const { pattern, replace } of PATTERN_TRANSLATIONS) {
    const match = trimmed.match(pattern);
    if (match) {
      return value.replace(trimmed, replace(match));
    }
  }

  return value;
}

export function installChineseUiLocalization(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (observer) return;

  document.documentElement.lang = "zh-CN";
  document.title = "AI-Video-Stitching-Pipeline";

  const translateTree = (root: Node) => {
    if (translating) return;
    translating = true;
    try {
      translateNode(root);
    } finally {
      translating = false;
    }
  };

  translateTree(document.body);

  observer = new MutationObserver((mutations) => {
    if (translating) return;

    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        translateTree(mutation.target);
        continue;
      }
      if (mutation.type === "attributes") {
        translateTree(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        translateTree(node);
      }
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    childList: true,
    characterData: true,
    subtree: true,
  });
}

function translateNode(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }

  if (!(root instanceof Element)) return;
  if (shouldSkipElement(root)) return;

  translateElementAttributes(root);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return shouldSkipTextNode(node.parentElement)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
        if (node instanceof Element) {
          return shouldSkipElement(node)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text);
    } else if (current instanceof Element) {
      translateElementAttributes(current);
    }
    current = walker.nextNode();
  }
}

function translateTextNode(textNode: Text): void {
  const current = textNode.nodeValue ?? "";
  const next = translateUiText(current);
  if (next !== current) {
    textNode.nodeValue = next;
  }
}

function translateElementAttributes(element: Element): void {
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const value = element.getAttribute(attribute);
    if (!value) continue;
    const next = translateUiText(value);
    if (next !== value) {
      element.setAttribute(attribute, next);
    }
  }
}

function shouldSkipElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "script" ||
    tagName === "style" ||
    tagName === "noscript" ||
    element.getAttribute("contenteditable") === "true"
  );
}

function shouldSkipTextNode(parent: Element | null): boolean {
  if (!parent) return false;
  const tagName = parent.tagName.toLowerCase();
  return (
    shouldSkipElement(parent) ||
    tagName === "input" ||
    tagName === "textarea"
  );
}
