const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');require('../docs/assets/stats.js');require('../docs/assets/data.js');
const CSV=require('../docs/assets/csv-lab.js'),S=global.Group33Stats;
let cases=0;
function ok(fn){fn();cases++;}
ok(()=>{const x=CSV.parse('\uFEFFgroup;score;note\r\n"A;B";3;"quoted ""text"""\r\nC;4;"line1\nline2"\r\n');assert.equal(x.delimiter,';');assert.equal(x.rows[0].group,'A;B');assert.equal(x.rows[0].note,'quoted "text"');assert.equal(x.rows[1].note,'line1\nline2');});
for(const t of ['x,x\n1,2','x,y\n1,2,3','x,y\n"bad,2','x,y\n1,"two"oops','x,y\n1,a"b'])ok(()=>assert.throws(()=>CSV.parse(t)));
ok(()=>assert.equal(CSV.parse('x\ty\n1\t2\n3\t4').rows.length,2));
const original=CSV.parse(fs.readFileSync(path.join(root,'docs/downloads/student-por.csv'),'utf8')).rows;
for(const [x,type] of [['studytime','categorical'],['studytime','numeric'],['failures','categorical'],['famsup','categorical']])ok(()=>{const a=CSV.analyze(original,x,'G3',type),b=S.fit(global.Group33Data.rows,x,type);assert.equal(a.included,649);assert(Math.abs(a.model.r2-b.r2)<1e-12);assert(Math.abs(a.model.p-b.p)<1e-12);});
ok(()=>{const r=[{x:'0',y:'0'},{x:'1',y:'1'},{x:'2',y:'3'},{x:'',y:'9'},{x:'3',y:''},{x:'4',y:'no'}],a=CSV.analyze(r,'x','y','numeric');assert.equal(a.included,3);assert.equal(a.excluded,3);assert(Math.abs(a.model.slope-1.5)<1e-12);assert(a.model.slopeLow<1.5&&a.model.slopeHigh>1.5);});
ok(()=>assert.throws(()=>CSV.analyze([{x:1,y:2},{x:1,y:3},{x:1,y:4}],'x','y','numeric'),/no numeric variation/));
ok(()=>assert.throws(()=>CSV.analyze([{x:1,y:2},{x:2,y:2},{x:3,y:2}],'x','y','numeric'),/no variation/));
ok(()=>assert.throws(()=>CSV.analyze(Array.from({length:21},(_,i)=>({x:i,y:i*i})),'x','y','categorical'),/20 X categories/));
ok(()=>{const r=Array.from({length:5000},(_,i)=>({x:i,y:1+2*i+(i%3)})),a=CSV.analyze(r,'x','y','numeric');assert(a.model.r2>.999);assert(Math.abs(a.model.slope-2)<.00001);});
// Extend the existing UI harness to exercise new controls without a browser.
let harness=fs.readFileSync(path.join(root,'scripts/verify_dashboard.cjs'),'utf8').split('(async()=>{')[0];
harness+='\nglobalThis.bootFinal=boot;';
const box=vm.createContext({require,__dirname:path.join(root,'scripts'),process,console,AbortController});vm.runInContext(harness,box);const b=box.bootFinal(),E=b.elements,F=b.context.Group33Final;
ok(()=>{b.app.setFilters({school:'MS'});assert.equal(b.app.read().n,226);E['start-pitch'].dispatch('click');assert.equal(b.app.read().n,649);assert(!E['pitch-view'].hidden);assert(E['pitch-content'].innerHTML.includes('guarantee'));});
ok(()=>{F.showPitch(2);assert(E['pitch-content'].innerHTML.includes('6.88'));assert(E['pitch-content'].innerHTML.includes('1.09, 3.33'));assert.equal(b.app.read().contrast.comparison,4);});
ok(()=>{F.showPitch(3);assert.equal(b.app.read().encoding,'numeric');assert(E['pitch-content'].innerHTML.includes('10.028'));});
ok(()=>{F.showPitch(4);assert.equal(b.app.read().predictor,'failures');assert(E['pitch-content'].innerHTML.includes('19.29'));});
ok(()=>{F.showPitch(7);E['pitch-run-example'].dispatch('click');assert(E['pitch-csv-result'].innerHTML.includes('6.88'));assert.equal(b.app.read().n,649);});
ok(()=>{E['csv-model'].value='numeric';E['csv-model'].dispatch('change');assert(E['csv-result'].innerHTML.includes('6.24'));E['csv-x'].value='G3';E['csv-x'].dispatch('change');assert(E['csv-result'].innerHTML.includes('different columns'));assert.equal(b.app.read().n,649);});
ok(()=>{F.closePitch();assert(E['pitch-view'].hidden);assert.equal(b.context.document.body.style.overflow,'');});
console.log(JSON.stringify({status:'passed',cases,scope:'CSV parsing, independent workspace, original-data parity, large continuous X, presentation reset and display; DOM mock only'}));
