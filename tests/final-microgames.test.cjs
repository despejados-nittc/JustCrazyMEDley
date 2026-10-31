const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
function fixture(save) {
    let now = 0;
    const context = vm.createContext({ performance: { now: () => now }, Phaser: { Scene: class {} }, createEmptySaveData: () => ({stages:[30,30,30,30,30],totalTangye:150,completedCount:5}) });
    const read = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
    vm.runInContext(read('minigames/engineering.js') + '\n' + read('minigames/drawEngineering.js') + '\n' + read('scenes/Final.js') + '\nglobalThis.api = {Final,createGame,GAMES};', context);
    const object = () => {
        const data = {};
        const proxy = new Proxy(data, { get(target,key) {
            if(key in target) return target[key];
            return (...args) => { if(key==='setText') target.text=args[0]; return proxy; };
        }});
        return proxy;
    };
    const scene = new context.api.Final();
    const keyboard = new EventEmitter(); keyboard.addCapture = () => {};
    Object.assign(scene, {
        cameras: { main: object() }, add: { rectangle: object, tileSprite: object, text: object, image: object, graphics: object },
        input: { keyboard }, game: { events: new EventEmitter() }, events: new EventEmitter(),
        registry: { save, get() { return this.save; }, set(key,value) { this.save=value; } },
        scene: { start: (key,data) => { scene.destination=key; scene.destinationData=data; } }
    });
    scene.create();
    return { scene, api: context.api, setTime: value => now=value, press: (code,repeat=false) => scene.handleKey({code,repeat}) };
}
test('all 25 microgames render and intro/result inputs are ignored', () => {
    const {scene,api,press,setTime}=fixture();
    press('Enter'); assert.equal(scene.mode,'ready');
    press('Space'); assert.equal(scene.mode,'intro');
    press('ArrowLeft'); assert.equal(scene.current.result,null);
    setTime(1901); scene.update(); assert.equal(scene.mode,'intro'); press('Space'); assert.equal(scene.mode,'playing');
    for(const game of api.GAMES) {
        scene.current=api.createGame(game.id);
        scene.renderGame();
        assert.ok(scene.drawLabels.length<50);
    }
    scene.current.result=false; scene.finishRound();
    const lives=scene.lives;
    press('Space'); scene.finishRound(); assert.equal(scene.lives,lives);
});
test('four failures lead to retry and retry resets the run', () => {
    const {scene,press}=fixture(); press('Space');
    for(let i=0;i<4;i++) { scene.mode='playing'; scene.current.result=false; scene.finishRound(); scene.nextRound(); }
    assert.equal(scene.mode,'failed'); assert.equal(scene.lives,0);
    press('Space',true); assert.equal(scene.mode,'failed');
    press('Space'); assert.equal(scene.lives,4); assert.equal(scene.roundIndex,0); assert.equal(scene.mode,'intro');
});
test('25 rounds complete the thesis directly and save exactly once', () => {
    const {scene,press}=fixture(); press('Space');
    for(let i=0;i<25;i++) { scene.mode='playing'; scene.current.result=true; scene.finishRound(); scene.nextRound(); }
    assert.equal(scene.mode,'complete'); assert.equal(scene.wins,25);
    assert.deepEqual(Array.from(scene.departmentWins),[5,5,5,5,5]);
    press('Enter'); assert.equal(scene.destination,undefined);
    assert.equal(scene.registry.save.completedCount,6);
    assert.deepEqual(scene.registry.save.stages,[30,30,30,30,30]);
    scene.completeThesis(); assert.equal(scene.registry.save.completedCount,6);
    press('Space'); assert.equal(scene.destination,'Ending');
    assert.equal(scene.destinationData.finalCleared,true);
});
test('pause preserves time, duplicate blur is harmless, shutdown removes listeners', () => {
    const {scene,press,setTime}=fixture(); press('Space');
    setTime(2000); press('Space'); scene.update();
    setTime(2500); scene.game.events.emit('blur');
    assert.equal(scene.mode,'paused');
    setTime(7500); scene.game.events.emit('hidden'); press('Space');
    assert.equal(scene.mode,'playing');
    assert.equal(scene.phaseStarted,7000);
    scene.update(); assert.equal(scene.current.elapsed,0.5);
    scene.events.emit('shutdown');
    assert.equal(scene.input.keyboard.listenerCount('keydown'),0);
    assert.equal(scene.game.events.listenerCount('blur'),0);
});

test('instruction time is unlimited and demos do not consume lives or save', () => {
    const {scene,press,setTime}=fixture(); press('Space');
    for(let t=0;t<60000;t+=100) { setTime(t); scene.update(); }
    assert.equal(scene.mode,'intro'); assert.equal(scene.lives,4); assert.equal(scene.current.elapsed,0); assert.equal(scene.registry.save,undefined);
    press('Space'); assert.equal(scene.mode,'playing');
});
test('holding movement repeats, while keyup and pause clear held keys', () => {
    const {scene,api,press,setTime}=fixture(); press('Space');
    scene.current=api.createGame('voltage'); press('Space'); press('ArrowUp');
    assert.equal(scene.current.value,1);
    setTime(300); scene.update(); assert.equal(scene.current.value,2);
    scene.input.keyboard.emit('keyup',{code:'ArrowUp'});
    setTime(600); scene.update(); assert.equal(scene.current.value,2);
    press('ArrowUp'); scene.pause(); assert.equal(scene.held.size,0);
});

test('replayed demos reset from their own template, not the live puzzle', () => {
    const {scene,press,setTime}=fixture(); press('Space');
    const live=JSON.stringify(scene.current);
    const template=JSON.stringify(scene.demoTemplate);
    assert.notEqual(template,live);
    scene.demo.result=true;
    setTime(100); scene.update();
    setTime(1300); scene.update();
    assert.equal(JSON.stringify(scene.demo,(key,value)=>key==='visualTime'?undefined:value),template);
    assert.equal(JSON.stringify(scene.current),live);
    press('Space'); assert.equal(JSON.stringify(scene.current),live);
});

test('Final applies the stage-record difficulty to every round, retry, and demo', () => {
    for(const count of [30,35,40]) {
        const save={stages:Array(5).fill(count),totalTangye:0,completedCount:2};
        const {scene,press}=fixture(save);
        assert.equal(scene.difficulty.total,count*5);
        assert.equal(scene.difficulty.challenge,(40-count)/10);
        press('Space');
        assert.deepEqual(scene.current.difficulty,scene.difficulty);
        assert.equal(scene.demoTemplate.motionScale,scene.current.motionScale);
        scene.roundIndex=10; scene.startRound();
        assert.deepEqual(scene.current.difficulty,scene.difficulty);
        scene.startRun();
        assert.equal(scene.difficulty.total,count*5);
        assert.deepEqual(save.stages,Array(5).fill(count));
    }
});
