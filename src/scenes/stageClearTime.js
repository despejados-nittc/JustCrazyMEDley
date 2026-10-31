export function returnHomeAfterStageClear(scene) {
    const returnToHome = () => {
        scene.cameras.main.once('camerafadeoutcomplete', () => {
            scene.scene.start('Home', { fromStage: true });
        });
        scene.cameras.main.fadeOut(1000, 0, 0, 0);
    };

    if (scene.runTangyeCount !== 40) {
        returnToHome();
        return;
    }

    const { width, height } = scene.scale;
    scene.add.rectangle(width / 2, height / 2, width, height, 0x000000)
        .setScrollFactor(0).setDepth(1000);
    scene.add.text(width / 2, height / 2 - 100, 'フル単達成！', {
        fontSize: '64px',
        color: '#ffff66'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    scene.add.text(width / 2, height / 2, `クリアタイム：${scene.elapsedSeconds.toFixed(1)}秒`, {
        fontSize: '48px',
        color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    scene.add.text(width / 2, height / 2 + 100, 'Enter / Space：ホームへ戻る', {
        fontSize: '28px',
        color: '#aaaaaa'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);

    let returning = false;
    const cleanup = () => scene.input.keyboard.off('keydown', onKeyDown);
    const onKeyDown = event => {
        if (returning || event.repeat || (event.code !== 'Enter' && event.code !== 'Space')) return;
        returning = true;
        cleanup();
        scene.events.off('shutdown', cleanup);
        returnToHome();
    };
    scene.input.keyboard.on('keydown', onKeyDown);
    scene.events.once('shutdown', cleanup);
}
