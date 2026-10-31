const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function fixture() {
    const texts = [];
    const timers = [];
    const images = [];
    let encoded = 0;
    const context = vm.createContext({
        Phaser: { Scene: class {} },
        createEmptySaveData: () => ({}),
        encodeSpell: () => { encoded++; return 'TEST-SPELL'; }
    });
    const source = fs.readFileSync(path.join(__dirname, '../src/scenes/Ending.js'), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    vm.runInContext(source + '\nglobalThis.Ending = Ending;', context);
    const scene = new context.Ending();
    const object = () => ({ setOrigin() { return this; } });
    Object.assign(scene, {
        scale: { width: 1280, height: 720 },
        cameras: { main: { setBackgroundColor() {}, fadeIn() {} } },
        registry: { get() {} },
        add: {
            image(...args) { images.push(args); return object(); },
            text(x, y, text) { texts.push(text); return object(); }
        },
        time: { delayedCall(delay, callback) { timers.push({ delay, callback }); } },
        input: { keyboard: { on(event, callback) { scene.onKey = callback; } } },
        scene: { start(key) { scene.destination = key; } }
    });
    return { scene, texts, timers, images, encoded: () => encoded };
}

test('Final clear hides the spell but keeps the logo and both return paths', () => {
    for (const keyboardReturn of [false, true]) {
        const { scene, texts, timers, images, encoded } = fixture();
        scene.create({ finalCleared: true });
        assert.equal(encoded(), 0);
        assert.deepEqual(texts, ['キーを押すと最初の画面に戻ります']);
        assert.equal(images[0][2], 'logo');
        if (keyboardReturn) {
            timers.find(timer => timer.delay === 300).callback();
            scene.onKey();
        } else {
            timers.find(timer => timer.delay === 60000).callback();
        }
        assert.equal(scene.destination, 'Title');
    }
});

test('normal exit shows the spell even when reusing Ending after a Final clear', () => {
    const { scene, texts, encoded } = fixture();
    scene.create({ finalCleared: true });
    texts.length = 0;
    scene.create({});
    assert.equal(encoded(), 1);
    assert.ok(texts.includes('ふっかつのじゅもん'));
    assert.ok(texts.includes('TEST-SPELL'));
    texts.length = 0;
    scene.create();
    assert.equal(encoded(), 2);
    assert.ok(texts.includes('TEST-SPELL'));
});
