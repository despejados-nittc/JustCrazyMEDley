const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');

const departments = ['Mechanical', 'Electrical', 'Denshi', 'Joho', 'Chemical'];

function fixture(name, count, previousRecord = 0) {
    const logs = [];
    const texts = [];
    const rectangles = [];
    const fades = [];
    const destinations = [];
    const read = file => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    const context = vm.createContext({
        URLSearchParams,
        Phaser: { Scene: class {} },
        console: { log: (...args) => logs.push(args) }
    });
    vm.runInContext(read('saveData.js') + '\n' + read('scenes/stageClearTime.js') + '\n' +
        read(`scenes/${name}.js`) + `\nglobalThis.api = {Scene: ${name}, createEmptySaveData};`, context);
    const scene = new context.api.Scene();
    const camera = new EventEmitter();
    camera.fadeOut = (...args) => fades.push(args);
    const object = () => {
        const value = {
            setOrigin() { return this; },
            setScrollFactor(factor) { this.scrollFactor = factor; return this; },
            setDepth(depth) { this.depth = depth; return this; }
        };
        return value;
    };
    const saveData = context.api.createEmptySaveData();
    const stageIndex = departments.indexOf(name);
    saveData.stages[stageIndex] = previousRecord;
    Object.assign(scene, {
        stageIndex, saveData, stageTangyeRecord: previousRecord,
        runTangyeCount: count, elapsedSeconds: 123.456, isLeaving: false,
        registry: { set(key, value) { assert.equal(key, 'saveData'); assert.equal(value, saveData); } },
        scale: { width: 1280, height: 720 },
        cameras: { main: camera },
        events: new EventEmitter(),
        input: { keyboard: new EventEmitter() },
        add: {
            rectangle(...args) {
                const value = object();
                rectangles.push({ args, value });
                return value;
            },
            text(x, y, text) {
                const value = object();
                texts.push({ text, value });
                return value;
            }
        },
        scene: { start: (...args) => destinations.push(args) }
    });
    return { scene, camera, logs, texts, rectangles, fades, destinations };
}

for (const name of departments) {
    test(`${name}: only the current 40-credit run shows its logged clear time`, () => {
        for (const count of [0, 39, 40, 41]) {
            const { scene, logs, texts, rectangles, fades, destinations } = fixture(name, count, 40);
            scene.leaveStage();
            assert.equal(scene.isLeaving, true);
            assert.equal(logs.length, 1);
            assert.equal(logs[0][0], '[ステージクリア]');
            assert.equal(logs[0][1].クリアタイム, 123.5);
            assert.equal(logs[0][1].単位数, count);
            assert.equal(scene.saveData.completedCount, 1);
            assert.equal(scene.saveData.stages[scene.stageIndex], Math.max(count, 40));
            assert.equal(destinations.length, 0);
            if (count === 40) {
                assert.equal(fades.length, 0);
                assert.equal(rectangles.length, 1);
                assert.deepEqual(rectangles[0].args, [640, 360, 1280, 720, 0x000000]);
                assert.ok(texts.some(({ text }) => text === 'フル単達成！'));
                assert.ok(texts.some(({ text }) => text === `クリアタイム：${logs[0][1].クリアタイム}秒`));
                assert.ok(texts.some(({ text }) => text === 'Enter / Space：ホームへ戻る'));
                for (const { value } of [...texts, ...rectangles]) {
                    assert.equal(value.scrollFactor, 0);
                    assert.ok(value.depth >= 1000);
                }
            } else {
                assert.equal(texts.length, 0);
                assert.equal(scene.input.keyboard.listenerCount('keydown'), 0);
                assert.deepEqual(fades, [[1000, 0, 0, 0]]);
            }
            scene.leaveStage();
            assert.equal(logs.length, 1);
            assert.equal(scene.saveData.completedCount, 1);
        }
    });

    test(`${name}: Enter or Space confirms once; repeats and other keys do not`, () => {
        for (const code of ['Enter', 'Space']) {
            const { scene, camera, fades, destinations, logs } = fixture(name, 40);
            scene.leaveStage();
            const keyboard = scene.input.keyboard;
            keyboard.emit('keydown', { code: 'ArrowRight', repeat: false });
            keyboard.emit('keydown', { code, repeat: true });
            assert.equal(fades.length, 0);
            keyboard.emit('keydown', { code, repeat: false });
            keyboard.emit('keydown', { code, repeat: false });
            assert.deepEqual(fades, [[1000, 0, 0, 0]]);
            assert.equal(destinations.length, 0);
            assert.equal(keyboard.listenerCount('keydown'), 0);
            assert.equal(scene.events.listenerCount('shutdown'), 0);
            camera.emit('camerafadeoutcomplete');
            assert.equal(destinations.length, 1);
            assert.equal(destinations[0][0], 'Home');
            assert.equal(destinations[0][1].fromStage, true);
            assert.equal(logs.length, 1);
            assert.equal(scene.elapsedSeconds, 123.456);
        }
    });

    test(`${name}: normal clear keeps automatic routing, shutdown cleans up result input`, () => {
        const normal = fixture(name, 39);
        normal.scene.leaveStage();
        normal.camera.emit('camerafadeoutcomplete');
        assert.equal(normal.destinations[0][0], 'Home');
        assert.equal(normal.destinations[0][1].fromStage, true);

        const full = fixture(name, 40);
        full.scene.leaveStage();
        full.scene.events.emit('shutdown');
        assert.equal(full.scene.input.keyboard.listenerCount('keydown'), 0);
        full.scene.input.keyboard.emit('keydown', { code: 'Enter', repeat: false });
        assert.equal(full.fades.length, 0);
    });
}
