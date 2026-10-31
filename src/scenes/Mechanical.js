import { IS_SCENE_DEBUG, createEmptySaveData, encodeSaveData } from '../saveData.js';
import { findHazardSpawnX } from './hazardSpawn.js';
import { getGroundRespawnX, isPitInputBlocked, lockPitRespawnInput } from './pitRespawn.js';
import { setupRunningSound } from './runningSound.js';
import { setupStageBgm } from './stageBgm.js';

export class Mechanical extends Phaser.Scene {

    constructor() {
        super('Mechanical');
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
        this.load.audio('scooterHit', 'assets/ロボットを殴る1.mp3');
        this.load.image('background', 'assets/back1.png');//背景
        this.load.image('ground1', 'assets/ground1.png');//地面（チョコ）
        this.load.image('MechanicalcharacterStand', 'assets/M-stand.png');//J（主人公）
        this.load.image('MechanicalcharacterDamage', 'assets/M-damage.png');//J（主人公）
        this.load.image('MechanicalcharacterRun1', 'assets/M-run-1.png');//J（主人公）
        this.load.image('MechanicalcharacterRun2', 'assets/M-run-2.png');//J（主人公）
        this.load.image('MechanicalcharacterRun3', 'assets/M-run-3.png');//J（主人公）
        this.load.image('MechanicalcharacterRun4', 'assets/M-run-4.png');//J（主人公）
        this.load.image('tangye', 'assets/tangye.png');//タン・イー
        this.load.image('Akaten', 'assets/Akaten.png');//赤点
        this.load.image('Aoten', 'assets/Aoten.png');//青点
        this.load.image('block', 'assets/block-one.png');//壁・隠しブロック
        this.load.image('gameover', 'assets/gameover.png');
        this.load.image('life', 'assets/life.png');//ライフアイコン
        this.load.image('MechanicalDamageItem', 'assets/M-scooter.png');//機械工学科専用damageアイテム
        this.load.image('enadori1', 'assets/enadori-2.png');//エナドリ
        this.load.image('report1', 'assets/report-1.png');//レポート
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
        this.moveSpeed =600;
        this.cursors = this.input.keyboard.createCursorKeys();
        this.gravity = 3000;//重力
        this.jumpSpeed = 1100;//ジャンプ速度

        // 空中のオブジェクト 
        this.platformGroup = this.add.group();//配置した空中ブロックの管理用
        this.wallGroup = this.add.group();//壁ブロックの管理用
        this.placeAllPlatforms();//空中ブロックを配置
        this.placeAllWalls();//壁を配置

        // 収集アイテム
        this.stageIndex = 0;//このステージの番号（0 機械, 1 電気, 2 電子, 3 情報, 4 物質）
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
        this.luckyZoneText = this.add.text(this.scale.width / 2, 190, 'ラッキーゾーン！！！！！', {
            fontSize: '40px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6,
            padding: { top: 8, bottom: 8 }
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100).setVisible(false);

        this.characterStand = this.add.sprite(220, 0, 'MechanicalcharacterStand');//J（主人公）を配置
        this.characterStand.setScale(0.5) ;//J（主人公）のサイズを調整
        this.playerHalfWidth = this.characterStand.displayWidth / 2;
        this.playerHalfHeight = this.characterStand.displayHeight / 2;//判定用の高さ（画像が切り替わっても変えない）
        this.characterStandBaseY = this.groundY - this.playerHalfHeight;
        this.characterStand.y = this.characterStandBaseY;
        this.previousCharacterX = this.characterStand.x;
        this.previousCharacterY = this.characterStand.y;
        if (!this.anims.exists('MechanicalRun')) {
            this.anims.create({
                key: 'MechanicalRun',
                frames: ['MechanicalcharacterRun1', 'MechanicalcharacterRun2', 'MechanicalcharacterRun3', 'MechanicalcharacterRun4'].map(key => ({ key })),
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
        this.isCameraRaised = false;
        this.cameraHeightTween = null;
        this.returnBarrier = null;
        this.isLowerLaneLocked = false;
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
        this.resolveLowerLaneRestriction(previousCharacterX);
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

        const characterBounds = this.getPlayerCollisionBounds();
        const solidBlocks = [...this.platformGroup.getChildren(), ...this.wallGroup.getChildren()];
        for (const platform of solidBlocks) {
            const platformBounds = platform.getBounds();//空中ブロックのバウンディングボックスを取得
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

        this.resolveLowerLaneRestriction(this.characterStand.x);
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
        this.updateCameraHeight();
        this.updateReturnBarrier();
        this.leftXText.setText(`X: ${Math.round(this.cameras.main.scrollX)}`);
        this.previousCharacterX = this.characterStand.x;
    }

    resolveLowerLaneRestriction(previousX) {
        const zoneLeft = this.cameraHeightTrigger.x;
        const zoneRight = 10615 + this.textures.get('block').getSourceImage().width;
        const zoneBottom = 105;
        const bounds = this.getPlayerCollisionBounds();
        if (!this.isLowerLaneLocked &&
            !this.cameraHeightTrigger.getData('expanded') &&
            this.characterStand.x >= zoneLeft && this.characterStand.x < zoneRight &&
            bounds.top >= zoneBottom) {
            this.isLowerLaneLocked = true;
            const blockTexture = this.textures.get('block').getSourceImage();
            const blockCount = Math.ceil((zoneBottom + this.scale.height) / blockTexture.height);
            const [wall] = this.placeWall(
                zoneRight - blockTexture.width, zoneBottom, blockCount
            );
            this.fadeInWall(wall);
        }
        if (!this.isLowerLaneLocked || bounds.right <= zoneLeft ||
            bounds.left >= zoneRight || bounds.top >= zoneBottom) {
            return;
        }

        // 下レーン確定後は上ゾーンの左右と底面からの侵入だけを防ぐ。
        if (previousX + this.playerHalfWidth <= zoneLeft) {
            this.characterStand.x = zoneLeft - this.playerHalfWidth;
        } else if (previousX - this.playerHalfWidth >= zoneRight) {
            this.characterStand.x = zoneRight + this.playerHalfWidth;
        } else {
            this.characterStand.y = zoneBottom + this.playerHalfHeight;
            this.characterStandVelocityY = Math.max(0, this.characterStandVelocityY);
        }
    }

    updateReturnBarrier() {
        const blockTexture = this.textures.get('block').getSourceImage();
        const barrierLeft = 10615 - blockTexture.width + 35;
        if (this.returnBarrier || !this.cameraHeightTrigger.getData('expanded') ||
            this.characterStand.getBounds().left < barrierLeft + blockTexture.width) {
            return;
        }

        const barrierTop = 105;
        const blockCount = Math.ceil((this.groundY - barrierTop) / blockTexture.height) - 1;
        const barrierBottom = barrierTop + blockCount * blockTexture.height;
        [this.returnBarrier] = this.placeWall(
            barrierLeft,
            barrierBottom,
            blockCount
        );
        const wall = this.returnBarrier;
        const growth = { height: 1 };
        wall.setSize(wall.width, growth.height);
        wall.y = barrierBottom - growth.height;
        this.tweens.add({
            targets: growth,
            height: blockCount * blockTexture.height,
            duration: 600,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                wall.setSize(wall.width, growth.height);
                wall.y = barrierBottom - growth.height;
            }
        });
    }

    fadeInWall(wall) {
        wall.setAlpha(0);
        this.tweens.add({
            targets: wall,
            alpha: 1,
            duration: 600,
            ease: 'Sine.easeInOut'
        });
    }

    updateCameraHeight() {
        const triggerBounds = this.cameraHeightTrigger.getBounds();
        const playerBounds = this.characterStand.getBounds();
        const isAboveTrigger =
            !this.isLowerLaneLocked &&
            playerBounds.right > triggerBounds.left &&
            playerBounds.left < triggerBounds.right &&
            this.characterStand.y + this.playerHalfHeight <= this.cameraHeightTrigger.getData('cameraTriggerTop');
        if (isAboveTrigger && !this.cameraHeightTrigger.getData('expanded')) {
            const wall = this.cameraHeightTrigger;
            const bottomY = triggerBounds.bottom;
            const height = this.textures.get('block').getSourceImage().height * 10;
            wall.setSize(wall.width, height);
            wall.y = bottomY - height;
            wall.setData('expanded', true);
            this.fadeInWall(wall);
            // 伸びた壁にキャラクターが埋まらないよう、足元を上面まで持ち上げる。
            this.characterStand.y = Math.min(this.characterStand.y, wall.y - this.playerHalfHeight);
        }
        const isOnGround = this.isGrounded && this.characterStand.y === this.characterStandBaseY;
        const shouldRaise = !isOnGround && (this.isCameraRaised || isAboveTrigger);
        if (shouldRaise === this.isCameraRaised) {
            return;
        }

        this.isCameraRaised = shouldRaise;
        this.luckyZoneText.setVisible(shouldRaise);
        this.starInvincibleText.setY(shouldRaise ? 100 : 40);
        this.damageCauseText.setY(shouldRaise ? 160 : 40);
        this.updatePlayerGlow();
        const cam = this.cameras.main;
        this.cameraHeightTween?.stop();
        const height = { y: cam.scrollY };
        this.cameraHeightTween = this.tweens.add({
            targets: height,
            y: shouldRaise ? -100 : 0,
            duration: 600,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                // 上下追従で補正されないよう、境界も視点と一緒に移動する。
                cam.setBounds(0, height.y, this.worldWidth, this.scale.height);
                cam.scrollY = height.y;
            }
        });
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
            } else if (target.getData('type') === 'scooter') {
                this.sound.play('scooterHit');
            } else if (kind === 'enadori') {
                this.sound.play('enadoriHit');
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
        departmentDamage: '機械工学科の専用アイテムにぶつかった！',
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
                this.characterStand.play('MechanicalRun');
            }
        } else if (!this.isDamageShowing) {
            this.characterStand.anims.stop();
            this.characterStand.setTexture('MechanicalcharacterStand');
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
        this.cameraHeightTween?.pause();
        const hudTexts = [this.tangyeCountText, this.tangyeCountIcon, ...this.lifeIcons, this.leftXText, this.timeText, this.damageCauseText, this.stompCountText, this.starInvincibleText, this.luckyZoneText];

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
            this.cameraHeightTween?.resume();

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
            [1825, 600],[1825+1500, 600],[7200,250],[7900,150],[8350,150],[8650,150],[8950,150],[9250,150],
            [11520,300],[11920,100],[12120,100],[12320,100]
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
    placeWall(x, y, blockCount, columnCount = 1) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(blockCount) || blockCount < 1 ||
            !Number.isInteger(columnCount) || columnCount < 1) {
            throw new RangeError('placeWall requires finite coordinates and positive integer block and column counts');
        }

        const blockTexture = this.textures.get('block').getSourceImage();
        const wall = this.add.tileSprite(
            x,
            y - blockCount * blockTexture.height,
            columnCount * blockTexture.width,
            blockCount * blockTexture.height,
            'block'
        ).setOrigin(0, 0);
        this.wallGroup.add(wall);
        return [wall];
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
            [70,360,4],[10900,240,3],[11140,60,3]
        ];
        hiddenBlocks.forEach(([x, y, blockCount]) =>
            this.placeHiddenBlock(x, y, blockCount));
    }

    getPlayerCollisionBounds() {
        return new Phaser.Geom.Rectangle(
            this.characterStand.x - this.playerHalfWidth,
            this.characterStand.y - this.playerHalfHeight,
            this.playerHalfWidth * 2,
            this.playerHalfHeight * 2
        );
    }

    resolveHorizontalBlockCollisions(previousX) {
        const deltaX = this.characterStand.x - previousX;
        if (deltaX === 0) {
            return;
        }

        const playerBounds = this.getPlayerCollisionBounds();
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
        const solidBlocks = [...this.platformGroup.getChildren(), ...this.wallGroup.getChildren()];
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
            const hitsBlock = solidBlocks.some(block => {
                const blockBounds = block.getBounds();
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
        const solidBlocks = [...this.platformGroup.getChildren(), ...this.wallGroup.getChildren()];
        const items = [
            ...this.tangyeGroup.getChildren(),
            ...this.AkatenGroup.getChildren(),
            ...this.AotenGroup.getChildren(),
            ...this.reportGroup.getChildren(),
            ...this.departmentDamageGroup.getChildren(),
        ];

        items.forEach(item => {
            const previous = this.itemPreviousPositions.get(item) ?? { x: item.x, y: item.y };
            const itemBounds = item.getBounds();
            const halfWidth = itemBounds.width / 2;
            const halfHeight = itemBounds.height / 2;

            for (const block of solidBlocks) {
                const currentBounds = item.getBounds();
                const blockBounds = block.getBounds();
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

                this.tweens.killTweensOf(item);
            }

            this.itemPreviousPositions.set(item, { x: item.x, y: item.y });
        });
    }

    // 空中ブロック15個の座標一覧
    placeAllPlatforms() {
        const platforms = [
            [700, 460, 2],[900, 460, 2],
        ];
        platforms.forEach(([x, y, blockCount]) => this.placePlatform(x, y, blockCount));
    }

    // 壁を [左端X, 底辺Y, ブロック数] の一覧で指定する。ジャンプで越えられるのは5個まで
    placeAllWalls() {
        const x = 1300;
        const y = 2800;
        const z = 4000;
        const w = 10995;
        const walls = [
            [x,this.groundY,3],[x+35,this.groundY,3],[x+70,this.groundY,3],
            [x+105,this.groundY,6],[x+140,this.groundY,6],[x+175,this.groundY,6],
            [x+210,this.groundY,9],[x+245,this.groundY,9],[x+280,this.groundY,9],
            [x+315,this.groundY,12],[x+350,this.groundY,12],[x+385,this.groundY,12],
            [x+420,this.groundY,15],[x+455,this.groundY,15],[x+490,this.groundY,15],
            [y,this.groundY,3],[y+35,this.groundY,3],[y+70,this.groundY,3],
            [y+105,this.groundY,6],[y+140,this.groundY,6],[y+175,this.groundY,6],
            [y+210,this.groundY,9],[y+245,this.groundY,9],[y+280,this.groundY,9],
            [y+315,this.groundY,12],[y+350,this.groundY,12],[y+385,this.groundY,12],
            [y+420,this.groundY,15],[y+455,this.groundY,15],[y+490,this.groundY,15],
            [z+105,105,7],[z+140,105,3],[z+175,105,3],
            [z+210,210,6],[z+245,210,6],[z+280,210,6],
            [z+315,315,9],[z+350,315,9],[z+385,315,9],
            [10545,105,3],[10580,105,3],[10615,105,3],
            [10440,210,6],[10475,210,6],[10510,210,6],
            [10335,315,9],[10370,315,9],[10405,315,9],
            [w,this.groundY,3],[w+35,this.groundY,3],[w+70,this.groundY,3],[w+105,this.groundY,6],
            [w+140,this.groundY,6],[w+175,this.groundY,6],[w+210,this.groundY,9],[w+245,this.groundY,9],
            [w+280,this.groundY,9],[w+315,this.groundY,12],[w+350,this.groundY,12],[w+385,this.groundY,12],
            [w+420,this.groundY,15],[w+455,this.groundY,15],[w+490,this.groundY,15],
        ];
        for (let i = 1; i < 170; i++) {
            if(((i>=40&i<=75)|(i>=150&i<170))&(i%10==0|i%10==1|i%10==2)){
                walls.push([z+385+i*35, 420, 12],);
            }else {
                walls.push([z+385+i*35, 315, 9],);
            }
        };
        const blockWidth = this.textures.get('block').getSourceImage().width;
        const wallRuns = [];
        walls.forEach(([left, bottomY, blockCount]) => {
            const previousRun = wallRuns[wallRuns.length - 1];
            const isAdjacentRun = previousRun &&
                previousRun.bottomY === bottomY &&
                previousRun.blockCount === blockCount &&
                Math.abs(left - (previousRun.left + previousRun.columnCount * blockWidth)) < 0.001;
            if (isAdjacentRun) {
                previousRun.columnCount += 1;
            } else {
                wallRuns.push({ left, bottomY, blockCount, columnCount: 1 });
            }
        });
        wallRuns.forEach(({ left, bottomY, blockCount, columnCount }) => {
            const [wall] = this.placeWall(left, bottomY, blockCount, columnCount);
            if (left === z + 105 && bottomY === 105 && blockCount === 7) {
                this.cameraHeightTrigger = wall;
                wall.setData('cameraTriggerTop', wall.y);
            }
        });
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
            [700, 435], [700,100],[900, 435], [900,100],
            [5750,360],[6100,360],[6450,360],[6800,360],[7900,360],[8200,360],[8500,360],[8800,360],[9100,360],[9600,360],[9950,360],
            [5500,this.groundY-25],[5900,this.groundY-25],[6250,this.groundY-25],[12600,this.groundY-25],
        ];
        for (let i = 1; i <= 18; i++) {
                positions.push([4000+i*350, -25],);
        };
        positions.forEach(([x, y]) => {
            this.placeTangye(x, y);
        });
    }

    // 上下または左右に動くタン・イーを配置する
    placeAllMoveTangye() {
        // [中心x, 中心y, 中心からの移動幅, 移動方向]。省略時は 'vertical'、左右は 'horizontal'
        const moves = [
            [1335,this.groundY-300,120,'vertical'],[1545,this.groundY-510,-120,'vertical'],[1790, this.groundY-720, -120,'vertical'],
            [2125, this.groundY-600, 120, 'horizontal'],[2550, this.groundY-35, 120, 'horizontal'],
            [1335+1500,this.groundY-300,120,'vertical'],[1545+1500,this.groundY-510,-120,'vertical'],[1790+1500, this.groundY-720, -120,'vertical'],
            [2125+1500, this.groundY-600, 120, 'horizontal'],[2550+1500 , this.groundY-35, 120, 'horizontal'],
            [7600, this.groundY-35,-70,'horizontal'],[7800, this.groundY-35,70,'horizontal']
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
            [4700, 590, 500, 'horizontal'],[10970,this.groundY-35,200,'horizontal'],[11327.5,this.groundY-640,200,'vertical']
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
            [11870,this.groundY-35,0,'horizontal'],[12070,this.groundY-35,0,'horizontal'],[12270,this.groundY-35,0,'horizontal']
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
            [1440,this.groundY-405,-130,'vertical'],[1650,this.groundY-615,130,'vertical'],
            [1440+1500,this.groundY-405,-130,'vertical'],[1650+1500,this.groundY-615,130,'vertical'], 
            [6800,this.groundY-25,400,'horizontal'],[8200,this.groundY-25,150,'horizontal']
        ];
        reports.forEach(([centerX, centerY, range, axis]) => this.placeReport(centerX, centerY, range, axis));
    }

    // スクーターとエナドリは交互に出す。最初の1個はスクーター
    placeAllDepartmentDamage() {
        this.placeScooter(1500, this.groundY - 15);
        this.nextMechanicalHazard = 'enadori';
    }

    findHazardSpawnX(x, y, width, height) {
        return findHazardSpawnX(this, x, y, width, height);
    }

    placeMechanicalHazard(x, y, type) {
        const isScooter = type === 'scooter';
        const bodyWidth = isScooter ? 60 : 40;
        const bodyHeight = isScooter ? 30 : 40;
        const image = this.textures.get(isScooter ? 'MechanicalDamageItem' : 'enadori1').getSourceImage();
        const rotationDiameter = Math.hypot(image.width, image.height) * 0.5;
        const spawnX = this.findHazardSpawnX(
            x, y,
            isScooter ? bodyWidth : Math.max(bodyWidth, rotationDiameter),
            isScooter ? bodyHeight : Math.max(bodyHeight, rotationDiameter)
        );
        if (spawnX === null) {
            return null;
        }
        const body = this.add.rectangle(spawnX, y, bodyWidth, bodyHeight).setVisible(false);
        const sprite = this.add.image(spawnX, y, isScooter ? 'MechanicalDamageItem' : 'enadori1');
        sprite.setScale(isScooter ? 1.5 * Math.min(70 / image.width, 55 / image.height) : 0.5);
        if (isScooter) {
            sprite.y = body.y + body.height / 2 - sprite.displayHeight / 2;
        }
        body.setData('sprite', sprite);
        body.setData('type', type);
        body.setData('direction', -1);
        body.setData('velocityY', 0);
        body.setData('grounded', true);
        body.setData('rollSpeed', isScooter ? 120 : 200);
        if (!isScooter) {
            body.setData('hopTimer', Phaser.Math.FloatBetween(1, 2.5));
            body.setData('hopSpeed', 800);
        }
        body.setData('bobPhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
        body.setData('damageMessage', isScooter
            ? '実習で分解したバイクが暴走した...'
            : 'カフェインの過剰摂取！寝なさい！');
        body.once('destroy', () => sprite.destroy());
        this.enadoriGroup.add(body);
        return body;
    }

    placeScooter(x, y) {
        return this.placeMechanicalHazard(x, y, 'scooter');
    }

    placeEnadori(x, y) {
        return this.placeMechanicalHazard(x, y, 'enadori');
    }

    // エナドリの一覧。[x, y]。yを省略すると地面の上に置く
    placeAllEnadori() {
        const enadori = [
        ];
        enadori.forEach(([x, y]) => this.placeEnadori(x, y ?? this.groundY - 20));
    }

    // エナドリとスクーターを交互に一定間隔で自動生成する。設定はここで変える
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
                if (this.nextMechanicalHazard === 'scooter') {
                    this.placeScooter(x, this.groundY - 15);
                    this.nextMechanicalHazard = 'enadori';
                } else {
                    this.placeEnadori(x, this.groundY - 20);
                    this.nextMechanicalHazard = 'scooter';
                }
            }
        });
    }

    updateEnadori(deltaSeconds) {
        const solids = [...this.platformGroup.getChildren(), ...this.wallGroup.getChildren()];
        this.enadoriGroup.getChildren().slice().forEach(body => {
            const sprite = body.getData('sprite');
            const halfWidth = body.width / 2;
            const halfHeight = body.height / 2;
            let direction = body.getData('direction');
            let velocityY = body.getData('velocityY');
            let grounded = false;
            const nextX = body.x + direction * body.getData('rollSpeed') * deltaSeconds;
            const hitsBlock = solids.some(block => {
                const bounds = block.getBounds();
                return body.y + halfHeight > bounds.top && body.y - halfHeight < bounds.bottom &&
                    nextX + halfWidth > bounds.left && nextX - halfWidth < bounds.right;
            });
            if (hitsBlock) {
                direction *= -1;
            } else {
                body.x = nextX;
            }

            let hopTimer = body.getData('hopTimer');
            if (body.getData('type') === 'enadori' && body.getData('grounded')) {
                hopTimer -= deltaSeconds;
                if (hopTimer <= 0) {
                    velocityY = -body.getData('hopSpeed');
                    hopTimer = Phaser.Math.FloatBetween(1, 3);
                }
            }
            const previousBottom = body.y + halfHeight;
            velocityY += this.gravity * deltaSeconds;
            body.y += velocityY * deltaSeconds;
            const currentBottom = body.y + halfHeight;
            grounded = false;
            const pit = this.pits.some(item => body.x > item.left && body.x < item.right);
            if (!pit && velocityY >= 0 && previousBottom <= this.groundY && currentBottom >= this.groundY) {
                body.y = this.groundY - halfHeight;
                velocityY = 0;
                grounded = true;
            }
            for (const block of solids) {
                const bounds = block.getBounds();
                if (velocityY >= 0 && previousBottom <= bounds.top && body.y + halfHeight >= bounds.top &&
                    body.x + halfWidth > bounds.left && body.x - halfWidth < bounds.right) {
                    body.y = bounds.top - halfHeight;
                    velocityY = 0;
                    grounded = true;
                }
            }
            body.setData('direction', direction);
            body.setData('velocityY', velocityY);
            body.setData('grounded', grounded);
            if (body.getData('type') === 'enadori') {
                body.setData('hopTimer', hopTimer);
            }
            if (body.getData('type') === 'scooter') {
                const bobPhase = body.getData('bobPhase') + Math.PI * 2 * 8 * deltaSeconds;
                body.setData('bobPhase', bobPhase);
                sprite.setPosition(
                    body.x,
                    body.y + halfHeight - sprite.displayHeight / 2 + Math.sin(bobPhase) * 2.5
                );
                sprite.setRotation(0);
            } else {
                sprite.setPosition(body.x, body.y);
                sprite.rotation += direction * (body.getData('rollSpeed') / halfHeight) * deltaSeconds;
            }
            if (body.y - halfHeight > this.scale.height + 200 ||
                body.x < this.cameras.main.scrollX - 300) {
                body.destroy();
            }
        });
    }

    // キャラクターが上から対象に当たったかを判定する
    isHitFromAbove(target, allowUpperHalf = false) {
        const playerBounds = allowUpperHalf ? this.characterStand.getBounds() : this.getPlayerCollisionBounds();
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
        const pit = this.pits.find(item => this.characterStand.x >= item.left && this.characterStand.x <= item.right) ??
            this.pits.find(item =>
            this.characterStand.x > item.left - this.characterStand.displayWidth &&
            this.characterStand.x < item.right + this.characterStand.displayWidth);
        const wallBounds = this.wallGroup.getChildren().map(block => block.getBounds());
        const wallBeforePit = pit && wallBounds.filter(bounds => Math.abs(bounds.right - pit.left) <= 1);
        if (wallBeforePit?.length) {
            const wallLeft = Math.min(...wallBeforePit.map(bounds => bounds.left));
            const wallTop = Math.min(...wallBeforePit.map(bounds => bounds.top));
            this.characterStand.x = Math.min(
                pit.left - this.characterStand.displayWidth / 2,
                (wallLeft + pit.left) / 2
            );
            this.characterStand.y = wallTop - this.playerHalfHeight;
        } else {
            this.characterStand.x = getGroundRespawnX(this.pits, this.characterStand.x, this.characterStand.displayWidth / 2);
            this.characterStand.y = this.characterStandBaseY;
        }
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

    updatePlayerGlow() {
        if (!this.isStarInvincible && !this.isCameraRaised) {
            if (this.starGlow) {
                this.tweens.killTweensOf(this.starGlow);
                this.characterStand.preFX.remove(this.starGlow);
                this.starGlow = null;
            }
            return;
        }

        // 無敵モード・上のレーンでは同じ縁取りを共有する（WebGLのときのみ）。
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
    }

    startStarInvincible() {
        this.isStarInvincible = true;
        this.damageCauseTimer?.remove(false);
        this.damageCauseText.setVisible(false);
        this.starInvincibleText.setVisible(true);
        this.stompCountText.setVisible(false);
        this.starInvincibleTimer?.remove(false);
        this.updatePlayerGlow();
        this.starInvincibleTimer = this.time.delayedCall(this.starInvincibleDuration, () => {
            this.isStarInvincible = false;
            this.starInvincibleTimer = null;
            this.starInvincibleText.setVisible(false);
            this.stompCountText.setVisible(true);
            this.updatePlayerGlow();
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
            this.characterStand.setTexture('MechanicalcharacterDamage');
            this.damageTextureTimer = this.time.delayedCall(600, () => {
                this.isDamageShowing = false;
                this.damageTextureTimer = null;
                if (!this.isGameOver) {
                    this.characterStand.setTexture('MechanicalcharacterStand');
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
            this.characterStand.setTexture('MechanicalcharacterDamage').setVisible(true);
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
            学科: '機械工学科',
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
