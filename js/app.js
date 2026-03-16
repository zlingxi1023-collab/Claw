/**
 * Try Everything 歌词学习卡片
 * 交互逻辑和歌词数据
 */

// 分阶段歌词数据（简化版，帮助记忆关键句）
// 注：为教学目的创建的简化学习内容
const stagesData = {
    1: {
        title: "第1阶段：开场哼唱",
        tip: "这是最简单的部分！跟着节奏哼唱 Oh~",
        cards: [
            {
                lyrics: "Oh oh oh oh oooh",
                phonetic: "哦 哦 哦 哦 哦~",
                translation: "（欢快的开场哼唱）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4]
            },
            {
                lyrics: "Oh oh oh oh oooh",
                phonetic: "哦 哦 哦 哦 哦~",
                translation: "（重复四遍，建立节奏感）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4]
            }
        ]
    },
    2: {
        title: "第2阶段：核心主题句",
        tip: "这是整首歌最重要的一句！表达勇于尝试的精神",
        cards: [
            {
                lyrics: "I wanna try everything",
                phonetic: "爱 wanna 踹 able thing",
                translation: "我想要尝试一切",
                rhythm: ["I", "wan-na", "try", "ev-ery-thing"],
                strongBeats: [0, 2]
            },
            {
                lyrics: "I wanna try",
                phonetic: "爱 wanna 踹",
                translation: "我想要尝试",
                rhythm: ["I", "wan-na", "try"],
                strongBeats: [0, 2]
            },
            {
                lyrics: "even though I could fail",
                phonetic: "衣文 肉 爱 酷的 费欧",
                translation: "即使我可能会失败",
                rhythm: ["e-ven", "though", "I", "could", "fail"],
                strongBeats: [0, 4]
            }
        ]
    },
    3: {
        title: "第3阶段：主歌第一段",
        tip: "讲述不怕失败、重新开始的故事",
        cards: [
            {
                lyrics: "I keep falling down",
                phonetic: "爱 ki:p 否零 当",
                translation: "我不断跌倒",
                rhythm: ["I", "keep", "fall-ing", "down"],
                strongBeats: [1, 3]
            },
            {
                lyrics: "I keep on hitting the ground",
                phonetic: "爱 ki:p 昂 hi听 惹 歌ruang的",
                translation: "我不断撞到地面",
                rhythm: ["I", "keep", "on", "hit-ting", "the", "ground"],
                strongBeats: [1, 3, 5]
            },
            {
                lyrics: "I always get up now",
                phonetic: "爱 噢为s 盖特 阿普 闹",
                translation: "但我总是重新站起来",
                rhythm: ["I", "al-ways", "get", "up", "now"],
                strongBeats: [0, 2, 4]
            },
            {
                lyrics: "to see what's next",
                phonetic: "图 see 沃次 耐克斯特",
                translation: "去看看接下来会发生什么",
                rhythm: ["to", "see", "what's", "next"],
                strongBeats: [1, 3]
            }
        ]
    },
    4: {
        title: "第4阶段：励志桥段",
        tip: "最有力量的部分！像小鸟一样勇敢",
        cards: [
            {
                lyrics: "Birds don't just fly",
                phonetic: "伯兹 东特 家斯特 扶lai",
                translation: "鸟儿不只是飞翔",
                rhythm: ["Birds", "don't", "just", "fly"],
                strongBeats: [0, 3]
            },
            {
                lyrics: "they fall down and get up",
                phonetic: "贼 否 当 安得 盖特 阿普",
                translation: "它们也会跌落再站起",
                rhythm: ["they", "fall", "down", "and", "get", "up"],
                strongBeats: [1, 4]
            },
            {
                lyrics: "Nobody learns",
                phonetic: "No八滴 乐恩斯",
                translation: "没有人能学会",
                rhythm: ["No-bo-dy", "learns"],
                strongBeats: [0, 1]
            },
            {
                lyrics: "without getting it wrong",
                phonetic: "威烧特 盖听 伊特 rong",
                translation: "如果不先犯错的话",
                rhythm: ["with-out", "get-ting", "it", "wrong"],
                strongBeats: [0, 3]
            }
        ]
    },
    5: {
        title: "第5阶段：副歌完整版",
        tip: "把前面学的连起来，完整唱出副歌！",
        cards: [
            {
                lyrics: "I won't give up",
                phonetic: "爱 won't 给v 阿普",
                translation: "我不会放弃",
                rhythm: ["I", "won't", "give", "up"],
                strongBeats: [0, 2]
            },
            {
                lyrics: "no I won't give in",
                phonetic: "no 爱 won't 给v 因",
                translation: "不，我不会屈服",
                rhythm: ["no", "I", "won't", "give", "in"],
                strongBeats: [0, 2, 4]
            },
            {
                lyrics: "Till I reach the end",
                phonetic: "踢欧 爱 瑞驰 惹 安得",
                translation: "直到我到达终点",
                rhythm: ["Till", "I", "reach", "the", "end"],
                strongBeats: [0, 2, 4]
            },
            {
                lyrics: "and then I'll start again",
                phonetic: "安得 然 爱欧 斯大特 额给嗯",
                translation: "然后我会重新开始",
                rhythm: ["and", "then", "I'll", "start", "a-gain"],
                strongBeats: [1, 3, 4]
            }
        ]
    }
};

// 学习提示语
const tips = [
    "点击卡片可以翻转查看中文意思哦！",
    "跟着节奏拍手，强拍用力拍！",
    "先慢慢读，熟悉后再加快速度~",
    "可以配合动作一起记忆歌词！",
    "多听几遍原曲，感受节奏感~",
    "大声唱出来，不要害羞！",
    "和爸爸妈妈一起练习更有趣！"
];

// 当前状态
let currentStage = 1;
let currentCardIndex = 0;
let completedStages = new Set();

// DOM元素
const cardsWrapper = document.getElementById('cardsWrapper');
const progressFill = document.getElementById('progressFill');
const tipText = document.getElementById('tipText');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const flipAllBtn = document.getElementById('flipAllBtn');
const stageBtns = document.querySelectorAll('.stage-btn');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    renderStage(currentStage);
    updateProgress();
    setupEventListeners();
    showRandomTip();
});

// 渲染当前阶段的卡片
function renderStage(stageNum) {
    const stage = stagesData[stageNum];
    if (!stage) return;

    cardsWrapper.innerHTML = '';
    
    stage.cards.forEach((card, index) => {
        const cardEl = createCardElement(card, index + 1);
        cardsWrapper.appendChild(cardEl);
    });

    // 更新提示
    tipText.textContent = stage.tip;
    
    // 更新阶段按钮状态
    updateStageBtns();
}

// 创建卡片元素
function createCardElement(cardData, cardNum) {
    const card = document.createElement('div');
    card.className = 'flip-card';
    card.dataset.index = cardNum - 1;

    // 构建节奏显示
    const rhythmHtml = cardData.rhythm.map((beat, idx) => {
        const isStrong = cardData.strongBeats.includes(idx);
        return `<span class="rhythm-beat ${isStrong ? 'strong' : ''}">${beat}</span>`;
    }).join('');

    card.innerHTML = `
        <div class="flip-card-inner">
            <div class="flip-card-front">
                <span class="card-number">#${cardNum}</span>
                <div class="card-lyrics">${cardData.lyrics}</div>
                <div class="card-phonetic">🎤 ${cardData.phonetic}</div>
                <div class="card-rhythm">${rhythmHtml}</div>
                <span class="flip-hint">点击翻转</span>
            </div>
            <div class="flip-card-back">
                <div class="card-translation">${cardData.translation}</div>
                <div class="card-tip">🌟 ${getEncouragement()}</div>
            </div>
        </div>
    `;

    // 点击翻转
    card.addEventListener('click', () => {
        card.classList.toggle('flipped');
    });

    return card;
}

// 获取随机鼓励语
function getEncouragement() {
    const encouragements = [
        "你做得很棒！",
        "继续加油！",
        "太厉害了！",
        "就是这样！",
        "真棒！",
        "你学得真快！"
    ];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
}

// 设置事件监听
function setupEventListeners() {
    // 阶段切换按钮
    stageBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const stage = parseInt(btn.dataset.stage);
            switchStage(stage);
        });
    });

    // 上一句/下一句
    prevBtn.addEventListener('click', () => {
        if (currentStage > 1) {
            switchStage(currentStage - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        // 标记当前阶段完成
        completedStages.add(currentStage);
        
        if (currentStage < 5) {
            switchStage(currentStage + 1);
        } else {
            // 全部完成
            celebrateCompletion();
        }
        updateProgress();
    });

    // 翻转所有卡片
    flipAllBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.flip-card');
        cards.forEach(card => {
            card.classList.toggle('flipped');
        });
    });
}

// 切换阶段
function switchStage(stageNum) {
    currentStage = stageNum;
    renderStage(stageNum);
    updateStageBtns();
    updateProgress();
    
    // 滚动到卡片区域
    cardsWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 更新阶段按钮状态
function updateStageBtns() {
    stageBtns.forEach(btn => {
        const stage = parseInt(btn.dataset.stage);
        btn.classList.remove('active', 'completed');
        
        if (stage === currentStage) {
            btn.classList.add('active');
        }
        if (completedStages.has(stage)) {
            btn.classList.add('completed');
        }
    });
}

// 更新进度条
function updateProgress() {
    const progress = (completedStages.size / 5) * 100;
    progressFill.style.width = `${Math.max(progress, 20)}%`;
}

// 显示随机提示
function showRandomTip() {
    setInterval(() => {
        if (Math.random() > 0.7) {
            const randomTip = tips[Math.floor(Math.random() * tips.length)];
            tipText.textContent = randomTip;
        }
    }, 10000);
}

// 完成庆祝
function celebrateCompletion() {
    const cards = document.querySelectorAll('.flip-card');
    cards.forEach(card => {
        card.classList.add('completed');
    });
    
    tipText.textContent = "🎉 太棒了！你已经学完所有阶段！可以完整唱这首歌了！";
    
    // 添加庆祝效果
    createConfetti();
}

// 创建彩带效果
function createConfetti() {
    const colors = ['#FF6B35', '#4ECDC4', '#95E1D3', '#FFE66D'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                top: -10px;
                left: ${Math.random() * 100}vw;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                pointer-events: none;
                z-index: 1000;
                animation: confettiFall ${2 + Math.random() * 2}s linear forwards;
            `;
            document.body.appendChild(confetti);
            
            // 移除彩带
            setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
    }
    
    // 添加彩带下落动画
    if (!document.querySelector('#confetti-style')) {
        const style = document.createElement('style');
        style.id = 'confetti-style';
        style.textContent = `
            @keyframes confettiFall {
                to {
                    transform: translateY(100vh) rotate(720deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            if (currentStage > 1) switchStage(currentStage - 1);
            break;
        case 'ArrowRight':
            if (currentStage < 5) {
                completedStages.add(currentStage);
                switchStage(currentStage + 1);
                updateProgress();
            }
            break;
        case ' ':
            e.preventDefault();
            flipAllBtn.click();
            break;
    }
});
