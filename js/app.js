/**
 * Try Everything 歌词学习卡片
 * 交互逻辑和歌词数据 — 带音频播放版本
 */

// 分阶段歌词数据 — 基于 QQ 音乐 LRC 歌词精确时间戳切割
const stagesData = {
    1: {
        title: "第1阶段：开场哼唱",
        tip: "🎧 跟着节奏哼唱 Oh~，感受欢快的旋律！",
        cards: [
            {
                lyrics: "Oh oh oh oh oooh\nOh oh oh oh oooh",
                phonetic: "哦 哦 哦 哦 哦~ × 2",
                translation: "（欢快的开场哼唱，连续两遍）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4],
                audio: "audio/stage1_card1.mp3"
            },
            {
                lyrics: "Oh oh oh oh oooh\nOh oh oh oh oooh",
                phonetic: "哦 哦 哦 哦 哦~ × 2",
                translation: "（再来两遍，建立节奏感）",
                rhythm: ["Oh", "oh", "oh", "oh", "oooh~"],
                strongBeats: [0, 4],
                audio: "audio/stage1_card2.mp3"
            }
        ]
    },
    2: {
        title: "第2阶段：主歌第一段",
        tip: "🎧 讲述不怕失败、重新开始的故事，听听 Shakira 怎么唱~",
        cards: [
            {
                lyrics: "I messed up tonight\nI lost another fight",
                phonetic: "爱 迈斯特 阿普 特奈特，爱 劳斯特 额那惹 fai特",
                translation: "今晚我又搞砸了\n我又输了一场",
                rhythm: ["I", "messed", "up", "to-night", "I", "lost", "a-no-ther", "fight"],
                strongBeats: [1, 3, 5, 7],
                audio: "audio/stage2_card1.mp3"
            },
            {
                lyrics: "I still mess up\nbut I'll just start again",
                phonetic: "爱 斯提欧 迈斯 阿普，巴特 爱欧 家斯特 斯大特 额给嗯",
                translation: "我还是会搞砸\n但我会重新开始",
                rhythm: ["I", "still", "mess", "up", "but", "I'll", "just", "start", "a-gain"],
                strongBeats: [1, 3, 7, 8],
                audio: "audio/stage2_card2.mp3"
            },
            {
                lyrics: "I keep falling down\nI keep on hitting the ground",
                phonetic: "爱 ki:p 否零 当，爱 ki:p 昂 嘿听 惹 歌ruang的",
                translation: "我不断跌倒\n我不断撞到地面",
                rhythm: ["I", "keep", "fall-ing", "down", "I", "keep", "on", "hit-ting", "the", "ground"],
                strongBeats: [1, 3, 5, 7, 9],
                audio: "audio/stage2_card3.mp3"
            },
            {
                lyrics: "But I always get up now\nto see what's next",
                phonetic: "巴特 爱 噢为s 盖特 阿普 闹，图 see 沃次 耐克斯特",
                translation: "但我总是重新站起来\n去看看接下来会发生什么",
                rhythm: ["But", "I", "al-ways", "get", "up", "now", "to", "see", "what's", "next"],
                strongBeats: [2, 3, 5, 7, 9],
                audio: "audio/stage2_card4.mp3"
            }
        ]
    },
    3: {
        title: "第3阶段：励志桥段",
        tip: "🎧 最有力量的部分！像小鸟一样勇敢，听原曲感受！",
        cards: [
            {
                lyrics: "Birds don't just fly\nthey fall down and get up",
                phonetic: "伯兹 东特 家斯特 扶lai，贼 否 当 安得 盖特 阿普",
                translation: "鸟儿不只是飞翔\n它们也会跌落再站起",
                rhythm: ["Birds", "don't", "just", "fly", "they", "fall", "down", "and", "get", "up"],
                strongBeats: [0, 3, 5, 8],
                audio: "audio/stage3_card1.mp3"
            },
            {
                lyrics: "Nobody learns\nwithout getting it wrong",
                phonetic: "No八滴 乐恩斯，威烧特 盖听 伊特 rong",
                translation: "没有人能学会\n如果不先犯错的话",
                rhythm: ["No-bo-dy", "learns", "with-out", "get-ting", "it", "wrong"],
                strongBeats: [0, 1, 2, 5],
                audio: "audio/stage3_card2.mp3"
            }
        ]
    },
    4: {
        title: "第4阶段：副歌（核心）",
        tip: "🎧 这是整首歌最重要的部分！跟着原曲一起唱！",
        cards: [
            {
                lyrics: "I won't give up\nno I won't give in",
                phonetic: "爱 won't 给v 阿普，no 爱 won't 给v 因",
                translation: "我不会放弃\n不，我不会屈服",
                rhythm: ["I", "won't", "give", "up", "no", "I", "won't", "give", "in"],
                strongBeats: [0, 2, 4, 6, 8],
                audio: "audio/stage4_card1.mp3"
            },
            {
                lyrics: "Till I reach the end\nand then I'll start again",
                phonetic: "踢欧 爱 瑞驰 惹 安得，安得 然 爱欧 斯大特 额给嗯",
                translation: "直到我到达终点\n然后我会重新开始",
                rhythm: ["Till", "I", "reach", "the", "end", "and", "then", "I'll", "start", "a-gain"],
                strongBeats: [0, 2, 4, 8, 9],
                audio: "audio/stage4_card2.mp3"
            },
            {
                lyrics: "No I won't leave\nI wanna try everything",
                phonetic: "no 爱 won't 离v，爱 wanna 踹 able thing",
                translation: "不，我不会离开\n我想要尝试一切",
                rhythm: ["No", "I", "won't", "leave", "I", "wan-na", "try", "ev-ery-thing"],
                strongBeats: [0, 2, 3, 4, 6, 7],
                audio: "audio/stage4_card3.mp3"
            },
            {
                lyrics: "I wanna try\neven though I could fail",
                phonetic: "爱 wanna 踹，衣文 肉 爱 酷的 费欧",
                translation: "我想要尝试\n即使我可能会失败",
                rhythm: ["I", "wan-na", "try", "e-ven", "though", "I", "could", "fail"],
                strongBeats: [0, 2, 3, 7],
                audio: "audio/stage4_card4.mp3"
            }
        ]
    },
    5: {
        title: "第5阶段：第二段主歌",
        tip: "🎧 温暖鼓励的一段：你已经走了很远了！",
        cards: [
            {
                lyrics: "Look how far you've come\nyou filled your heart with love",
                phonetic: "路克 好 发 优v 卡姆，优 fi欧得 哟 哈特 位子 拉v",
                translation: "看看你已经走了多远\n你的心充满了爱",
                rhythm: ["Look", "how", "far", "you've", "come", "you", "filled", "your", "heart", "with", "love"],
                strongBeats: [0, 2, 4, 6, 8, 10],
                audio: "audio/stage5_card1.mp3"
            },
            {
                lyrics: "Baby you've done enough\ntake a deep breath",
                phonetic: "贝比 优v 当 额那夫，忒克 额 滴p 不ruai斯",
                translation: "宝贝你已经做得够多了\n深呼吸一下",
                rhythm: ["Ba-by", "you've", "done", "e-nough", "take", "a", "deep", "breath"],
                strongBeats: [0, 2, 3, 4, 6, 7],
                audio: "audio/stage5_card2.mp3"
            },
            {
                lyrics: "Don't beat yourself up\ndon't need to run so fast",
                phonetic: "东特 比特 哟塞欧夫 阿普，东特 尼的 图 ruang 搜 发斯特",
                translation: "别太自责了\n不需要跑那么快",
                rhythm: ["Don't", "beat", "your-self", "up", "don't", "need", "to", "run", "so", "fast"],
                strongBeats: [0, 1, 3, 4, 7, 9],
                audio: "audio/stage5_card3.mp3"
            },
            {
                lyrics: "Sometimes we come last\nbut we did our best",
                phonetic: "撒姆太姆斯 we 卡姆 拉斯特，巴特 we 滴得 奥 百斯特",
                translation: "有时候我们会落在最后\n但我们已经尽力了",
                rhythm: ["Some-times", "we", "come", "last", "but", "we", "did", "our", "best"],
                strongBeats: [0, 2, 3, 4, 6, 8],
                audio: "audio/stage5_card4.mp3"
            }
        ]
    },
    6: {
        title: "第6阶段：高潮尾声",
        tip: "🎧 最感人的尾声！拥抱错误，每天都在进步！",
        cards: [
            {
                lyrics: "I'll keep on making\nthose new mistakes",
                phonetic: "爱欧 ki:p 昂 美king 肉斯 纽 迷斯忒克斯",
                translation: "我会继续犯\n那些新的错误",
                rhythm: ["I'll", "keep", "on", "mak-ing", "those", "new", "mis-takes"],
                strongBeats: [0, 1, 3, 5, 6],
                audio: "audio/stage6_card1.mp3"
            },
            {
                lyrics: "I'll keep on making them\nevery day",
                phonetic: "爱欧 ki:p 昂 美king 然姆 able 瑞 dei",
                translation: "我会每天都继续犯\n新的错误",
                rhythm: ["I'll", "keep", "on", "mak-ing", "them", "ev-ery", "day"],
                strongBeats: [0, 1, 3, 5, 6],
                audio: "audio/stage6_card2.mp3"
            },
            {
                lyrics: "Those new mistakes",
                phonetic: "肉斯 纽 迷斯忒克斯",
                translation: "那些新的错误\n（拥抱每一次尝试！）",
                rhythm: ["Those", "new", "mis-takes"],
                strongBeats: [0, 1, 2],
                audio: "audio/stage6_card3.mp3"
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
    "点击 ▶ 播放原曲片段，跟着唱~",
    "大声唱出来，不要害羞！",
    "和爸爸妈妈一起练习更有趣！"
];

// 当前状态
let currentStage = 1;
let currentCardIndex = 0;
let completedStages = new Set();
let currentAudio = null; // 当前播放的音频
let isAutoPlaying = false; // 是否正在自动播放模式
let autoPlayQueue = []; // 自动播放队列

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

// 停止当前播放
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
    isAutoPlaying = false;
    autoPlayQueue = [];
    // 重置所有播放按钮状态
    document.querySelectorAll('.audio-play-btn').forEach(btn => {
        btn.classList.remove('playing');
        btn.querySelector('.play-icon').textContent = '▶';
    });
    // 重置所有进度条
    document.querySelectorAll('.audio-progress-fill').forEach(bar => {
        bar.style.width = '0%';
    });
}

// 播放指定音频
function playAudio(audioSrc, btnElement) {
    stopCurrentAudio();

    currentAudio = new Audio(audioSrc);
    
    if (btnElement) {
        btnElement.classList.add('playing');
        btnElement.querySelector('.play-icon').textContent = '⏸';
    }

    // 找到对应的进度条
    const card = btnElement ? btnElement.closest('.flip-card') : null;
    const progressBar = card ? card.querySelector('.audio-progress-fill') : null;

    currentAudio.addEventListener('timeupdate', () => {
        if (progressBar && currentAudio.duration) {
            const pct = (currentAudio.currentTime / currentAudio.duration) * 100;
            progressBar.style.width = pct + '%';
        }
    });

    currentAudio.addEventListener('ended', () => {
        if (btnElement) {
            btnElement.classList.remove('playing');
            btnElement.querySelector('.play-icon').textContent = '▶';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        currentAudio = null;

        // 如果是自动播放模式，播放下一个
        if (isAutoPlaying && autoPlayQueue.length > 0) {
            const next = autoPlayQueue.shift();
            setTimeout(() => {
                highlightCard(next.index);
                playAudio(next.src, next.btn);
            }, 500);
        } else {
            isAutoPlaying = false;
        }
    });

    currentAudio.play().catch(e => {
        console.log('播放失败（可能需要用户交互）:', e);
        if (btnElement) {
            btnElement.classList.remove('playing');
            btnElement.querySelector('.play-icon').textContent = '▶';
        }
    });
}

// 高亮当前播放的卡片
function highlightCard(index) {
    document.querySelectorAll('.flip-card').forEach((card, i) => {
        card.classList.toggle('active', i === index);
    });
}

// 自动播放整个阶段
function autoPlayStage() {
    const stage = stagesData[currentStage];
    if (!stage) return;

    stopCurrentAudio();
    isAutoPlaying = true;
    autoPlayQueue = [];

    const cards = document.querySelectorAll('.flip-card');
    
    stage.cards.forEach((cardData, index) => {
        if (index === 0) return; // 第一个直接播放
        const btn = cards[index] ? cards[index].querySelector('.audio-play-btn') : null;
        autoPlayQueue.push({
            src: cardData.audio,
            btn: btn,
            index: index
        });
    });

    // 播放第一张卡片
    const firstBtn = cards[0] ? cards[0].querySelector('.audio-play-btn') : null;
    highlightCard(0);
    playAudio(stage.cards[0].audio, firstBtn);
}

// 渲染当前阶段的卡片
function renderStage(stageNum) {
    const stage = stagesData[stageNum];
    if (!stage) return;

    stopCurrentAudio();
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
                <div class="audio-player-inline">
                    <button class="audio-play-btn" data-audio="${cardData.audio}" title="播放这句">
                        <span class="play-icon">▶</span>
                    </button>
                    <div class="audio-progress">
                        <div class="audio-progress-fill"></div>
                    </div>
                    <span class="audio-label">听原曲</span>
                </div>
                <span class="flip-hint">点击卡片翻转</span>
            </div>
            <div class="flip-card-back">
                <div class="card-translation">${cardData.translation}</div>
                <div class="card-tip">🌟 ${getEncouragement()}</div>
                <div class="audio-player-inline back-player">
                    <button class="audio-play-btn" data-audio="${cardData.audio}" title="再听一遍">
                        <span class="play-icon">▶</span>
                    </button>
                    <span class="audio-label">再听一遍</span>
                </div>
            </div>
        </div>
    `;

    // 播放按钮 - 阻止冒泡，不触发翻转
    card.querySelectorAll('.audio-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const audioSrc = btn.dataset.audio;
            
            // 如果正在播放同一个音频，暂停
            if (currentAudio && !currentAudio.paused && btn.classList.contains('playing')) {
                stopCurrentAudio();
                return;
            }
            
            playAudio(audioSrc, btn);
        });
    });

    // 点击卡片翻转（排除播放按钮区域）
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.audio-play-btn') && !e.target.closest('.audio-player-inline')) {
            card.classList.toggle('flipped');
        }
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
        
        if (currentStage < 6) {
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

    // 自动播放按钮
    const autoPlayBtn = document.getElementById('autoPlayBtn');
    if (autoPlayBtn) {
        autoPlayBtn.addEventListener('click', () => {
            if (isAutoPlaying) {
                stopCurrentAudio();
                autoPlayBtn.querySelector('.btn-icon').textContent = '🎵';
                autoPlayBtn.querySelector('span:last-child').textContent = '连续播放';
            } else {
                autoPlayStage();
                autoPlayBtn.querySelector('.btn-icon').textContent = '⏹';
                autoPlayBtn.querySelector('span:last-child').textContent = '停止播放';
            }
        });
    }
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
    const progress = (completedStages.size / 6) * 100;
    progressFill.style.width = `${Math.max(progress, 16)}%`;
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
            if (currentStage < 6) {
                completedStages.add(currentStage);
                switchStage(currentStage + 1);
                updateProgress();
            }
            break;
        case ' ':
            e.preventDefault();
            flipAllBtn.click();
            break;
        case 'p':
        case 'P':
            // P键触发自动播放
            const autoPlayBtn = document.getElementById('autoPlayBtn');
            if (autoPlayBtn) autoPlayBtn.click();
            break;
    }
});
