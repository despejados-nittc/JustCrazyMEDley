import { IS_SCENE_DEBUG, createEmptySaveData, encodeSaveData } from '../saveData.js';
import { getGroundRespawnX, isPitInputBlocked, lockPitRespawnInput } from './pitRespawn.js';
import { setupRunningSound } from './runningSound.js';
import { setupStageBgm } from './stageBgm.js';

export class Joho extends Phaser.Scene {

    constructor(sceneKey = 'Joho') {
        super(sceneKey);
    }

    preload() {
        this.load.audio('specialBgm', 'assets/maou_bgm_8bit29.mp3');
        this.load.audio('itemStomp', 'assets/決定ボタンを押す50.mp3');
        this.load.audio('gradeStomp', 'assets/決定ボタンを押す33.mp3');
        this.load.audio('stageBgm', 'assets/魔王魂 ループ  8bit05.mp3');
        this.load.audio('jumpTakeoff', 'assets/キャンセル9.mp3');
        this.load.audio('jumpLand', 'assets/ジャンプの着地.mp3');
        this.load.audio('jumpAir', 'assets/ちょこっと触る.mp3');
        this.load.audio('blockHit', 'assets/決定ボタンを押す44.mp3');
        this.load.audio('running', 'assets/アスファルトの上を走る1.mp3');
        this.load.audio('tangyeCollect', 'assets/決定ボタンを押す35.mp3');
        this.load.audio('akatenHit', 'assets/ガラスにひびが入る.mp3');
        this.load.audio('aotenHit', 'assets/石が砕ける.mp3');
        this.load.audio('reportHit', 'assets/ビープ音4.mp3');
        this.load.audio('enadoriHit', 'assets/缶を開ける.mp3');
        this.load.audio('semicolonHit', 'assets/old-ubuntu-error-sound.mp3');
        this.load.image('background', 'assets/back1.png');//背景
        this.load.image('ground1', 'assets/ground1.png');//地面
        this.load.image('JohocharacterStand', 'assets/J-stand.png');//J（主人公）
        this.load.image('JohocharacterDamage', 'assets/J-damage.png');//J（主人公）
        this.load.image('JohocharacterRun1', 'assets/J-run-1.png');//J（主人公）
        this.load.image('JohocharacterRun2', 'assets/J-run-2.png');//J（主人公）
        this.load.image('JohocharacterRun3', 'assets/J-run-3.png');//J（主人公）
        this.load.image('JohocharacterRun4', 'assets/J-run-4.png');//J（主人公）
        this.load.image('tangye', 'assets/tangye.png');//タン・イー
        this.load.image('Akaten', 'assets/Akaten.png');//赤点
        this.load.image('Aoten', 'assets/Aoten.png');//青点
        this.load.image('gameover', 'assets/gameover.png');
        this.load.image('life', 'assets/life.png');//ライフアイコン
        this.load.image('block', 'assets/block-one.png');
        this.load.image('report1', 'assets/report-1.png');//レポート
        this.load.image('enadori1', 'assets/enadori-1.png');//エナドリ
        this.load.image('JohoDamageItem', 'assets/J-semicolon.png');//情報工学科専用damageアイテム
    }

    create() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);//Homeからの暗転から明るくする
        this.isLeaving = false;//ステージの右端から出ていく最中かどうか
        this.isGameOver = false;
        this.isDamageShowing = false;
        this.isDamageKnockback = false;
        this.isInvulnerable = false;
        this.isStarInvincible = false;//踏みつけ回数による無敵モード中かどうか
        this.stompCount = 0;//上から踏みつけて無害にした回数
        this.stompsForInvincible = 10;//無敵モードになる踏みつけ回数
        this.starInvincibleDuration = 10000;//無敵モードの時間（ミリ秒）
        this.starInvincibleTimer = null;
        this.starGlow = null;
        this.isPitRespawnProtected = false;
        this.pitRespawnProtectionTimer = null;
        this.mustReleasePitKeys = false;
        this.mustReleaseMovementKeys = false;
        this.damageTextureTimer = null;
        // 背景と地面
        this.background = this.add.tileSprite(640, 360, 1280, 720, 'background');//背景を配置
        this.groundHeight = 100;
        this.groundY = this.scale.height - this.groundHeight;
        this.worldWidth = 12800;//ワールドの幅（地面の生成より前に必要）
        this.pits = [];//落とし穴の範囲 {left, right}
        this.maxLife = 5;//ライフの最大数
        this.life = this.maxLife;//ライフ
        this.placeAllPits();//落とし穴を配置し、穴を避けて地面を作る

        this.background.setScrollFactor(0);

        // ワールドと操作・物理設定
        this.moveSpeed =650;
        this.cursors = this.input.keyboard.createCursorKeys();
        this.gravity = 3000;//重力
        this.jumpSpeed = 1100;//ジャンプ速度

        // 空中のオブジェクト 
        this.platformGroup = this.add.group();//配置した空中ブロックの管理用
        this.wallGroup = this.add.group();//壁ブロックの管理用
        this.placeAllPlatforms();//空中ブロックを配置
        this.placeAllWalls();//壁を配置

        // 収集アイテム
        this.stageIndex = 3;//このステージの番号（0 機械, 1 電気, 2 電子, 3 情報, 4 物質）
        this.saveData = this.registry.get('saveData') ?? createEmptySaveData();//保存済みデータ（初回は全て0）
        this.stageTangyeRecord = this.saveData.stages[this.stageIndex];
        this.runTangyeCount = 0;
        this.itemPreviousPositions = new WeakMap();
        this.tangyeGroup = this.add.group();//配置したタン・イーの管理用
        this.AkatenGroup = this.add.group();//配置した赤点の管理用
        this.AotenGroup = this.add.group();//配置した青点の管理用
        this.reportGroup = this.add.group();//配置したレポートの管理用
        this.enadoriGroup = this.add.group();//配置したエナドリ（判定用の箱）の管理用
        this.departmentDamageGroup = this.add.group();//学科専用damageアイテムの管理用
        this.placeAllHiddenBlocks();
        this.solidBlockBounds = [
            ...this.platformGroup.getChildren(),
            ...this.wallGroup.getChildren(),
        ].map(block => ({ block, bounds: block.getBounds() }));
        this.wallBlockBounds = this.wallGroup.getChildren()
            .map(block => block.getBounds());
        this.tangyeCount = 0;//今回のプレイで取得したタン・イーの数
        this.placeAllTangye();//未取得のタン・イーを配置
        this.placeAllMoveTangye();//未取得の動くタン・イーを配置
        this.placeAllAkaten();
        this.placeAllAoten();
        this.placeAllReports();
        this.placeAllDepartmentDamage();
        this.placeAllEnadori();
        this.startEnadoriSpawner();


        // 取得数の表示（右上に固定）：タン・イーの画像＋数字
        this.tangyeCountText = this.add.text(this.scale.width - 20, 20, `${this.tangyeCount}/40`, {
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        this.tangyeCountIcon = this.add.image(0, 20 + this.tangyeCountText.height / 2, 'tangye')
            .setScale(0.2).setScrollFactor(0).setDepth(100);
        this.updateTangyeCountDisplay();

        // ライフの表示（右上、取得数の下に固定）：life画像をライフの数だけ並べる
        const lifeIconSize = 40;
        this.lifeIcons = [];
        for (let i = 0; i < this.maxLife; i++) {
            const icon = this.add.image(this.scale.width - 20 - lifeIconSize / 2 - (this.maxLife - 1 - i) * (lifeIconSize + 8), 90, 'life')
                .setDisplaySize(lifeIconSize, lifeIconSize).setScrollFactor(0).setDepth(100);
            this.lifeIcons.push(icon);
        }
        this.updateLifeDisplay();

        // 画面左端のワールド座標の表示（左上に固定）
        this.leftXText = this.add.text(20, 20, 'X: 0', {
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(100);

        this.elapsedSeconds = 0;//プレイ開始からの経過時間（ゲームオーバーや退場の時点で止まる）
        this.timeText = this.add.text(20, 60, 'Time: 0.0', {
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setScrollFactor(0).setDepth(100);

        this.damageCauseText = this.add.text(this.scale.width / 2, 40, '', {
            fontSize: '32px',
            color: '#ff6666',
            stroke: '#000000',
            strokeThickness: 4,
            padding: { top: 8, bottom: 8 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setVisible(false);

        // 上から踏みつけて無害にしたダメージアイテムの数（右上、ライフの下に固定）
        this.stompCountText = this.add.text(this.scale.width - 20, 120, '', {
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
        this.updateStompCountDisplay();

        // 無敵モード中だけ画面中央上部に表示する
        this.starInvincibleText = this.add.text(this.scale.width / 2, 40, '無敵状態', {
            fontSize: '40px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6,
            padding: { top: 8, bottom: 8 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setVisible(false);

        // プレイヤー
        this.characterStand = this.add.sprite(220, 0, 'JohocharacterStand');//J（主人公）を配置
        this.characterStand.setScale(0.5) ;//J（主人公）のサイズを調整
        this.playerHalfHeight = this.characterStand.displayHeight / 2;//判定用の高さ（画像が切り替わっても変えない）
        this.characterStandBaseY = this.groundY - this.playerHalfHeight;
        this.characterStand.y = this.characterStandBaseY;
        this.previousCharacterX = this.characterStand.x;
        this.previousCharacterY = this.characterStand.y;
        if (!this.anims.exists('JohoRun')) {
            this.anims.create({
                key: 'JohoRun',
                frames: ['JohocharacterRun1', 'JohocharacterRun2', 'JohocharacterRun3', 'JohocharacterRun4'].map(key => ({ key })),
                frameRate: 10,
                repeat: -1
            });
        }
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);//スペースキーの挙動を監視
        this.characterStandVelocityY = 0;//J（主人公）のY軸速度
        this.isGrounded = true;//J（主人公）が地面にいるかどうか
        setupRunningSound(this);
        setupStageBgm(this);
        this.coyoteDistance = this.textures.get('block').getSourceImage().height / 2;
        this.coyoteGroundY = this.characterStand.y;
        this.coyoteJumpAvailable = true;
        this.hiddenBlockHintRange = 300;//隠しブロックが半透明で見え始める距離（px）
        this.hiddenBlockHintAlpha = 0.5;//見え始めた隠しブロックの透明度

        // カメラ
        const cam = this.cameras.main;
        cam.setBounds(0, 0, this.worldWidth, this.scale.height);
        cam.startFollow(this.characterStand, true, 0.1 , 0.1);
        cam.setFollowOffset(-300, 0);

        this.isCapturing = false;
        this.isForcingHome = false;
        // バグ発生時の緊急脱出：Pキーでいつでもホームへ戻る（記録は変更しない）
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P).on('down', () => this.forceReturnHome());
    }

    forceReturnHome() {
        if (this.isForcingHome) {
            return;
        }
        this.isForcingHome = true;
        this.scene.start('Home');
    }

    update(time,delta) {
        if (this.isCapturing) {
            return;
        }
        const deltaSeconds = delta / 1000;//デルタタイムを秒に変換
        if (this.isGameOver) {
            this.characterStandVelocityY += this.gravity * deltaSeconds;
            this.characterStand.y += this.characterStandVelocityY * deltaSeconds;
            return;
        }
        if (this.isLeaving) {
            // 出ていく最中は操作を受け付けず、右へ歩き続ける
            this.characterStand.x += this.moveSpeed * deltaSeconds;
            return;
        }
        const previousCharacterX = this.previousCharacterX;
        this.elapsedSeconds += deltaSeconds;
        this.timeText.setText(`Time: ${this.elapsedSeconds.toFixed(1)}`);
        this.updateStarInvincibleText();
        this.run(deltaSeconds);
        this.resolveHorizontalBlockCollisions(previousCharacterX);
        if (this.characterStand.x > this.worldWidth) {
            this.leaveStage();
        }

        // ジャンプ入力（地面、または足場からの落下距離がブロック半分以内ならジャンプできる）
        if (this.isGrounded) {
            this.coyoteGroundY = this.characterStand.y;
            this.coyoteJumpAvailable = true;
        } else if (this.characterStandVelocityY < 0) {
            this.coyoteJumpAvailable = false;//ジャンプ・踏みつけ・ダメージで上昇中は猶予なし
        } else {
            if (this.characterStand.y - this.coyoteGroundY > this.coyoteDistance) {
                this.coyoteJumpAvailable = false;
            }
        }
        const wasGrounded = this.isGrounded;
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && !isPitInputBlocked(this)) {
            if (this.coyoteJumpAvailable) {//地面にいるか、許容距離内で足場から落ちた場合
                this.characterStandVelocityY = -this.jumpSpeed;//ジャンプ速度を設定
                this.sound.play('jumpTakeoff');
                this.isDamageKnockback = false;
                this.sound.play('jumpAir');
                this.isGrounded = false;//地面から離れたことを示す
                this.coyoteJumpAvailable = false;
            }
        }
        this.isGrounded = false;

        // Y方向の移動と空中オブジェクトとの判定
        this.previousCharacterY = this.characterStand.y;
        const previousHeadTopY = this.previousCharacterY - this.playerHalfHeight;

        this.characterStandVelocityY += this.gravity * deltaSeconds;//重力を適用
        this.characterStand.y += this.characterStandVelocityY * deltaSeconds;//Y軸の位置を更新

        const characterBounds = this.characterStand.getBounds();//キャラクターのバウンディングボックスを取得
        for (const { block: platform, bounds: platformBounds } of this.solidBlockBounds) {
            const overlapsX =
                characterBounds.right > platformBounds.left &&
                characterBounds.left < platformBounds.right;
            const isCollidingWithPlatform = this.isHitFromAbove(platform) &&
                (!platform.getData('hiddenBlock') || platform.getData('revealed'));

            const isCollidingWithHead =
                this.characterStand.y < this.previousCharacterY &&
                previousHeadTopY >= platformBounds.bottom &&
                this.characterStand.y - this.playerHalfHeight <= platformBounds.bottom &&
                overlapsX;

            if (isCollidingWithHead) {
                this.sound.stopByKey('jumpAir');
                this.sound.play('blockHit');
                this.characterStand.y = platformBounds.bottom + this.playerHalfHeight;
                this.characterStandVelocityY = 0;
                if (platform.getData('hiddenBlock') && !platform.getData('revealed')) {
                    platform.getData('hiddenGroup').forEach(block => {
                        this.tweens.killTweensOf(block);
                        block.setVisible(true).setAlpha(1).setData('revealed', true);
                    });
                    const tangye = this.placeTangye(
                        platformBounds.centerX,
                        platformBounds.top
                    );
                    tangye.y = platformBounds.top - tangye.displayHeight / 2;
                    this.itemPreviousPositions.set(tangye, { x: tangye.x, y: tangye.y });
                }
            }

            if (isCollidingWithPlatform) {
                this.sound.stopByKey('jumpAir');
                this.characterStand.y = platformBounds.top - this.playerHalfHeight;
                this.characterStandVelocityY = 0;
                this.isGrounded = true;
            }
        }
        this.resolveHorizontalBlockCollisions(previousCharacterX);

        // 地面への着地（落とし穴の上では着地しない）
        const isOverPit = this.pits.some(pit => this.characterStand.x > pit.left && this.characterStand.x < pit.right);
        if (!isOverPit && this.characterStand.y >= this.characterStandBaseY && this.characterStand.y - this.characterStandVelocityY * deltaSeconds <= this.characterStandBaseY) {//地面に着地した場合
            this.characterStand.y = this.characterStandBaseY;//Y軸を地面の位置に固定
            this.characterStandVelocityY = 0;//Y軸速度をリセッな
            this.isGrounded = true;//地面にいることを示す
        }

        this.updateHiddenBlockVisibility();
        if (!wasGrounded && this.isGrounded) {
            this.isDamageKnockback = false;
            this.sound.stopByKey('jumpAir');
            this.sound.play('jumpLand');
        }
        this.updateMovers(deltaSeconds);
        this.updateEnadori(deltaSeconds);
        this.resolveItemCollisions();

        // 落とし穴に落ちた（画面の下に出た）場合
        if (this.characterStand.y - this.playerHalfHeight > this.scale.height) {
            this.fallIntoPit();
        }

        // アイテム取得判定
        const playerBounds = this.characterStand.getBounds();
        this.tangyeGroup.getChildren().slice().forEach(tangye => {
            const isTouching = Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, tangye.getBounds());
            if (tangye.getData('awaitingSeparation')) {
                if (!isTouching) {
                    tangye.setData('awaitingSeparation', false);
                }
                return;
            }
            if (isTouching) {//J（主人公）とタン・イーが衝突した場合
                this.sound.stopByKey('jumpAir');
                if (tangye.getData('moving')) {//動くタン・イーに当たった
                    this.characterStandVelocityY = -this.jumpSpeed;//当たったら自動で跳ね上がる
                } else if (this.characterStandVelocityY > 0 && this.characterStand.y + this.playerHalfHeight <= tangye.y) {
                    this.characterStandVelocityY = -this.jumpSpeed;//落下中に上から踏んだら跳ね上がる
                }
                this.runTangyeCount += 1;
                this.sound.play('tangyeCollect');
                tangye.destroy();//タン・イーを消す（グループからも自動で外れる）
                this.tangyeCount = this.runTangyeCount;
                this.updateTangyeCountDisplay();
            }
        });



        const playerGetDamage = this.characterStand.getBounds();
        this.AkatenGroup.getChildren().slice().forEach(akaten => {
            if (Phaser.Geom.Intersects.RectangleToRectangle(playerGetDamage, akaten.getBounds())) {//J（主人公）とアカテンが衝突した場合
                if (akaten.getData('moving') && !this.isDamageKnockback && this.isHitFromAbove(akaten, true)) {
                    this.sound.stopByKey('jumpAir');
                    this.sound.play('gradeStomp');
                    akaten.setTexture('tangye');
                    akaten.setScale(0.2);
                    akaten.setData('moving', false);
                    akaten.setData('awaitingSeparation', true);
                    this.tweens.killTweensOf(akaten);
                    this.AkatenGroup.remove(akaten, false, false);
                    this.tangyeGroup.add(akaten);
                    this.registerStomp();
                    this.characterStandVelocityY = -this.jumpSpeed;
                    if(this.life < this.maxLife) {
                        this.life = Math.min(this.life + 1, this.maxLife);
                        this.updateLifeDisplay();
                    }
                }else if (akaten.getData('moving')) {//動くアカテンに当たった
                    this.sound.stopByKey('jumpAir');
                    if (!this.isDamageImmune()) {
                        this.showDamageCause('akaten', akaten);
                        this.sound.play('akatenHit');
                        this.getDamage(0);
                    }
                }
            }
        });

        this.AotenGroup.getChildren().slice().forEach(aoten => {
            if (Phaser.Geom.Intersects.RectangleToRectangle(playerGetDamage, aoten.getBounds())) {//J（主人公）とアオテンが衝突した場合
                if (aoten.getData('moving') && !this.isDamageKnockback && this.isHitFromAbove(aoten, true)) {
                    this.sound.stopByKey('jumpAir');
                    this.sound.play('gradeStomp');
                    aoten.setTexture('tangye');
                    aoten.setScale(0.2);
                    aoten.setData('moving', false);
                    aoten.setData('awaitingSeparation', true);
                    this.tweens.killTweensOf(aoten);
                    this.AotenGroup.remove(aoten, false, false);
                    this.tangyeGroup.add(aoten);
                    this.registerStomp();
                    this.characterStandVelocityY = -this.jumpSpeed;
                    if(this.life < this.maxLife) {
                        this.life = Math.min(this.life + 1, this.maxLife);
                        this.updateLifeDisplay();
                    }
                }else if (aoten.getData('moving')) {//動くアオテンに当たった
                    this.sound.stopByKey('jumpAir');
                    if (!this.isDamageImmune()) {
                        this.showDamageCause('aoten', aoten);
                        this.sound.play('aotenHit');
                        this.getAoten();
                    }
                }
            }
        });

        // レポート・エナドリ：上から踏むと消えて跳ね上がり、横や下から当たるとダメージ
        this.reportGroup.getChildren().slice().forEach(report => this.        handleStompableContact(report, playerGetDamage, 'report'));
                this.enadoriGroup.getChildren().slice().forEach(enadori => this.handleStompableContact(enadori, playerGetDamage, 'enadori'));
        if (!this.isPitRespawnProtected) {
            this.departmentDamageGroup.getChildren().slice().forEach(item => this.handleStompableContact(item, playerGetDamage, 'departmentDamage'));
        }

        // 地面のスクロール
        this.leftXText.setText(`X: ${Math.round(this.cameras.main.scrollX)}`);
        this.previousCharacterX = this.characterStand.x;
    }

    // 上から踏むと消滅してジャンプ、横や下から当たるとダメージを受けて相手は消える
    handleStompableContact(target, playerBounds, kind) {
        if (!Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, target.getBounds())) {
            return;
        }
        this.sound.stopByKey('jumpAir');
        if (this.isHitFromAbove(target, true)) {
            this.sound.play('itemStomp');
            target.destroy();
            this.registerStomp();
            this.characterStandVelocityY = -this.jumpSpeed * 1.2;
        } else if (!this.isDamageImmune()) {
            this.showDamageCause(kind, target);
            if (kind === 'report') {
                this.sound.play('reportHit');
            } else if (kind === 'enadori') {
                this.sound.play('enadoriHit');
            } else if (kind === 'departmentDamage') {
                this.sound.play('semicolonHit');
            }
            this.getDamage(0);
            target.destroy();
        }
    }

    // ダメージを受けたときに画面上部へ出すメッセージ。オブジェクトの種類ごとに自由に書き換えられる
    damageMessages = {
        akaten: '赤点を取ってしまった...',
        aoten: '青点... ライフが2減った...',
        report: '理不尽レポートを喰らった',
        enadori: 'カフェインの過剰摂取！寝なさい！',
        departmentDamage: '情報工学科の専用アイテムにぶつかった！',
    };

    // 画面上部に、ダメージを受けた相手のメッセージを一定時間表示する
    // 個体ごとに変えたいときは、その個体に setData('damageMessage', '…') を設定すると優先される
    showDamageCause(kind, target) {
        const message = target?.getData('damageMessage') ?? this.damageMessages[kind] ?? `${kind}にぶつかった！`;
        this.damageCauseTimer?.remove(false);
        this.damageCauseText.setText(message).setVisible(true);
        this.damageCauseTimer = this.time.delayedCall(2000, () => {
            this.damageCauseText.setVisible(false);
        });
    }

    run(deltaSeconds) {
        if (isPitInputBlocked(this)) {
            this.characterStand.anims.stop();
            return;
        }
        if (this.isDamageShowing) {
            return;
        }
        if (this.mustReleaseMovementKeys) {
            if (this.cursors.left.isDown || this.cursors.right.isDown) {
                return;
            }
            this.mustReleaseMovementKeys = false;
        }

        let direction = 0;
        if (this.cursors.right.isDown) {
            direction = 1;
        } else if (this.cursors.left.isDown) {
            direction = -1;
        }

        if (direction !== 0) {
            this.characterStand.x += direction * this.moveSpeed * deltaSeconds;
            this.characterStand.setFlipX(direction < 0);
            if (!this.isDamageShowing && !this.characterStand.anims.isPlaying) {
                this.characterStand.play('JohoRun');
            }
        } else if (!this.isDamageShowing) {
            this.characterStand.anims.stop();
            this.characterStand.setTexture('JohocharacterStand');
        }

        this.characterStand.x = Phaser.Math.Clamp(
            this.characterStand.x,
            this.characterStand.displayWidth / 2,
            Infinity//右端は制限しない（超えたらステージを出る）
        );
    }

    // カメラを1画面ずつ動かして撮影し、横につなげて1枚のPNGにする
    captureWholeStage() {
        if (this.isCapturing) {
            return;
        }
        this.isCapturing = true;

        const cam = this.cameras.main;
        const viewW = this.scale.width;
        const viewH = this.scale.height;
        const maxScrollX = this.worldWidth - viewW;
        const savedScrollX = cam.scrollX;
        const hudTexts = [this.tangyeCountText, this.tangyeCountIcon, ...this.lifeIcons, this.leftXText, this.timeText, this.damageCauseText, this.stompCountText, this.starInvincibleText];

        cam.stopFollow();
        const hudVisibility = hudTexts.map(text => text.visible);
        hudTexts.forEach(text => text.setVisible(false));

        const canvas = document.createElement('canvas');
        canvas.width = this.worldWidth;
        canvas.height = viewH;
        const ctx = canvas.getContext('2d');

        const finish = () => {
            hudTexts.forEach((text, i) => text.setVisible(hudVisibility[i]));
            cam.startFollow(this.characterStand, true, 0.1, 0.1);
            cam.setFollowOffset(-300, 0);
            cam.scrollX = savedScrollX;
            this.isCapturing = false;

            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = 'stage.png';
            a.click();
        };

        const captureAt = scrollX => {
            cam.scrollX = scrollX;
            // 描画に反映されてから撮影する
            this.game.events.once('postrender', () => {
                this.game.renderer.snapshot(image => {
                    const draw = () => {
                        ctx.drawImage(image, scrollX, 0);
                        if (scrollX >= maxScrollX) {
                            finish();
                        } else {
                            captureAt(Math.min(scrollX + viewW, maxScrollX));
                        }
                    };
                    if (image.complete) {
                        draw();
                    } else {
                        image.onload = draw;
                    }
                });
            });
        };

        captureAt(0);
    }

    // 取得数の数字を更新し、画像を数字の左隣に置く
    updateTangyeCountDisplay() {
        this.tangyeCountText.setText(`${this.tangyeCount}/40`);
        this.tangyeCountIcon.x = this.tangyeCountText.x - this.tangyeCountText.width - 10 - this.tangyeCountIcon.displayWidth / 2;
    }

    // 残りライフ分の画像は通常表示、失った分は薄く表示する
    updateLifeDisplay() {
        this.lifeIcons.forEach((icon, i) => icon.setAlpha(i < this.life ? 1 : 0.25));
    }

    // 落とし穴を [左端X, 幅] の一覧で指定する。3個。穴の部分だけ地面を作らない
    placeAllPits() {
        const pits = [
            [700, 1600],[3500,1280],[6500,150],[8300,400],[9100,800]
        ];
        pits.forEach(([x, width]) => this.pits.push({ left: x, right: x + width }));

        // 穴と穴の間に地面を作る（ワールド座標に固定。模様がずれないよう tilePositionX を揃える）
        let segmentLeft = 0;
        const boundaries = [...this.pits.map(pit => [pit.left, pit.right]), [this.worldWidth, this.worldWidth]];
        boundaries.forEach(([pitLeft, pitRight]) => {
            this.placeGroundSegment(segmentLeft, pitLeft);
            segmentLeft = pitRight;
        });
    }

    placeGroundSegment(left, right) {
        const width = right - left;
        if (width <= 0) {
            return;
        }
        const ground = this.add.tileSprite(left, this.groundY, width, this.groundHeight, 'ground1').setOrigin(0, 0);
        ground.tilePositionX = left;
    }


    // 指定した中心座標に、block-oneを横に並べて空中ブロックを配置する
    placePlatform(x, y, blockCount = 8) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(blockCount) || blockCount < 1) {
            throw new RangeError('placePlatform requires finite coordinates and a positive integer blockCount');
        }

        const blockWidth = this.textures.get('block').getSourceImage().width;
        const blocks = [];
        for (let i = 0; i < blockCount; i++) {
            const block = this.add.image(
                x - (blockCount * blockWidth) / 2 + (i + 0.5) * blockWidth,
                y,
                'block'
            );
            this.platformGroup.add(block);
            blocks.push(block);
        }
        return blocks;
    }

    // 底辺の左端座標とブロック数を指定して、縦に壁を配置する
    placeWall(x, y, blockCount) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(blockCount) || blockCount < 1) {
            throw new RangeError('placeWall requires finite coordinates and a positive integer blockCount');
        }

        const blockTexture = this.textures.get('block').getSourceImage();
        const blocks = [];
        for (let i = 0; i < blockCount; i++) {
            const block = this.add.image(
                x + blockTexture.width / 2,
                y - (i + 0.5) * blockTexture.height,
                'block'
            );
            this.wallGroup.add(block);
            blocks.push(block);
        }
        return blocks;
    }

    // 隠しブロックを横にblockCount個並べて配置する。どれを叩いても全体が現れ、タン・イーは1個だけ出る
    placeHiddenBlock(x, y, blockCount = 3) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(blockCount) || blockCount < 1) {
            throw new RangeError('placeHiddenBlock requires finite coordinates and a positive integer blockCount');
        }

        const blockWidth = this.textures.get('block').getSourceImage().width;
        const blocks = [];
        for (let i = 0; i < blockCount; i++) {
            const block = this.add.image(
                x - (blockCount * blockWidth) / 2 + (i + 0.5) * blockWidth,
                y,
                'block'
            ).setVisible(false);
            block.setData('hiddenBlock', true);
            block.setData('revealed', false);
            block.setData('hiddenGroup', blocks);
            this.platformGroup.add(block);
            blocks.push(block);
        }
        return blocks;
    }

    // 隠しブロック：一度中心から一定距離以内に近づいたら、離れても半透明表示を維持する
    updateHiddenBlockVisibility() {
        this.platformGroup.getChildren().forEach(block => {
            if (!block.getData('hiddenBlock') || block.getData('revealed')) {
                return;
            }
            const distance = Phaser.Math.Distance.Between(this.characterStand.x, this.characterStand.y, block.x, block.y);
            if (distance <= this.hiddenBlockHintRange && !block.visible) {
                block.setVisible(true).setAlpha(0);
                this.tweens.add({
                    targets: block,
                    alpha: this.hiddenBlockHintAlpha,
                    duration: 500
                });
            }
        });
    }

    placeAllHiddenBlocks() {
        // [x座標, y座標, 横に並べる個数]
        const hiddenBlocks = [
            [450, this.groundY - 330, 3],[2800,50,5],[3302.5, 397.5, 3],
        ];
        hiddenBlocks.forEach(([x, y, blockCount]) =>
            this.placeHiddenBlock(x, y, blockCount));
    }

    resolveHorizontalBlockCollisions(previousX) {
        const deltaX = this.characterStand.x - previousX;
        if (deltaX === 0) {
            return;
        }

        const playerBounds = this.characterStand.getBounds();
        const solidBlocks = [...this.platformGroup.getChildren(), ...this.wallGroup.getChildren()];
        for (const block of solidBlocks) {
            if (block.getData('hiddenBlock') && !block.getData('revealed')) {
                continue;
            }
            const blockBounds = block.getBounds();
            const overlapsY = playerBounds.bottom > blockBounds.top && playerBounds.top < blockBounds.bottom;
            if (!overlapsY) {
                continue;
            }

            if (deltaX > 0 && previousX < blockBounds.right &&
                playerBounds.right > blockBounds.left) {
                this.characterStand.x = blockBounds.left - playerBounds.width / 2;
                this.sound.stopByKey('jumpAir');
                return;
            }
            if (deltaX < 0 && previousX > blockBounds.left &&
                playerBounds.left < blockBounds.right) {
                this.characterStand.x = blockBounds.right + playerBounds.width / 2;
                this.sound.stopByKey('jumpAir');
                return;
            }
        }
    }

    // 赤点・青点・レポートを動かす。ブロックに当たると進む向きを反転する
    updateMovers(deltaSeconds) {
        const movers = [
            ...this.AkatenGroup.getChildren(),
            ...this.AotenGroup.getChildren(),
            ...this.reportGroup.getChildren(),
            ...this.departmentDamageGroup.getChildren(),
        ];
        const angularSpeed = Math.PI / 1.5;//1.5秒で端から端まで（Sine.easeInOutの往復と同じ）

        movers.forEach(item => {
            const swing = item.getData('swing');
            if (!swing || !item.getData('moving')) {
                return;
            }

            const nextPhase = swing.phase + swing.direction * angularSpeed * deltaSeconds;
            const bounds = item.getBounds();
            const offset = swing.range * Math.cos(nextPhase);
            const nextX = swing.axis === 'vertical' ? swing.centerX : swing.centerX - offset;
            const nextY = swing.axis === 'vertical' ? swing.centerY - offset : swing.centerY;
            const halfWidth = bounds.width / 2;
            const halfHeight = bounds.height / 2;
            const hitsBlock = this.solidBlockBounds.some(({ bounds: blockBounds }) => {
                return nextX + halfWidth > blockBounds.left &&
                    nextX - halfWidth < blockBounds.right &&
                    nextY + halfHeight > blockBounds.top &&
                    nextY - halfHeight < blockBounds.bottom;
            });

            if (hitsBlock) {
                swing.direction *= -1;
                return;
            }
            swing.phase = nextPhase;
            item.x = nextX;
            item.y = nextY;
        });
    }

    resolveItemCollisions() {
        const items = [
            ...this.tangyeGroup.getChildren(),
            ...this.AkatenGroup.getChildren(),
            ...this.AotenGroup.getChildren(),
            ...this.reportGroup.getChildren(),
            ...this.departmentDamageGroup.getChildren(),
        ];

        items.forEach(item => {
            const previous = this.itemPreviousPositions.get(item) ?? { x: item.x, y: item.y };
            let currentBounds = item.getBounds();
            const halfWidth = currentBounds.width / 2;
            const halfHeight = currentBounds.height / 2;

            for (const { bounds: blockBounds } of this.solidBlockBounds) {
                const overlapsX = currentBounds.right > blockBounds.left && currentBounds.left < blockBounds.right;
                const overlapsY = currentBounds.bottom > blockBounds.top && currentBounds.top < blockBounds.bottom;
                if (!overlapsX || !overlapsY) {
                    continue;
                }

                const previousLeft = previous.x - halfWidth;
                const previousRight = previous.x + halfWidth;
                const previousTop = previous.y - halfHeight;
                const previousBottom = previous.y + halfHeight;
                const previouslyOverlapsY = previousBottom > blockBounds.top && previousTop < blockBounds.bottom;
                const previouslyOverlapsX = previousRight > blockBounds.left && previousLeft < blockBounds.right;
                const crossedFromLeft = item.x > previous.x && previousRight <= blockBounds.left && previouslyOverlapsY;
                const crossedFromRight = item.x < previous.x && previousLeft >= blockBounds.right && previouslyOverlapsY;
                const crossedFromAbove = item.y > previous.y && previousBottom <= blockBounds.top && previouslyOverlapsX;
                const crossedFromBelow = item.y < previous.y && previousTop >= blockBounds.bottom && previouslyOverlapsX;

                if (crossedFromLeft) {
                    item.x = blockBounds.left - halfWidth;
                } else if (crossedFromRight) {
                    item.x = blockBounds.right + halfWidth;
                } else if (crossedFromAbove) {
                    item.y = blockBounds.top - halfHeight;
                } else if (crossedFromBelow) {
                    item.y = blockBounds.bottom + halfHeight;
                } else {
                    const horizontalOverlap = Math.min(
                        currentBounds.right - blockBounds.left,
                        blockBounds.right - currentBounds.left
                    );
                    const verticalOverlap = Math.min(
                        currentBounds.bottom - blockBounds.top,
                        blockBounds.bottom - currentBounds.top
                    );
                    if (horizontalOverlap < verticalOverlap) {
                        item.x += currentBounds.centerX < blockBounds.centerX
                            ? -horizontalOverlap
                            : horizontalOverlap;
                    } else {
                        item.y += currentBounds.centerY < blockBounds.centerY
                            ? -verticalOverlap
                            : verticalOverlap;
                    }
                }

                currentBounds = item.getBounds();
                this.tweens.killTweensOf(item);
            }

            this.itemPreviousPositions.set(item, { x: item.x, y: item.y });
        });
    }

    // 空中ブロックの中心座標と、横に並べるblock-oneの個数
    placeAllPlatforms() {
        const platforms = [
            [800, 460, 7],[1000, 300, 7],[1200, 140, 8],[1800,140,8],[3465,572.5, 4],
            [3762.5,257.5,15],[4565,257.5,10],[4070,740,4],[6650,350,3],[8000,450,5],[8000,140,5],
            [11700,450,5],[11700,300,5],[11700,150,5]
        ];
        platforms.forEach(([x, y, blockCount]) => this.placePlatform(x, y, blockCount));
    }

    // 壁を [左端X, 底辺Y, ブロック数] の一覧で指定する。ジャンプで越えられるのは5個まで
    placeAllWalls() {
        const walls = [
            [3250, 450, 11],[3500,590,10],[4740,590,10],[5000,450,15],[7000,this.groundY, 4],
            [7500, this.groundY, 4]
        ];
        walls.forEach(([x, y, blockCount]) => this.placeWall(x, y, blockCount));
    }

    // タン・イーを1個、座標を指定して配置する
    placeTangye(x, y) {
        const tangye = this.add.image(x, y, 'tangye');
        tangye.setScale(0.2);
        this.tangyeGroup.add(tangye);
        this.itemPreviousPositions.set(tangye, { x: tangye.x, y: tangye.y });
        return tangye;
    }

    // タン・イーの座標一覧
    placeAllTangye() {
        const positions = [
            [450, 50],[2000,140],[2200,340],[2400,540],[5400,20],[5950,300],[6575,20],
            [7267.5,this.groundY-25],[8000,50],[10500,320],[10700,320],[10900,320]
        ];
        positions.forEach(([x, y]) => {
            this.placeTangye(x, y);
        });
    }

    // 上下または左右に動くタン・イーを配置する
    placeAllMoveTangye() {
        // [中心x, 中心y, 中心からの移動幅, 移動方向]。省略時は 'vertical'、左右は 'horizontal'
        const moves = [
            [1800, 650, 50 ],[2700, 460,50,'horizontal'],[2900, 340, 50,'horizontal'],[2700, 220 , 50,'horizontal' ],
            [4300, 300, 0, 'horizontal'],[4300,450,0,'horizontal'],[4300,600,0,'horizontal'],
            [5100, 400, 0, 'horizontal'],[5100,150,0,'horizontal'],[7800,500,0,'horizontal'],
            [7800,350,0,'horizontal'],[7800,200,0,'horizontal'],[9500, this.groundY-25,100,'horizontal'],
            [11400,250,0,'horizontal'],[11900,150,-50,'horizontal'],[12050,150,50,'horizontal'],[12300,150,-50,'horizontal'],
            [12450,150,50,'horizontal'],[12600,150,-50,'horizontal']
        ];
        moves.forEach(([centerX, centerY, range, axis = 'vertical'], i) => {
            const tangye = this.placeTangye(
                axis === 'horizontal' ? centerX - range : centerX,
                axis === 'horizontal' ? centerY : centerY - range
            );
            tangye.setData('moving', true);
            tangye.setScale(0.3);//動くタン・イーは少し大きくする
            this.tweens.add({
                targets: tangye,
                ...(axis === 'horizontal' ? { x: centerX + range } : { y: centerY + range }),
                duration: 1500,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: i * 100,
            });
        });
    }

    placeAkaten(x, y) {
        const Akaten = this.add.image(x, y, 'Akaten');
        Akaten.setScale(0.2);
        this.AkatenGroup.add(Akaten);
        this.itemPreviousPositions.set(Akaten, { x: Akaten.x, y: Akaten.y });
        return Akaten;
    }

    placeAllAkaten() {
        // [中心x, 中心y, 中心からの移動幅, 移動方向]。移動方向は 'horizontal' または 'vertical'
        const moves = [
            [1450, 250, 50, 'vertical'],[1650,450,50,'vertical'],[7800,50,0,'horizontal']
        ];
        moves.forEach(([centerX, centerY, range, axis = 'horizontal']) => {
            const akaten = this.placeAkaten(
                axis === 'vertical' ? centerX : centerX - range,
                axis === 'vertical' ? centerY - range : centerY
            );
            akaten.setData('moving', true);
            akaten.setScale(0.3);//動くタン・イーは少し大きくする
            akaten.setData('swing', { centerX, centerY, range, axis, phase: 0, direction: 1 });
        });
    }

    placeAoten(x, y) {
        const Aoten = this.add.image(x, y, 'Aoten');
        Aoten.setScale(0.2);
        this.AotenGroup.add(Aoten);
        this.itemPreviousPositions.set(Aoten, { x: Aoten.x, y: Aoten.y });
        return Aoten;
    }

    placeAllAoten() {
        // [中心x, 中心y, 中心からの移動幅, 移動方向]。移動方向は 'horizontal' または 'vertical'
        const moves = [
            [4887.5, 350, 60, 'horizontal'],[10300,this.groundY-25,50,'horizontal'],[12700,500,50,'vertical']
        ];
        moves.forEach(([centerX, centerY, range, axis = 'horizontal']) => {
            const aoten = this.placeAoten(
                axis === 'vertical' ? centerX : centerX - range,
                axis === 'vertical' ? centerY - range : centerY
            );
            aoten.setData('moving', true);
            aoten.setScale(0.3);//動くタン・イーは少し大きくする
            aoten.setData('swing', { centerX, centerY, range, axis, phase: 0, direction: 1 });
        });
    }

    // レポートを1個配置する。移動方向は 'horizontal' または 'vertical'
    placeReport(centerX, centerY, range, axis = 'horizontal') {
        const report = this.add.image(
            axis === 'vertical' ? centerX : centerX - range,
            axis === 'vertical' ? centerY - range : centerY,
            'report1'
        );
        report.setScale(0.5);//レポートのサイズ（元画像108×88）
        report.setData('moving', true);
        report.setData('swing', { centerX, centerY, range, axis, phase: 0, direction: 1 });
        this.reportGroup.add(report);
        this.itemPreviousPositions.set(report, { x: report.x, y: report.y });
        return report;
    }

    // レポートの一覧。[中心x, 中心y, 移動幅, 移動方向]。省略時は 'horizontal'、上下は 'vertical'
    placeAllReports() {
        const reports = [
            [1800, 100, 140,],[3762.5, 210, 245],[5400,500,50],[5400,300,-50],[5400,100,50],
            [5800,300,200,'vertical'],[6100,300,-200,'vertical'],[6575,500,30,'vertical'],
            [6575,200,30,'vertical'],[8200,350,10,'horizontal'],[8500,this.groundY-300,50,'vertical'],
            [10500, 220,100,'vertical'],[10700,320,300,'horizontal'],[10700,220,100,'vertical'],[10900,220,100,'vertical']
        ];
        reports.forEach(([centerX, centerY, range, axis]) => this.placeReport(centerX, centerY, range, axis));
    }

    // 学科専用damageアイテムの一覧。[中心x, y, 左右の移動幅]
    placeAllDepartmentDamage() {
        const items = [
            [450, this.groundY-15, 50, '見つけられないエラー：セミコロン抜け'],
            [800,424,122.5, '見つけられないエラー：セミコロン抜け'],
            [1000,264,-122.5, '見つけられないエラー：セミコロン抜け'],
            [1200,104,140, '見つけられないエラー：セミコロン抜け'],
            [5950,500,150, '見つけられないエラー：セミコロン抜け'],
            [5950,100,-150, '見つけられないエラー：セミコロン抜け'],
            [7167.5, this.groundY-15, -50, '見つけられないエラー：セミコロン抜け'],
            [7367.5, this.groundY-15, 50, '見つけられないエラー：セミコロン抜け'],
            [10300, this.groundY-250, 50, '見つけられないエラー：セミコロン抜け'],
            [11400,100,0, '見つけられないエラー：セミコロン抜け']
        ];
        items.forEach(([centerX, y, range, damageMessage]) => {
            const item = this.add.image(centerX - range, y, 'JohoDamageItem');
            const image = this.textures.get('JohoDamageItem').getSourceImage();
            item.setScale(Math.min(35 / image.width, 27.5 / image.height));
            item.setData('moving', true);
            item.setData('damageMessage', damageMessage);
            item.setData('swing', { centerX, centerY: y, range, axis: 'horizontal', phase: 0, direction: 1 });
            this.departmentDamageGroup.add(item);
            this.itemPreviousPositions.set(item, { x: item.x, y: item.y });
        });
    }

    // エナドリを1個配置する。左へ転がり続け、ときどき跳ねる。x, yは判定用の箱の中心
    placeEnadori(x, y) {
        const hitSize = 40;//判定用の箱の大きさ（回転しても変わらない）
        const body = this.add.rectangle(x, y, hitSize, hitSize).setVisible(false);
        const sprite = this.add.image(x, y, 'enadori1').setScale(0.5);//見た目（元画像40×104）
        body.setData('sprite', sprite);
        body.setData('direction', -1);//-1: 左へ進む
        body.setData('velocityY', 0);
        body.setData('grounded', true);
        body.setData('hopTimer', Phaser.Math.FloatBetween(1, 2.5));
        body.once('destroy', () => sprite.destroy());
        this.enadoriGroup.add(body);
        return body;
    }

    // エナドリの一覧。[x, y]。yを省略すると地面の上に置く
    placeAllEnadori() {
        const enadori = [
            [3000]
        ];
        enadori.forEach(([x, y]) => this.placeEnadori(x, y ?? this.groundY - 20));
    }

    // エナドリを一定間隔で自動生成する。設定はここで変える
    startEnadoriSpawner() {
        const spawn = {
            interval: 7000,//生成間隔（ミリ秒）
            maxCount: 8,//同時に存在できる最大数
            marginRight: 100,//画面の右端からこの距離だけ外側に出す
        };
        this.enadoriSpawnTimer = this.time.addEvent({
            delay: spawn.interval,
            loop: true,
            callback: () => {
                if (this.isGameOver || this.isLeaving || this.isCapturing) {
                    return;
                }
                if (this.enadoriGroup.getLength() >= spawn.maxCount) {
                    return;
                }
                const cam = this.cameras.main;
                const x = cam.scrollX + this.scale.width + spawn.marginRight;
                const isOverPit = this.pits.some(pit => x > pit.left && x < pit.right);
                if (x > this.worldWidth || isOverPit) {//ステージの外や落とし穴の上には出さない
                    return;
                }
                this.placeEnadori(x, this.groundY - 20);
            }
        });
    }

    // エナドリを転がして左へ進め、一定間隔で跳ねさせる。壁にぶつかると向きが逆になる
    updateEnadori(deltaSeconds) {
        const rollSpeed = 200;//横移動の速さ(px/秒)
        const hopSpeed = 800;//跳ね上がる初速
        this.enadoriGroup.getChildren().slice().forEach(body => {
            const sprite = body.getData('sprite');
            const halfWidth = body.displayWidth / 2;
            const halfHeight = body.displayHeight / 2;
            let direction = body.getData('direction');
            let velocityY = body.getData('velocityY');
            let grounded = body.getData('grounded');

            // 横移動（壁に当たったら向きを反転）
            const nextX = body.x + direction * rollSpeed * deltaSeconds;
            const hitsWall = this.solidBlockBounds.some(({ bounds: blockBounds }) => {
                return body.y + halfHeight > blockBounds.top && body.y - halfHeight < blockBounds.bottom &&
                    nextX + halfWidth > blockBounds.left && nextX - halfWidth < blockBounds.right;
            });
            if (hitsWall) {
                direction *= -1;
            } else {
                body.x = nextX;
            }

            // ときどき跳ねる
            let hopTimer = body.getData('hopTimer');
            if (grounded) {
                hopTimer -= deltaSeconds;
                if (hopTimer <= 0) {
                    velocityY = -hopSpeed;
                    hopTimer = Phaser.Math.FloatBetween(1, 3);
                }
            }
            body.setData('hopTimer', hopTimer);

            // 重力と着地（地面と足場の上。落とし穴の上では着地しない）
            const previousBottom = body.y + halfHeight;
            velocityY += this.gravity * deltaSeconds;
            body.y += velocityY * deltaSeconds;
            const currentBottom = body.y + halfHeight;
            grounded = false;
            const landOn = surfaceTop => {
                body.y = surfaceTop - halfHeight;
                velocityY = 0;
                grounded = true;
            };
            const isOverPit = this.pits.some(pit => body.x > pit.left && body.x < pit.right);
            if (!isOverPit && velocityY >= 0 && previousBottom <= this.groundY && currentBottom >= this.groundY) {
                landOn(this.groundY);
            }
            for (const { bounds: blockBounds } of this.solidBlockBounds) {
                if (velocityY >= 0 && previousBottom <= blockBounds.top && body.y + halfHeight >= blockBounds.top &&
                    body.x + halfWidth > blockBounds.left && body.x - halfWidth < blockBounds.right) {
                    landOn(blockBounds.top);
                }
            }

            const isFarLeftOfScreen = body.x < this.cameras.main.scrollX - 300;//画面の左に抜けた
            if (body.y - halfHeight > this.scale.height + 200 || isFarLeftOfScreen) {//落とし穴に落ちた・画面の左に抜けたら消す
                body.destroy();
                return;
            }

            body.setData('direction', direction);
            body.setData('velocityY', velocityY);
            body.setData('grounded', grounded);
            sprite.setPosition(body.x, body.y);
            sprite.rotation += direction * (rollSpeed / halfHeight) * deltaSeconds;//進む向きに回転して転がる
        });
    }

    // キャラクターが上から対象に当たったかを判定する
    isHitFromAbove(target, allowUpperHalf = false) {
        const playerBounds = this.characterStand.getBounds();
        const targetBounds = target.getBounds();
        const previousBottomY = this.previousCharacterY + this.playerHalfHeight;
        const currentBottomY = this.characterStand.y + this.playerHalfHeight;
        const landingY = allowUpperHalf ? targetBounds.centerY : targetBounds.top;

        return this.characterStandVelocityY >= 0 &&
            previousBottomY <= landingY &&
            currentBottomY >= targetBounds.top &&
            playerBounds.right > targetBounds.left &&
            playerBounds.left < targetBounds.right;
    }

    // 落とし穴に落ちた：ライフを1減らし、直前の地面に戻る（ステージの最初には戻らない）
    fallIntoPit() {
        this.getDamage(1);
        lockPitRespawnInput(this);
        this.isDamageKnockback = false;
        this.characterStand.x = getGroundRespawnX(this.pits, this.characterStand.x, this.characterStand.displayWidth / 2);
        this.characterStand.y = this.characterStandBaseY;
        this.characterStandVelocityY = 0;
        this.isGrounded = true;
        this.pitRespawnProtectionTimer?.remove(false);
        this.isPitRespawnProtected = true;
        this.pitRespawnProtectionTimer = this.time.delayedCall(1500, () => {
            this.isPitRespawnProtected = false;
            this.pitRespawnProtectionTimer = null;
        });
    }

    // 上から踏みつけて無害にした回数を数え、一定回数ごとに無敵モードにする（ダメージを受けても減らない）
    registerStomp() {
        this.stompCount += 1;
        this.updateStompCountDisplay();
        if (this.stompCount % this.stompsForInvincible === 0) {
            this.startStarInvincible();
        }
    }

    updateStompCountDisplay() {
        const remaining = this.stompsForInvincible - (this.stompCount % this.stompsForInvincible);
        this.stompCountText.setText(`無敵状態までのこり${remaining}個`);
    }

    // 無敵モードの残り秒数を画面中央上部に表示する
    updateStarInvincibleText() {
        if (!this.isStarInvincible || !this.starInvincibleTimer) {
            return;
        }
        const seconds = Math.ceil(this.starInvincibleTimer.getRemainingSeconds())
            .toLocaleString('ja-JP-u-nu-fullwide', { useGrouping: false });
        this.starInvincibleText.setText(`無敵状態 のこり${seconds}秒`);
    }

    startStarInvincible() {
        this.isStarInvincible = true;
        this.damageCauseTimer?.remove(false);
        this.damageCauseText.setVisible(false);
        this.starInvincibleText.setVisible(true);
        this.stompCountText.setVisible(false);
        this.starInvincibleTimer?.remove(false);
        // 無敵モード中はキャラクターの周りを黄色で縁取りする（WebGLのときのみ）
        if (!this.starGlow && this.characterStand.preFX) {
            this.characterStand.preFX.padding = 8;
            this.starGlow = this.characterStand.preFX.addGlow(0xffff00, 6, 0, false, 0.1, 8);
            // 縁取りの強さをなめらかに増減させ、ふわっと点滅させる
            this.tweens.add({
                targets: this.starGlow,
                outerStrength: { from: 6, to: 0.5 },
                duration: 400,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
            });
        }
        this.starInvincibleTimer = this.time.delayedCall(this.starInvincibleDuration, () => {
            this.isStarInvincible = false;
            this.starInvincibleTimer = null;
            this.starInvincibleText.setVisible(false);
            this.stompCountText.setVisible(true);
            if (this.starGlow) {
                this.tweens.killTweensOf(this.starGlow);
                this.characterStand.preFX.remove(this.starGlow);
                this.starGlow = null;
            }
        });
        this.updateStarInvincibleText();
    }

    isDamageImmune() {
        return this.isInvulnerable || this.isStarInvincible || this.isPitRespawnProtected;
    }

    getDamage(from, amount = 1){
        if (from === 0 && this.isDamageImmune()) {
            return;
        }

        this.life = Math.max(this.life - amount, 0);
        this.updateLifeDisplay();
        if ((this.life > 0 || IS_SCENE_DEBUG) && from === 0) {
            this.isInvulnerable = true;
            this.isDamageShowing = true;
            this.isDamageKnockback = true;
            this.mustReleaseMovementKeys = true;
            this.characterStand.anims.stop();
            this.characterStandVelocityY = -800;
            this.characterStand.setTexture('JohocharacterDamage');
            this.damageTextureTimer = this.time.delayedCall(600, () => {
                this.isDamageShowing = false;
                this.damageTextureTimer = null;
                if (!this.isGameOver) {
                    this.characterStand.setTexture('JohocharacterStand');
                }
            });

            // 無敵時間1.5秒の間、点滅する
            if (this.blinkTimer) {
                this.blinkTimer.remove(false);
            }
            this.blinkTimer = this.time.addEvent({
                delay: 100,
                repeat: 14,
                callback: () => {
                    this.characterStand.setAlpha(this.characterStand.alpha === 1 ? 0.3 : 1);
                }
            });
            this.time.delayedCall(1500, () => {
                this.isInvulnerable = false;
                if (this.blinkTimer) {
                    this.blinkTimer.remove(false);
                    this.blinkTimer = null;
                }
                this.characterStand.setAlpha(1);
            });
        }

        if (this.life <= 0) {
            this.gameOver(from);
            return;
        }
    }

    getAoten(){
        this.getDamage(0, 2);
    }

    // ライフ0：GAME OVERを表示し、暗転して選択画面へ戻る
    gameOver(from) {
        if (this.isGameOver || IS_SCENE_DEBUG) {
            return;
        }
        this.isGameOver = true;
        this.isLeaving = true;
        this.characterStand.anims.stop();
        this.cameras.main.stopFollow();

        const showGameOverImage = () => {
            const { width, height } = this.scale;
            const img = this.add.image(width / 2, height / 2, 'gameover')
                .setScrollFactor(0)
                .setDepth(1000)
                .setAlpha(0);
            const fit = Math.max(width / img.width, height / img.height);
            img.setScale(fit);
            this.tweens.add({
                targets: img,
                alpha: 1,
                duration: 800,
                onComplete: () => {
                    this.time.delayedCall(1000, () => {
                        this.cameras.main.fadeOut(1000, 0, 0, 0);
                        this.cameras.main.once('camerafadeoutcomplete', () => {
                            this.scene.start('Home');
                        });
                    });
                }
            });
        };

        if (from === 1) {
            this.characterStand.setVisible(false);
            this.characterStandVelocityY = 0;
            showGameOverImage();
        } else {
            this.characterStand.setTexture('JohocharacterDamage').setVisible(true);
            this.characterStandVelocityY = -800;
            this.time.delayedCall(1000, () => {
                showGameOverImage();
            });
        }
    }
    // ステージ完了時に取得数の最高記録を保存し、ビット列を返す
    saveStageRecord() {
        this.stageTangyeRecord = Math.max(
            this.saveData.stages[this.stageIndex],
            this.stageTangyeRecord,
            this.runTangyeCount
        );
        this.saveData.stages[this.stageIndex] = this.stageTangyeRecord;
        this.saveData.totalTangye = this.saveData.stages.reduce((sum, count) => sum + count, 0);
        this.registry.set('saveData', this.saveData);
        return encodeSaveData(this.saveData);
    }

    completeStage() {
        this.saveStageRecord();
        console.log('[ステージクリア]', {
            学科: '情報工学科',
            クリアタイム: Number(this.elapsedSeconds.toFixed(1)),
            単位数: this.runTangyeCount
        });
        this.saveData.completedCount += 1;
        this.registry.set('saveData', this.saveData);
        return encodeSaveData(this.saveData);
    }

    // ステージの右端から出て、1秒かけて暗転しHomeへ戻る
    leaveStage() {
        if (this.isLeaving) {
            return;
        }
        this.isLeaving = true;
        this.completeStage();
        this.cameras.main.fadeOut(1000, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('Home', { fromStage: true });
        });
    }
}
