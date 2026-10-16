"""Verify browser OLS/F tests/intervals against independent NumPy/SciPy results.

Run: python scripts/verify_statistics.py (requires pandas, numpy, scipy and Node).
"""
from pathlib import Path
import itertools, json, subprocess, tempfile
import numpy as np
import pandas as pd
from scipy import stats

ROOT=Path(__file__).resolve().parents[1]
DATA=pd.read_csv(ROOT/'docs/downloads/student-por.csv',sep=';')
cases=[]
for school,sex,support,zeros in itertools.product(['all','GP','MS'],['all','F','M'],['all','yes','no'],['include','exclude']):
    mask=pd.Series(True,index=DATA.index)
    if school!='all':mask &= DATA.school==school
    if sex!='all':mask &= DATA.sex==sex
    if support!='all':mask &= DATA.famsup==support
    if zeros=='exclude':mask &= DATA.G3>0
    sub=DATA[mask]
    filters=dict(school=school,sex=sex,support=support,zeros=zeros)
    for predictor,encoding,confidence in itertools.product(['studytime','failures','famsup'],['categorical','numeric'],[.90,.95,.99]):
        n=len(sub);y=sub.G3.to_numpy(dtype=float);groups=[]
        for level,g in sub.groupby(predictor,sort=True):
            mean=float(g.G3.mean());sd=float(g.G3.std(ddof=1));nn=len(g)
            error=float(stats.t.ppf((1+confidence)/2,nn-1)*sd/np.sqrt(nn)) if nn>1 else None
            groups.append(dict(level=level if isinstance(level,str) else int(level),n=nn,mean=mean,low=mean-error if error is not None else None,high=mean+error if error is not None else None))
        if encoding=='numeric':
            x=sub[predictor].map({'yes':1,'no':0}).to_numpy(dtype=float) if predictor=='famsup' else sub[predictor].to_numpy(dtype=float)
            X=np.column_stack([np.ones(n),x]);k=2
        else:
            levels=sorted(sub[predictor].unique());k=len(levels)
            X=np.column_stack([np.ones(n)]+[(sub[predictor].to_numpy()==v).astype(float) for v in levels[1:]])
        valid=bool(n>k and len(groups)>1 and np.var(y)>0)
        expected=dict(n=n,valid=valid,groups=groups)
        if valid:
            b=np.linalg.lstsq(X,y,rcond=None)[0];res=y-X@b;sse=float(res@res);sst=float(((y-y.mean())**2).sum());df=n-k;mse=sse/df
            F=(sst-sse)/(k-1)/mse
            expected.update(r2=1-sse/sst,F=F,p=float(stats.f.sf(F,k-1,df)),rmse=float(np.sqrt(sse/n)),df=df)
            a,z=groups[0],groups[-1]
            if encoding=='numeric':
                delta=float(x.max()-x.min());se=float(np.sqrt(mse*np.linalg.inv(X.T@X)[1,1]));estimate=float(b[1]*delta);cse=se*delta
                err=float(stats.t.ppf((1+confidence)/2,df)*se)
                expected.update(slope=float(b[1]),intercept=float(b[0]),slopeLow=float(b[1]-err),slopeHigh=float(b[1]+err))
            else:
                estimate=z['mean']-a['mean'];cse=np.sqrt(mse*(1/a['n']+1/z['n']))
            error=float(stats.t.ppf((1+confidence)/2,df)*cse)
            expected['contrast']=dict(estimate=estimate,low=estimate-error,high=estimate+error)
        cases.append(dict(filters=filters,predictor=predictor,encoding=encoding,confidence=confidence,expected=expected))

with tempfile.TemporaryDirectory() as tmp:
    fixtures=Path(tmp)/'fixtures.json';fixtures.write_text(json.dumps(cases,allow_nan=False))
    code=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.argv[1],cases=JSON.parse(fs.readFileSync(process.argv[2]));
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/docs/assets/data.js','utf8'),context);
const S=require(root+'/docs/assets/stats.js'),D=context.Group33Data;
let assertions=0;
function near(a,b,key){if(b===null){assert.strictEqual(a,null,key);return;}assert(Number.isFinite(a),key+': non-finite');const probability=key==='p'||key.startsWith('ranking p')||key.endsWith(' p');const tolerance=probability?Math.max(1e-300,Math.abs(b)*2e-6):Math.max(2e-8,Math.abs(b)*2e-8);assert(Math.abs(a-b)<=tolerance,`${key}: ${a} vs ${b}`);assertions++;}
for(const c of cases){
 const rows=S.filter(D.rows,c.filters),m=S.fit(rows,c.predictor,c.encoding,c.confidence),x=c.expected;
 assert.strictEqual(m.n,x.n);assert.strictEqual(m.valid,x.valid);assert.strictEqual(m.groups.length,x.groups.length);
 x.groups.forEach((g,i)=>{assert.strictEqual(m.groups[i].level,g.level);assert.strictEqual(m.groups[i].n,g.n);for(const k of ['mean','low','high'])near(m.groups[i][k],g[k],k);});
 if(x.valid){for(const k of ['r2','F','p','rmse','df','slope','intercept','slopeLow','slopeHigh'])if(k in x)near(m[k],x[k],k);
 const ct=S.contrast(m,m.groups[0].level,m.groups[m.groups.length-1].level);for(const k of ['estimate','low','high'])near(ct[k],x.contrast[k],k);}
}
const R=D.reference;
for(const [x,key] of [['studytime','study'],['failures','failures'],['famsup','famsup']]){const m=S.fit(D.rows,x);near(m.r2,R[key].r2,x+' R2');near(m.p,R[key].p,x+' p');}
for(const row of S.rank(D.rows,D.predictors)){const r=R.ranking.find(v=>v.predictor===row.predictor);near(row.r2,r.r2,'ranking '+row.predictor);near(row.p,r.p,'ranking p '+row.predictor);}
assert.strictEqual(S.rank(D.rows,D.predictors)[0].predictor,'failures');
for(const rows of [[],D.rows.slice(0,1),[{studytime:1,G3:4},{studytime:1,G3:5}],[{studytime:1,G3:4},{studytime:2,G3:4}],[{studytime:1,G3:4},{studytime:2,G3:5}]])assert(!S.fit(rows,'studytime').valid);
near(S.tCritical(.95,1),12.706204736432095,'t df1');
console.log(JSON.stringify({filter_model_confidence_cases:cases.length,numeric_assertions:assertions,full_sample_predictors:30,edge_cases:5,status:'passed'}));
"""
    subprocess.run(['node','-e',code,str(ROOT),str(fixtures)],check=True)
