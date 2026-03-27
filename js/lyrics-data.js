/**
 * Six Little Ducks - 歌词数据文件
 * 时间戳由 Whisper AI 从巴塔木视频 (MP4) 音轨精确提取
 * 歌曲总时长 ~95.6 秒 (1:35)
 * 
 * 歌曲结构: Intro → V1 → Chorus1 → Bridge1 → V2 → Chorus2 → Bridge2 → V3 → Chorus3 → Outro
 * 每段编排: 2人领唱(2句) → 同2人继续唱(2句) → 全员合唱(2句) — "2-2-合"模式
 */

// 6只鸭子角色配置 - 每只鸭子有独特的颜色、名称和SVG形象
const DUCK_ROLES = {
  duck1: { name: "Duck 1", color: "#FF6B6B", label: "红鸭", hatColor: "#FF3333", bodyColor: "#FF6B6B" },
  duck2: { name: "Duck 2", color: "#4ECDC4", label: "青鸭", hatColor: "#2DB5AC", bodyColor: "#4ECDC4" },
  duck3: { name: "Duck 3", color: "#45B7D1", label: "蓝鸭", hatColor: "#2A9BBF", bodyColor: "#45B7D1" },
  duck4: { name: "Duck 4", color: "#96CEB4", label: "绿鸭", hatColor: "#6BB896", bodyColor: "#96CEB4" },
  duck5: { name: "Duck 5", color: "#FFEAA7", label: "黄鸭", hatColor: "#FFD93D", bodyColor: "#FFEAA7" },
  duck6: { name: "Duck 6", color: "#DDA0DD", label: "紫鸭", hatColor: "#CC70CC", bodyColor: "#DDA0DD" },
};

// 全员标识
const ALL_DUCKS = ["duck1", "duck2", "duck3", "duck4", "duck5", "duck6"];

/**
 * 队形模板 - 6只鸭子在舞台上的位置坐标
 * 坐标系: x(0-100 左到右), y(0-100 后到前)
 * 每个鸭子位置: { x, y, highlight: boolean }
 */
const FORMATIONS = {
  // 初始队形：两排三角形
  initial: {
    name: "初始队形",
    desc: "两排站位，前3后3",
    positions: {
      duck1: { x: 25, y: 65 }, duck2: { x: 50, y: 65 }, duck3: { x: 75, y: 65 },
      duck4: { x: 20, y: 35 }, duck5: { x: 50, y: 35 }, duck6: { x: 80, y: 35 }
    }
  },
  // V1领唱：duck1+duck2前移居中
  verse1Lead: {
    name: "V1 领唱",
    desc: "红鸭+青鸭前移领唱",
    positions: {
      duck1: { x: 35, y: 80 }, duck2: { x: 65, y: 80 }, duck3: { x: 80, y: 40 },
      duck4: { x: 20, y: 40 }, duck5: { x: 35, y: 25 }, duck6: { x: 65, y: 25 }
    }
  },
  // V1独唱：duck1 C位
  verse1Solo: {
    name: "V1 独唱",
    desc: "红鸭C位独唱",
    positions: {
      duck1: { x: 50, y: 85 }, duck2: { x: 75, y: 55 }, duck3: { x: 85, y: 35 },
      duck4: { x: 15, y: 35 }, duck5: { x: 25, y: 55 }, duck6: { x: 50, y: 25 }
    }
  },
  // 合唱：一字排开
  chorusLine: {
    name: "合唱队形",
    desc: "全员一字排开合唱",
    positions: {
      duck1: { x: 10, y: 55 }, duck2: { x: 28, y: 55 }, duck3: { x: 46, y: 55 },
      duck4: { x: 64, y: 55 }, duck5: { x: 82, y: 55 }, duck6: { x: 95, y: 55 }
    }
  },
  // Wibble摇摆：圆形散开
  wibbleCircle: {
    name: "摇摆队形",
    desc: "全员圆圈摇摆",
    positions: {
      duck1: { x: 50, y: 80 }, duck2: { x: 80, y: 65 }, duck3: { x: 80, y: 35 },
      duck4: { x: 50, y: 20 }, duck5: { x: 20, y: 35 }, duck6: { x: 20, y: 65 }
    }
  },
  // V2领唱：duck3+duck4前移
  verse2Lead: {
    name: "V2 领唱",
    desc: "蓝鸭+绿鸭前移领唱",
    positions: {
      duck3: { x: 35, y: 80 }, duck4: { x: 65, y: 80 }, duck1: { x: 20, y: 40 },
      duck2: { x: 80, y: 40 }, duck5: { x: 35, y: 25 }, duck6: { x: 65, y: 25 }
    }
  },
  // V2独唱：duck3 C位
  verse2Solo: {
    name: "V2 独唱",
    desc: "蓝鸭C位独唱",
    positions: {
      duck3: { x: 50, y: 85 }, duck4: { x: 75, y: 55 }, duck1: { x: 15, y: 35 },
      duck2: { x: 85, y: 35 }, duck5: { x: 25, y: 55 }, duck6: { x: 50, y: 25 }
    }
  },
  // V3领唱：duck5+duck6前移
  verse3Lead: {
    name: "V3 领唱",
    desc: "黄鸭+紫鸭前移领唱",
    positions: {
      duck5: { x: 35, y: 80 }, duck6: { x: 65, y: 80 }, duck1: { x: 20, y: 40 },
      duck2: { x: 80, y: 40 }, duck3: { x: 35, y: 25 }, duck4: { x: 65, y: 25 }
    }
  },
  // V3独唱：duck5 C位
  verse3Solo: {
    name: "V3 独唱",
    desc: "黄鸭C位独唱",
    positions: {
      duck5: { x: 50, y: 85 }, duck6: { x: 75, y: 55 }, duck1: { x: 15, y: 35 },
      duck2: { x: 85, y: 35 }, duck3: { x: 25, y: 55 }, duck4: { x: 50, y: 25 }
    }
  },
  // Finale大合唱：V字形
  finale: {
    name: "大合唱",
    desc: "全员V字形大合唱",
    positions: {
      duck1: { x: 15, y: 30 }, duck2: { x: 30, y: 50 }, duck3: { x: 45, y: 70 },
      duck4: { x: 55, y: 70 }, duck5: { x: 70, y: 50 }, duck6: { x: 85, y: 30 }
    }
  },
  // Outro谢幕：一排鞠躬
  outro: {
    name: "谢幕",
    desc: "全员一排鞠躬谢幕",
    positions: {
      duck1: { x: 10, y: 60 }, duck2: { x: 28, y: 60 }, duck3: { x: 46, y: 60 },
      duck4: { x: 64, y: 60 }, duck5: { x: 82, y: 60 }, duck6: { x: 95, y: 60 }
    }
  }
};

/**
 * 歌词时间轴数据 - Whisper AI 精确提取
 * 每行包含: startTime, endTime, text, singers, type, section, action, formation
 * action: 当前时段的舞蹈动作描述
 * formation: 对应的队形模板key
 */
const LYRICS_DATA = [
  // === 前奏 (0:00 - 6.24) ===
  { startTime: 0.0, endTime: 2.68, text: "Look! There's little ducks!", singers: [], type: "intro", section: "Intro",
    action: "🎭 全员就位，微笑面向观众", formation: "initial" },
  { startTime: 2.68, endTime: 6.24, text: "♪ ♪ ♪", singers: [], type: "intro", section: "Intro",
    action: "🎭 全员准备，双手放身侧", formation: "initial" },

  // === 第一段 (Verse 1) - Duck 1 & Duck 2 主唱 ===
  { startTime: 6.24, endTime: 9.50, text: "Six little ducks that I once knew,", singers: ["duck1", "duck2"], type: "verse", section: "Verse 1",
    action: "🚶 红鸭+青鸭前移两步，其余原地轻摆", formation: "verse1Lead" },
  { startTime: 10.00, endTime: 12.64, text: "Fat ones, skinny ones, fair ones too.", singers: ["duck1", "duck2"], type: "verse", section: "Verse 1",
    action: "🙌 红鸭+青鸭双手张开比大小，左右摇摆", formation: "verse1Lead" },
  { startTime: 12.68, endTime: 16.34, text: "But the one little duck with the feather on his back,", singers: ["duck1", "duck2"], type: "verse", section: "Verse 1",
    action: "☝️ 红鸭+青鸭一起唱，手指向上指天", formation: "verse1Lead" },
  { startTime: 16.90, endTime: 20.00, text: "He led the others with a quack, quack, quack.", singers: ["duck1", "duck2"], type: "verse", section: "Verse 1",
    action: "🦆 红鸭+青鸭一起做嘎嘎手势（手掌开合），带领大家", formation: "verse1Lead" },
  { startTime: 20.18, endTime: 23.38, text: "Quack, quack, quack. Quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 1",
    action: "👏 全员拍手+嘎嘎手势，节奏一致", formation: "chorusLine" },
  { startTime: 23.70, endTime: 26.82, text: "He led the others with a quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 1",
    action: "🎵 全员一字排开，齐做嘎嘎手势", formation: "chorusLine" },

  // === 过渡 Bridge 1 ===
  { startTime: 28.12, endTime: 30.00, text: "Here we go!", singers: ALL_DUCKS, type: "bridge", section: "Bridge 1",
    action: "💃 全员欢呼，准备下一段", formation: "wibbleCircle" },

  // === 第二段 (Verse 2) - Duck 3 & Duck 4 主唱 ===
  { startTime: 30.92, endTime: 33.74, text: "Down to the river they would go.", singers: ["duck3", "duck4"], type: "verse", section: "Verse 2",
    action: "🚶 蓝鸭+绿鸭前移领唱，做走路动作", formation: "verse2Lead" },
  { startTime: 34.26, endTime: 37.04, text: "Wibble wobble, wibble wobble, to and fro.", singers: ["duck3", "duck4"], type: "verse", section: "Verse 2",
    action: "💃 蓝鸭+绿鸭摇摆，其余轻摆配合", formation: "verse2Lead" },
  { startTime: 37.10, endTime: 40.76, text: "But the one little duck with the feather on his back,", singers: ["duck3", "duck4"], type: "verse", section: "Verse 2",
    action: "☝️ 蓝鸭+绿鸭一起唱，手摸背部「羽毛」", formation: "verse2Lead" },
  { startTime: 41.52, endTime: 44.30, text: "He led the others with a quack, quack, quack.", singers: ["duck3", "duck4"], type: "verse", section: "Verse 2",
    action: "🦆 蓝鸭+绿鸭一起做嘎嘎手势领唱", formation: "verse2Lead" },
  { startTime: 44.46, endTime: 47.70, text: "Quack, quack, quack. Quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 2",
    action: "👏 全员拍手+嘎嘎手势", formation: "chorusLine" },
  { startTime: 47.96, endTime: 50.82, text: "He led the others with a quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 2",
    action: "🎵 全员齐做嘎嘎手势", formation: "chorusLine" },

  // === 间奏 Bridge 2 (50.82 - 54.58) ===
  { startTime: 50.82, endTime: 54.58, text: "♪ ♪ ♪", singers: [], type: "bridge", section: "Bridge 2",
    action: "💃 全员大幅摇摆走圆圈，欢快跳动", formation: "wibbleCircle" },

  // === 第三段 (Verse 3) - Duck 5 & Duck 6 主唱 ===
  { startTime: 54.58, endTime: 58.30, text: "Home by the river they would come.", singers: ["duck5", "duck6"], type: "verse", section: "Verse 3",
    action: "🏠 黄鸭+紫鸭前移领唱，做回家手势", formation: "verse3Lead" },
  { startTime: 58.50, endTime: 61.38, text: "Wibble wobble, wibble wobble, ho hum hum.", singers: ["duck5", "duck6"], type: "verse", section: "Verse 3",
    action: "💃 黄鸭+紫鸭摇摆+点头", formation: "verse3Lead" },
  { startTime: 61.38, endTime: 65.04, text: "But the one little duck with the feather on his back,", singers: ["duck5", "duck6"], type: "verse", section: "Verse 3",
    action: "☝️ 黄鸭+紫鸭一起唱，做展翅动作", formation: "verse3Lead" },
  { startTime: 65.62, endTime: 68.26, text: "He led the others with a quack, quack, quack.", singers: ["duck5", "duck6"], type: "verse", section: "Verse 3",
    action: "🦆 黄鸭+紫鸭一起做嘎嘎手势领唱", formation: "verse3Lead" },
  { startTime: 68.68, endTime: 72.02, text: "Quack, quack, quack. Quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 3",
    action: "👏 全员拍手+嘎嘎手势", formation: "chorusLine" },
  { startTime: 72.30, endTime: 76.20, text: "He led the others with a quack, quack, quack.", singers: ALL_DUCKS, type: "chorus", section: "Verse 3",
    action: "🎵 全员齐做嘎嘎手势", formation: "finale" },

  // === 尾声 ===
  { startTime: 77.62, endTime: 78.96, text: "Quack, quack, quack.", singers: ALL_DUCKS, type: "outro", section: "Outro",
    action: "🌟 全员最后齐唱嘎嘎嘎！", formation: "finale" },

  // === 结尾彩蛋 ===
  { startTime: 82.16, endTime: 83.56, text: "Meow! 🐱", singers: [], type: "outro", section: "Outro",
    action: "🙇 全员一排鞠躬谢幕！", formation: "outro" },
];

/**
 * 生成鸭子SVG - 每只鸭子有独特的配饰
 * @param {string} roleKey - duck1~duck6
 * @param {number} size - SVG尺寸
 * @returns {string} SVG HTML字符串
 */
function createDuckSVG(roleKey, size = 60) {
  const role = DUCK_ROLES[roleKey];
  if (!role) return '';
  
  const accessories = {
    duck1: `<circle cx="28" cy="14" r="5" fill="${role.hatColor}" opacity="0.9"/><!-- 红帽 -->
            <polygon points="28,9 31,14 25,14" fill="${role.hatColor}"/>`,
    duck2: `<rect x="20" y="10" width="14" height="3" rx="1" fill="${role.hatColor}"/><!-- 蝴蝶结 -->
            <polygon points="20,11 16,8 16,14" fill="${role.hatColor}"/>
            <polygon points="34,11 38,8 38,14" fill="${role.hatColor}"/>`,
    duck3: `<circle cx="22" cy="20" r="2.5" fill="transparent" stroke="${role.hatColor}" stroke-width="1.5"/><!-- 眼镜 -->
            <circle cx="30" cy="20" r="2.5" fill="transparent" stroke="${role.hatColor}" stroke-width="1.5"/>
            <line x1="24.5" y1="20" x2="27.5" y2="20" stroke="${role.hatColor}" stroke-width="1"/>`,
    duck4: `<path d="M23,8 Q27,4 31,8" fill="none" stroke="${role.hatColor}" stroke-width="2" stroke-linecap="round"/><!-- 王冠 -->
            <circle cx="23" cy="8" r="1.5" fill="${role.hatColor}"/>
            <circle cx="27" cy="6" r="1.5" fill="${role.hatColor}"/>
            <circle cx="31" cy="8" r="1.5" fill="${role.hatColor}"/>`,
    duck5: `<path d="M20,12 L22,8 L26,10 L30,7 L34,12" fill="${role.hatColor}" opacity="0.8"/><!-- 星星帽 -->
            <polygon points="27,5 28,8 31,8 28.5,10 29.5,13 27,11 24.5,13 25.5,10 23,8 26,8" fill="#FFD700" opacity="0.6"/>`,
    duck6: `<ellipse cx="19" cy="14" rx="3" ry="2" fill="${role.hatColor}" opacity="0.7"/><!-- 花朵 -->
            <ellipse cx="22" cy="11" rx="2" ry="3" fill="${role.hatColor}" opacity="0.5" transform="rotate(30,22,11)"/>
            <circle cx="20" cy="12" r="1.5" fill="#fff" opacity="0.6"/>`,
  };

  return `<svg viewBox="0 0 54 50" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <!-- 身体 -->
    <ellipse cx="27" cy="34" rx="16" ry="12" fill="${role.bodyColor}" opacity="0.9"/>
    <!-- 翅膀 -->
    <ellipse cx="18" cy="32" rx="7" ry="9" fill="${role.bodyColor}" opacity="0.7" transform="rotate(-10,18,32)"/>
    <!-- 头部 -->
    <circle cx="27" cy="18" r="10" fill="${role.bodyColor}"/>
    <!-- 眼睛 -->
    <circle cx="24" cy="17" r="2.2" fill="#1a1a2e"/>
    <circle cx="23.5" cy="16.5" r="0.8" fill="#fff"/>
    <!-- 嘴巴 -->
    <ellipse cx="34" cy="20" rx="6" ry="2.5" fill="#FF9800"/>
    <line x1="29" y1="20" x2="39" y2="20" stroke="#E65100" stroke-width="0.5"/>
    <!-- 脚 -->
    <path d="M22,45 L18,49 L24,49 Z" fill="#FF9800"/>
    <path d="M32,45 L28,49 L34,49 Z" fill="#FF9800"/>
    <!-- 配饰 -->
    ${accessories[roleKey] || ''}
  </svg>`;
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DUCK_ROLES, ALL_DUCKS, LYRICS_DATA, FORMATIONS, createDuckSVG };
}
