import { createEmptySaveData, encodeSpell } from '../saveData.js';

const AUTO_RETURN_MS = 60000;

// 終了画面：通常終了時のみふっかつのじゅもんを表示し、60秒後かキー入力で最初の画面へ戻る
export class Ending extends Phaser.Scene {

    constructor() {
        super('Ending');
    }

    preload() {
        this.load.image('logo', 'assets/logo.png');
    }

    create(data = {}) {
        this.cameras.main.setBackgroundColor('#000000');
        this.cameras.main.fadeIn(500, 0, 0, 0);
        const { width, height } = this.scale;

        this.logo = this.add.image(width / 2, 150, 'logo').setOrigin(0.5);
        this.logo.scale = 0.35;

        if (!data.finalCleared) {
            const spell = encodeSpell(this.registry.get('saveData') ?? createEmptySaveData());
            this.add.text(width / 2, 330, 'ふっかつのじゅもん', {
                fontSize: '64px',
                color: '#ffffff'
            }).setOrigin(0.5);

            // 画面の幅いっぱいに収まるよう、文字サイズを幅から決める
            const fontSize = Math.floor((width - 120) / spell.length);
            this.add.text(width / 2, 450, spell, {
                fontSize: `${fontSize}px`,
                color: '#ffff66'
            }).setOrigin(0.5);
        }

        this.add.text(width / 2, height - 60, 'キーを押すと最初の画面に戻ります', {
            fontSize: '28px',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        this.isReturning = false;
        this.time.delayedCall(AUTO_RETURN_MS, () => this.returnToTitle());
        // ステージから入った直後のキー押しっぱなしで戻らないよう、少し待ってから受け付ける
        this.time.delayedCall(300, () => this.input.keyboard.on('keydown', () => this.returnToTitle()));
    }

    returnToTitle() {
        if (this.isReturning) {
            return;
        }
        this.isReturning = true;
        this.scene.start('Title');
    }
}
