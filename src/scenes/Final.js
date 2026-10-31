import { createEmptySaveData } from '../saveData.js';
import { DEPARTMENTS, GAMES, makeDeck, createGame, createDemoGame, getFinalDifficulty, advanceGame, pressGame, GUIDES, demoKey } from '../minigames/engineering.js';
import { drawMicrogame } from '../minigames/drawEngineering.js';

const ALLOWED = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'Space'];
const FEEDBACK = ['いい設計！', '通電成功！', '基板完成！', '実行成功！', '実験成功！'];

// All microgames use the same fixed screen, timer, input gate, and result flow.
export class Final extends Phaser.Scene {
    constructor() { super('Final'); }
    preload() {
        this.load.image('background', 'assets/back1.png');
        DEPARTMENTS.forEach(dept => {
            this.load.image(`final-${dept.character}`, `assets/${dept.character}-stand.png`);
            this.load.image(`final-${dept.character}-damage`, `assets/${dept.character}-damage.png`);
            for (let i = 1; i <= 4; i++) this.load.image(`final-${dept.character}-run${i}`, `assets/${dept.character}-run-${i}.png`);
        });
    }
    create() {
        this.cameras.main.stopFollow();
        this.cameras.main.setScroll(0, 0);
        this.cameras.main.setBounds(0, 0, 1280, 720);
        this.mode = 'ready';
        this.difficulty = getFinalDifficulty(this.registry.get('saveData') ?? createEmptySaveData());
        this.hasSubmitted = false;
        this.held = new Set();
        this.particles = [];
        this.motion = {};
        this.lastInput = '';
        this.lastInputAt = -1000;
        this.lives = 4;
        this.wins = 0;
        this.roundIndex = 0;
        this.deck = [];
        this.departmentWins = [0, 0, 0, 0, 0];
        this.add.tileSprite(640, 360, 1280, 720, 'background');
        this.add.rectangle(640, 360, 1280, 720, 0x14283f, 0.9);
        const decor = this.add.graphics();
        for (let x = 0; x < 1280; x += 64) decor.lineStyle(1, 0x77cbd4, 0.08).lineBetween(x,94,x,720);
        for (let y = 94; y < 720; y += 64) decor.lineStyle(1, 0x77cbd4, 0.08).lineBetween(0,y,1280,y);
        this.add.rectangle(640, 47, 1280, 94, 0x1d2b41);
        this.heading = this.text(40, 18, '高専 MICRO LAB', 30, '#ffdd88');
        this.roundText = this.text(440, 27, '', 24);
        this.text(440, 65, `取得単位 ${this.difficulty.total}/200　難易度：${this.difficulty.label}`, 16, '#b5c6dc');
        this.lifeText = this.text(1230, 25, '', 26, '#ff9690').setOrigin(1, 0);
        this.titleText = this.text(520, 123, '', 44).setOrigin(0.5, 0);
        this.subtitleText = this.text(520, 190, '', 22, '#b5c6dc').setOrigin(0.5, 0);
        this.playfield = this.add.rectangle(520, 422, 940, 356, 0x1a2940).setStrokeStyle(2, 0x40536e);
        this.graphics = this.add.graphics();
        this.fxGraphics = this.add.graphics().setDepth(16);
        this.drawLabels = [];
        this.labelIndex = 0;
        this.helpText = this.text(1120, 178, '', 18, '#ffdd88').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(225);
        this.departmentText = this.text(1120, 137, '', 24).setOrigin(0.5);
        this.mascot = this.add.image(1120, 460, 'final-J').setOrigin(0.5, 1).setScale(0.75);
        this.text(1120, 491, '卒論の研究素材', 20, '#b5c6dc').setOrigin(0.5);
        this.researchText = this.text(1120, 510, '', 18, '#8ae3b1').setOrigin(0.5, 0).setAlign('center');
        this.add.rectangle(520, 620, 940, 12, 0x34445b);
        this.timerBar = this.add.rectangle(50, 620, 940, 12, 0x8ae3b1).setOrigin(0, 0.5);
        this.controlsText = this.text(520, 662, '', 20).setOrigin(0.5);
        this.timeText = this.text(1120, 614, '', 23, '#ffdd88').setOrigin(0.5);
        this.overlay = this.add.rectangle(640, 360, 1280, 720, 0x101925, 0.96).setDepth(30);
        this.overlayTitle = this.text(640, 172, '', 48, '#ffdd88').setOrigin(0.5).setDepth(31);
        this.overlayBody = this.text(640, 344, '', 26).setOrigin(0.5).setAlign('center').setDepth(31);
        this.overlayHint = this.text(640, 560, '', 27, '#8ae3b1').setOrigin(0.5).setDepth(31);
        this.showOverlay('高専 MICRO LAB',
            `知識ゼロでも大丈夫！ 5つの分野で25のあそび\nまずは動くお手本。わかったらSPACEで挑戦！\n操作は矢印とSPACEだけ。4回失敗でやり直し\n取得単位 ${this.difficulty.total}/200 → 難易度：${this.difficulty.label}\n単位を多く集めるほど、時間・操作に余裕ができるよ！`,
            'SPACE：研究開始     ←：学科選択へ');
        this.refreshHud();
        this.input.keyboard.addCapture(['LEFT', 'DOWN', 'UP', 'RIGHT', 'SPACE']);
        this.onKeyDown = event => this.handleKey(event);
        this.onKeyUp = event => this.held.delete(event.code);
        this.input.keyboard.on('keyup', this.onKeyUp);
        this.onBlur = () => this.pause();
        this.input.keyboard.on('keydown', this.onKeyDown);
        this.game.events.on('blur', this.onBlur);
        this.game.events.on('hidden', this.onBlur);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown', this.onKeyDown);
            this.input.keyboard.off('keyup', this.onKeyUp);
            this.held.clear();
            this.game.events.off('blur', this.onBlur);
            this.game.events.off('hidden', this.onBlur);
        });
    }
    text(x, y, value, size = 24, color = '#ffffff') {
        return this.add.text(x, y, value, { fontSize: `${size}px`, color, fontFamily: 'Arial, sans-serif' });
    }
    // Reuse labels instead of creating hundreds of text objects every second.
    ink(x, y, value, size = 28, color = '#ffffff') {
        let label = this.drawLabels[this.labelIndex];
        if (!label) {
            label = this.text(x, y, '', size, color).setOrigin(0.5);
            this.drawLabels.push(label);
        }
        this.labelIndex++;
        label.setPosition(x, y).setText(value).setFontSize(size).setColor(color).setVisible(true);
        return label;
    }
    showOverlay(title, body, hint) {
        this.overlayTitle.setText(title);
        this.overlayBody.setText(body);
        this.overlayHint.setText(hint);
        [this.overlay, this.overlayTitle, this.overlayBody, this.overlayHint].forEach(o => o.setVisible(true));
    }
    hideOverlay() {
        [this.overlay, this.overlayTitle, this.overlayBody, this.overlayHint].forEach(o => o.setVisible(false));
    }
    startRun() {
        this.deck = makeDeck();
        this.lives = 4;
        this.wins = 0;
        this.roundIndex = 0;
        this.departmentWins = [0, 0, 0, 0, 0];
        this.hasSubmitted = false;
        this.hideOverlay();
        this.startRound();
    }
    startRound() {
        this.current = createGame(this.deck[this.roundIndex], Math.floor(this.roundIndex * 3 / GAMES.length), Math.random, this.difficulty);
        const dept = DEPARTMENTS[this.current.dept];
        this.mode = 'intro';
        this.demoTemplate = createDemoGame(this.current);
        this.demo = JSON.parse(JSON.stringify(this.demoTemplate));
        this.demoStarted = performance.now();
        this.demoNext = 0;
        this.demoFinished = null;
        this.held.clear();
        this.motion = {};
        this.particles = [];
        this.phaseStarted = performance.now();
        this.titleText.setText(this.current.title);
        this.subtitleText.setText(this.current.subtitle);
        this.controlsText.setText(this.current.controls);
        this.departmentText.setText(dept.name);
        this.heading.setColor('#' + dept.color.toString(16));
        this.playfield.setFillStyle([0x3b2c28, 0x313522, 0x203b40, 0x302b49, 0x243d36][this.current.dept]).setStrokeStyle(3, dept.color);
        const guide = GUIDES[this.current.id].join('\n');
        this.helpText.setText(guide);
        this.mascot.setTexture(`final-${dept.character}`);
        this.refreshHud();
        this.renderGame();
    }
    refreshHud() {
        this.roundText.setText(`ROUND ${Math.min(this.roundIndex + 1, GAMES.length)} / ${GAMES.length}`);
        this.lifeText.setText(`残り ${'♥'.repeat(this.lives)}${'♡'.repeat(4 - this.lives)}`);
        const counts = this.departmentWins;
        this.researchText.setText(`${this.wins} / ${GAMES.length} 実験成功\n機械 ${counts[0]}　電気 ${counts[1]}\n電子 ${counts[2]}　情報 ${counts[3]}\n物質 ${counts[4]}`);
        this.researchText.setWordWrapWidth(230);
    }
    handleKey(event) {
        if (!ALLOWED.includes(event.code) || event.repeat) return;
        if (this.mode === 'paused') {
            if (event.code === 'ArrowLeft') this.scene.start('Home');
            if (event.code === 'Space') {
                const pausedFor = performance.now() - this.pausedAt;
                this.phaseStarted += pausedFor;
                this.demoStarted += pausedFor;
                if (this.demoFinished !== null) this.demoFinished += pausedFor;
                this.mode = this.pausedMode;
                this.hideOverlay();
            }
            return;
        }
        if (this.mode === 'ready' || this.mode === 'failed') {
            if (event.code === 'ArrowLeft') this.scene.start('Home');
            if (event.code === 'Space') this.startRun();
            return;
        }
        if (this.mode === 'complete') {
            if (event.code === 'Space') this.scene.start('Ending', { finalCleared: true });
            return;
        }
        if (this.mode === 'intro') {
            if (event.code === 'Space') {
                this.mode = 'playing'; this.phaseStarted = performance.now(); this.motion = {}; this.lastInput = ''; this.beep(520);
            }
            return;
        }
        if (this.mode !== 'playing') return;
        if (event.code !== 'Space') { this.held.add(event.code); this.repeatAt = performance.now() + 280; }
        this.playInput(event.code);
        this.renderGame();
    }
    finishRound() {
        if (this.mode !== 'playing') return;
        this.held.clear();
        this.mode = 'result';
        this.burst(520, 410, this.current.result ? 0xffdc66 : 0xff9292, this.current.result ? 60 : 16);
        this.beep(this.current.result ? 880 : 180, 0.18);
        this.phaseStarted = performance.now();
        if (this.current.result) {
            this.wins++;
            this.departmentWins[this.current.dept]++;
        } else {
            this.lives--;
        }
        this.refreshHud();
    }
    nextRound() {
        if (!this.lives) {
            this.mode = 'failed';
            this.showOverlay('追試！', `${this.wins} 実験成功 / ${this.roundIndex + 1} ラウンド\nまだ研究は終わらない。もう一度挑戦！`, 'SPACE：やり直す     ←：学科選択へ');
            return;
        }
        if (++this.roundIndex === this.deck.length) {
            this.completeThesis();
            return;
        }
        this.startRound();
    }
    pause() {
        if (!['intro', 'playing', 'result'].includes(this.mode)) return;
        this.held.clear();
        this.pausedMode = this.mode;
        this.pausedAt = performance.now();
        this.mode = 'paused';
        this.showOverlay('一時停止', '実験の残り時間は止まっています', 'SPACE：再開     ←：学科選択へ');
    }
    update() {
        const now = performance.now();
        const elapsed = now - this.phaseStarted;
        if (this.mode === 'intro') {
            if (this.demo.result !== null) {
                if (this.demoFinished === null) this.demoFinished = now;
                if (now - this.demoFinished > 1100) {
                    this.demo = JSON.parse(JSON.stringify(this.demoTemplate));
                    this.demoStarted = now; this.demoNext = 0; this.demoFinished = null; this.motion = {};
                }
            } else {
                const t = (now - this.demoStarted) / 1000;
                advanceGame(this.demo, t);
                if (this.demo.result === null && t >= this.demoNext) {
                    const key = demoKey(this.demo);
                    if (key) { pressGame(this.demo,key,t); this.lastInput = key; this.lastInputAt = now; this.demoNext = t + 0.48; }
                }
            }
        } else if (this.mode === 'playing') {
            const repeatable = ['catch','packet','wire','voltage','solder','sort','debug','logic','crane','launch','bulb','chip','led','robot','molecule','thermal','microbes'];
            if (now >= this.repeatAt && this.held.size && repeatable.includes(this.current.id)) {
                this.playInput([...this.held].at(-1)); this.repeatAt = now + 160;
            }
            if (this.mode === 'playing') {
                advanceGame(this.current, elapsed / 1000);
                if (this.current.result !== null) this.finishRound();
            }
        } else if (this.mode === 'result' && elapsed >= 900) this.nextRound();
        if (['intro','playing','result'].includes(this.mode)) {
            this.mascot.y = 460 + Math.sin(now / 220) * (this.mode === 'result' && this.current.result ? 13 : 3);
            const character = DEPARTMENTS[this.current.dept].character;
            const celebrating = this.mode === 'result' && this.current.result;
            const moving = now - this.lastInputAt < 450;
            this.mascot.setTexture(`final-${character}${this.mode === 'result' && !this.current.result ? '-damage' : moving || celebrating ? '-run' + (1 + Math.floor(now / 120) % 4) : ''}`);
            this.mascot.setAngle(celebrating ? Math.sin(now / 140) * 7 : 0);
            this.renderGame();
        }
    }
    playInput(key) {
        const mistakes = this.current.mistakes;
        pressGame(this.current,key,(performance.now()-this.phaseStarted)/1000);
        this.lastInput = key; this.lastInputAt = performance.now();
        if (this.current.mistakes > mistakes) this.beep(240,0.06);
        else { this.beep(460,0.035); this.burst(520,530,DEPARTMENTS[this.current.dept].color,8); }
        if (this.current.result !== null) this.finishRound();
    }
    beep(frequency, duration = 0.07) {
        const context = this.sound?.context;
        if (!context || context.state !== 'running') return;
        const oscillator = context.createOscillator(), gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.045,context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + duration);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    burst(x,y,color,count) {
        const now = performance.now();
        for(let i=0;i<count;i++) this.particles.push({x,y,color,born:now,vx:(Math.random()-0.5)*480,vy:-100-Math.random()*360});
    }
    drawEffects() {
        this.fxGraphics.clear();
        const now = performance.now();
        this.particles = this.particles.filter(p=>now-p.born<1400);
        for(const p of this.particles) {
            const t = (now-p.born)/1000;
            this.fxGraphics.fillStyle(p.color,Math.max(0,1-t/1.4)).fillRect(p.x+p.vx*t,p.y+p.vy*t+280*t*t,6,9);
        }
    }
    completeThesis() {
        if(this.hasSubmitted) return;
        this.hasSubmitted = true; this.mode = 'complete';
        const save = this.registry.get('saveData') ?? createEmptySaveData();
        save.completedCount++; this.registry.set('saveData',save);
        this.showOverlay('卒業論文、完成！', `${this.wins} / ${GAMES.length} 実験成功！\n5つの分野をめぐった研究が、一冊になりました。\n最後まで遊んでくれてありがとう！`, 'SPACE：エンディングへ');
    }
    drawKeyCaps() {
        const symbols = ['←','↓','↑','→','SPACE'];
        ALLOWED.forEach((key,i)=> {
            const x = 1020 + i*45;
            const active = this.lastInput === key && performance.now()-this.lastInputAt < 420;
            this.graphics.fillStyle(active ? 0xffdc66 : 0x304a65).fillRoundedRect(x-19,647,40,32,6);
            this.ink(x,663,symbols[i],i===4?10:20,active?'#122238':'#ffffff');
        });
    }
    renderGame() {
        this.graphics.clear();
        this.labelIndex = 0;
        if (this.mode === 'playing' || this.mode === 'intro') {
            const state = this.mode === 'intro' ? this.demo : this.current;
            state.visualTime = performance.now()/1000;
            drawMicrogame(this,state);
        }
        this.controlsText.setText(this.mode === 'intro' ? 'お手本は何度でも見られるよ！　SPACE：本番スタート' : this.current.controls);
        this.subtitleText.setText(this.mode === 'intro' ? 'お手本を見よう！ まだ時間は減らないよ' : this.current.feedback || this.current.subtitle);
        const remaining = Math.max(0, this.current.duration - this.current.elapsed);
        this.timerBar.width = Math.max(1, 940 * remaining / this.current.duration);
        this.timerBar.setFillStyle(remaining < 2 ? 0xff7777 : 0x8ae3b1);
        this.timeText.setText(this.mode === 'intro' ? (this.demo.result ? 'こうすればOK！' : 'お手本 再生中') : `${remaining.toFixed(1)} 秒`);
        if (this.mode === 'result') {
            const jump = Math.sin(Math.min(1, (performance.now() - this.phaseStarted) / 600) * Math.PI) * 28;
            this.graphics.fillStyle(0xa6bbc9).fillRoundedRect(475, 265 - jump, 90, 55, 5);
            this.graphics.fillStyle(0xfff5d7).fillRoundedRect(468, 255 - jump, 90, 55, 5);
            this.ink(513, 282 - jump, this.current.result ? '✓' : '…', 36, this.current.result ? '#269169' : '#be6573');
            this.graphics.fillStyle(0x101925, 0.94).fillRoundedRect(260, 330, 520, 160, 18);
            this.ink(520, 392, this.current.result ? FEEDBACK[this.current.dept] : 'あっ！ やり直し！', 36, this.current.result === false ? '#ff9690' : '#ffdd88');
            this.ink(520, 447, this.current.result ? '卒論に新しい1ページ！' : '大丈夫！ 次のお手本を見てみよう', 23);
        }
        this.drawKeyCaps();
        this.drawEffects();
        for (let i = this.labelIndex; i < this.drawLabels.length; i++) this.drawLabels[i].setVisible(false);
    }
}
