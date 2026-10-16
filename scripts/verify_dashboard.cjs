/* Logic/event/SVG/download checks in a DOM mock; not a real-browser layout test. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'docs/index.html'),'utf8');
class Element{
 constructor(id){this.id=id;this._html='';this._value='';this.textContent='';this.events={};this.attrs={};this.style={};this.hidden=false;this.clientWidth=640;}
 get value(){return this._value;}
 set value(v){this._value=String(v);}
 set innerHTML(h){this._html=h;if(this.id==='reference'||this.id==='comparison'){this._value=h.match(/value="([^"]+)"/)?.[1]??'';}}
 get innerHTML(){return this._html;}
 addEventListener(event,fn){(this.events[event]??=[]).push(fn);}
 dispatch(event,detail={}){for(const fn of this.events[event]??[])fn({target:this,preventDefault(){},...detail});}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k];}
 focus(){this.focused=true;}
 scrollIntoView(){this.scrolled=true;}
 getBoundingClientRect(){return {x:100,y:100,width:50,height:30};}
 closest(selector){return selector==='[data-tip]'&&this.attrs['data-tip']?this:null;}
}
function boot(withMCP=false){
 const elements={};for(const match of html.matchAll(/\bid="([^"]+)"/g))elements[match[1]]=new Element(match[1]);
 const defaults={predictor:'studytime',encoding:'categorical',school:'all',sex:'all',support:'all',zeros:'include',confidence:'.95','rank-count':'8',myth:'hours','csv-model':'categorical','csv-confidence':'.95'};
 for(const [k,v] of Object.entries(defaults))elements[k].value=v;
 const events={},registered=[];
 const document={body:new Element('body'),getElementById:id=>elements[id]||(elements[id]=new Element(id)),querySelectorAll:()=>[],addEventListener:(type,fn)=>(events[type]??=[]).push(fn)};
 if(withMCP)document.modelContext={registerTool:tool=>registered.push(tool)};
 const window={innerWidth:1200,innerHeight:900,addEventListener(){}};
 const context=vm.createContext({document,window,AbortController,requestAnimationFrame:fn=>fn()});
 for(const file of ['data.js','stats.js','app.js','csv-lab.js','final.js'])vm.runInContext(fs.readFileSync(path.join(root,'docs/assets',file),'utf8'),context,{timeout:10000});
 return {elements,events,context,app:context.Group33App,registered};
}
(async()=>{
 const {elements:E,events,app,context}=boot();let x=app.read();
 assert.equal(x.n,649);assert(E.metrics.innerHTML.includes('6.88%'));assert(E['sample-status'].textContent.includes('15 zero grades'));
 assert.equal((E['grade-chart'].innerHTML.match(/class="dot"/g)||[]).length,649);
 assert.equal((E['grade-chart'].innerHTML.match(/class="mean-point"/g)||[]).length,4);
 assert(E['ranking-table'].innerHTML.includes('Past class failures'));assert(E['cv-table'].innerHTML.includes('28.22%'));
 assert(E['map-a-chart'].innerHTML.includes('19.29%'));assert(!E['map-a-chart'].innerHTML.includes('marker-end'));
 const charts={study:E['grade-chart'].innerHTML,ranking:E['ranking-chart'].innerHTML,contrast:E['contrast-chart'].innerHTML,'map-a':E['map-a-chart'].innerHTML,'map-b':E['map-b-chart'].innerHTML};
 E.predictor.value='failures';E.predictor.dispatch('change');assert(E.metrics.innerHTML.includes('19.29%'));assert.equal(app.read().n,649);
 E.encoding.value='numeric';E.encoding.dispatch('change');assert(E.metrics.innerHTML.includes('15.47%'));
 E.predictor.value='studytime';E.predictor.dispatch('change');assert(E.metrics.innerHTML.includes('6.24%'));assert(E.equation.textContent.includes('studytime code'));
 E.confidence.value='.99';E.confidence.dispatch('change');const wide=app.read().groups[0].ci;
 E.confidence.value='.90';E.confidence.dispatch('change');const narrow=app.read().groups[0].ci;assert(wide[1]-wide[0]>narrow[1]-narrow[0]);
 E.school.value='MS';E.school.dispatch('change');assert.equal(app.read().n,226);
 E.sex.value='F';E.sex.dispatch('change');assert.equal(app.read().n,146);assert.equal((E['grade-chart'].innerHTML.match(/class="dot"/g)||[]).length,146);
 E.support.value='yes';E.support.dispatch('change');assert(app.read().n<146);
 E.predictor.value='famsup';E.predictor.dispatch('change');assert(!app.read().estimable);assert(E.decision.innerHTML.includes('Test unavailable'));assert.equal(app.read().r2,null);
 E.myth.value='support';E.myth.dispatch('change');assert(E['myth-verdict'].textContent.includes('cannot test'));
 const before=JSON.stringify(app.read());assert.throws(()=>app.setFilters({school:'invented',sex:'M'}));assert.equal(JSON.stringify(app.read()),before);
 E.reset.dispatch('click');assert.equal(app.read().n,649);assert.equal(app.read().encoding,'categorical');assert(E.metrics.innerHTML.includes('6.88%'));
 E.zeros.value='exclude';E.zeros.dispatch('change');assert.equal(app.read().n,634);assert(E.metrics.innerHTML.includes('6.84%'));E.reset.dispatch('click');
 for(const v of ['hours','failure','support','prediction']){E.myth.value=v;E.myth.dispatch('change');assert(E['myth-evidence'].textContent.length>80);}
 E['rank-count'].value='30';E['rank-count'].dispatch('change');assert.equal((E['ranking-chart'].innerHTML.match(/<rect /g)||[]).length,60);assert.equal((E['ranking-table'].innerHTML.match(/<tr>/g)||[]).length,31);
 E.reference.value='1';E.comparison.value='4';E.comparison.dispatch('change');assert(E['contrast-result'].textContent.includes('+2.21'));
 E['map-tab-b'].dispatch('click');assert(E['map-a'].hidden);assert(!E['map-b'].hidden);assert.equal(E['map-tab-b'].attrs['aria-selected'],'true');
 E['map-tab-b'].dispatch('keydown',{key:'ArrowRight'});assert(!E['map-c'].hidden);assert(E['map-tab-c'].focused);charts['ml-importance']=E['ml-chart'].innerHTML;
 const fake=new Element('point');fake.attrs['data-tip']='Category 1\nMean = 10.84';events.pointerover[0]({target:fake,clientX:100,clientY:150});assert(!E.tooltip.hidden);assert(E.tooltip.textContent.includes('10.84'));events.keydown[0]({key:'Escape'});assert(E.tooltip.hidden);
 app.setFilters({school:'GP',sex:'M',support:'no',zeros:'exclude'});assert(app.read().n>0);assert.equal(app.read().groups.reduce((s,g)=>s+g.n,0),app.read().n);
 for(const el of Object.values(E))assert(!/NaN|undefined/.test(el.innerHTML+el.textContent),'Invalid display in '+el.id);
 for(const el of Object.values(E))el.clientWidth=320;E.reset.dispatch('click');charts.mobile=E['grade-chart'].innerHTML;assert(charts.mobile.includes('viewBox="0 0 320'));
 // Mock registry verifies the tool/state contract; native browser WebMCP is unavailable.
 const mcp=boot(true);assert.deepEqual(mcp.registered.map(t=>t.name),['get_analysis','set_analysis_filters','select_system_map']);
 const read=mcp.registered[0],set=mcp.registered[1],map=mcp.registered[2];assert(read.annotations.readOnlyHint);assert(!set.annotations.readOnlyHint);
 const changed=set.execute({predictor:'failures',school:'MS'});assert.equal(changed.n,226);assert.equal(mcp.elements.predictor.value,'failures');assert.equal(changed.r2,read.execute({}).r2);
 const snap=JSON.stringify(read.execute({}));assert.throws(()=>set.execute({confidence:'100%'}));assert.equal(JSON.stringify(read.execute({})),snap);
 assert.equal(map.execute({map:'c'}).active_map,'c');assert(!mcp.elements['map-c'].hidden);assert.throws(()=>map.execute({map:'z'}));
 // Every local resource exists and raw data are byte-exact.
 for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g))if(!/^(?:https?:|data:)/.test(match[1]))assert(fs.existsSync(path.join(root,'docs',match[1])),'Missing '+match[1]);
 const bytes=fs.readFileSync(path.join(root,'docs/downloads/student-por.csv'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'a7594a11d7771c0efe1a740824e0e833da9c4cad07c39a9766a874575563fb3f');
 const notebook=JSON.parse(fs.readFileSync(path.join(root,'docs/downloads/Group33_POR_Interactive_Analysis.ipynb'),'utf8'));assert(notebook.cells.some(c=>c.cell_type==='code'&&c.outputs?.length));
 const out=path.join(root,'.sites-test');fs.mkdirSync(out,{recursive:true});
 const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
 for(const [name,raw] of Object.entries(charts)){
  const withStyles=raw.replace(/(<svg[^>]*>)/,'$1<style>text{font-family:DejaVu Sans,sans-serif}.axis-label{font-size:11px;fill:#65748a}.group-label{font-size:12px;fill:#11233d}.bar-label{font-size:12px;fill:#11233d}.bar-value{font-size:12px;fill:#11233d;font-weight:650}.map-label{font-size:13px;fill:#11233d;font-weight:650}.map-small{font-size:11px;fill:#65748a}.dot{fill:#8799b2;opacity:.25}</style>');
  fs.writeFileSync(path.join(out,name+'.svg'),withStyles);await sharp(Buffer.from(withStyles)).flatten({background:'#fff'}).png().toFile(path.join(out,name+'.png'));
 }
 console.log(JSON.stringify({status:'passed',ui_checks:['predictors','model coding','real sample filters','90/95/99% intervals','non-estimable subgroup','reset','myths','30-predictor ranking','category contrast','keyboard map tabs','hover details','SVG renders','byte-exact CSV','executed notebook','download files'],svg_renders:Object.keys(charts).length,webmcp_contract:'mock tested',real_browser_layout:'unavailable in plain-static managed preview'}));
})().catch(error=>{console.error(error);process.exit(1);});
