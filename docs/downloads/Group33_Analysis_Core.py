import numpy as np
import pandas as pd
from scipy import stats
from sklearn.model_selection import KFold
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error

NUMERIC = {"age", "absences"}
SEED = 42

def design(df, columns, numeric_override=()):
    parts = [np.ones((len(df), 1))]
    names = ["Intercept"]
    for col in columns:
        if col in NUMERIC or col in numeric_override:
            parts.append(df[[col]].to_numpy(dtype=float))
            names.append(col)
        else:
            levels = sorted(df[col].unique())
            for level in levels[1:]:
                parts.append((df[col].to_numpy() == level).astype(float)[:, None])
                names.append(f"{col}[{level}] vs {levels[0]}")
    return np.column_stack(parts), names

def ols(X, y, names):
    y = np.asarray(y, dtype=float)
    X = np.asarray(X, dtype=float)
    n, k = X.shape
    rank = np.linalg.matrix_rank(X)
    assert rank == k, "The design matrix must have full column rank."
    beta = np.linalg.lstsq(X, y, rcond=None)[0]
    residual = y - X @ beta
    sse = float(residual @ residual)
    sst = float(((y-y.mean())**2).sum())
    df_resid = n-k
    mse = sse / df_resid
    inv = np.linalg.inv(X.T @ X)
    cov = mse * inv
    se = np.sqrt(np.diag(cov))
    tcrit = stats.t.ppf(.975, df_resid)
    p = 2*stats.t.sf(np.abs(beta/se), df_resid)
    h = np.sum((X @ inv) * X, axis=1)
    hc3 = inv @ (X.T @ ((residual/(1-h))[:, None]**2 * X)) @ inv
    hse = np.sqrt(np.diag(hc3))
    hp = 2*stats.t.sf(np.abs(beta/hse), df_resid)
    q = k-1
    F = ((sst-sse)/q)/mse if q else 0.0
    Fp = stats.f.sf(F, q, df_resid) if q else 1.0
    if q:
        robust_F = float(beta[1:] @ np.linalg.pinv(hc3[1:,1:]) @ beta[1:]/q)
        robust_p = float(stats.f.sf(robust_F, q, df_resid))
    else:
        robust_F, robust_p = 0.0, 1.0
    rows = []
    for j, name in enumerate(names):
        rows.append(dict(term=name, estimate=float(beta[j]), se=float(se[j]),
                         ci_low=float(beta[j]-tcrit*se[j]), ci_high=float(beta[j]+tcrit*se[j]),
                         p=float(p[j]), hc3_se=float(hse[j]), hc3_p=float(hp[j]),
                         hc3_low=float(beta[j]-tcrit*hse[j]), hc3_high=float(beta[j]+tcrit*hse[j])))
    return dict(n=n, k=k, df_resid=df_resid, r2=1-sse/sst,
                adjusted_r2=1-(sse/df_resid)/(sst/(n-1)), rmse=float(np.sqrt(sse/n)),
                residual_sd=float(np.sqrt(mse)), F=float(F), p=float(Fp),
                hc3_F=robust_F, hc3_p=robust_p, coefficients=rows,
                beta=beta.tolist(), fitted=(X@beta).tolist(), residuals=residual.tolist())

def fit_model(df, cols, numeric_override=()):
    X, names = design(df, cols, numeric_override)
    return ols(X, df.G3.to_numpy(), names)

def group_summary(df, predictor):
    result=[]
    for level, sub in df.groupby(predictor, sort=True):
        n=len(sub); mean=float(sub.G3.mean()); sd=float(sub.G3.std(ddof=1))
        error=float(stats.t.ppf(.975,n-1)*sd/np.sqrt(n))
        result.append(dict(level=int(level) if isinstance(level,(int,np.integer)) else str(level),
                           n=n, mean=mean, sd=sd, ci_low=mean-error, ci_high=mean+error))
    return result

def cv_linear(df, cols, numeric_override=()):
    X,_=design(df,cols,numeric_override)
    y=df.G3.to_numpy(dtype=float); pred=np.zeros(len(y)); base=np.zeros(len(y))
    for train,test in KFold(5,shuffle=True,random_state=SEED).split(X):
        pred[test]=X[test]@np.linalg.lstsq(X[train],y[train],rcond=None)[0]
        base[test]=y[train].mean()
    return dict(r2=float(r2_score(y,pred)), rmse=float(np.sqrt(mean_squared_error(y,pred))),
                baseline_rmse=float(np.sqrt(mean_squared_error(y,base))),
                predictions=pred.tolist())

def analyze(df, label, run_ml=True):
    assert df.shape[1]==33 and not df.isna().any().any()
    assert set(df.studytime)=={1,2,3,4} and df.G3.between(0,20).all()
    predictors=[c for c in df.columns if c not in ("G1","G2","G3")]
    main=fit_model(df,["studytime"])
    failure=fit_model(df,["failures"])
    numeric_study=fit_model(df,["studytime"],("studytime",))
    numeric_fail=fit_model(df,["failures"],("failures",))
    famsup=fit_model(df,["famsup"])
    groups=group_summary(df,"studytime")
    fg=group_summary(df,"failures")
    ranking=[]
    for x in predictors:
        m=fit_model(df,[x])
        ranking.append(dict(predictor=x, encoding="numeric" if x in NUMERIC else "categorical",
                            df=m["k"]-1, r2=m["r2"], adjusted_r2=m["adjusted_r2"], p=m["p"]))
    ranking.sort(key=lambda r:r["r2"],reverse=True)
    # Independent identities verify the main fit and coding.
    one_way=stats.f_oneway(*[sub.G3.to_numpy() for _,sub in df.groupby("studytime")])
    assert np.isclose(main["F"],one_way.statistic) and np.isclose(main["p"],one_way.pvalue)
    assert np.isclose(numeric_study["r2"],np.corrcoef(df.studytime,df.G3)[0,1]**2)
    assert np.isclose(numeric_fail["r2"],np.corrcoef(df.failures,df.G3)[0,1]**2)
    assert all(np.isclose(np.mean(np.array(main["fitted"])[df.studytime==g["level"]]),g["mean"]) for g in groups)
    adjusted=fit_model(df,["studytime","failures","school","sex","age","Medu","Fedu","traveltime"])
    X,names=design(df,["studytime","failures","school","sex","age","Medu","Fedu","traveltime"])
    # Partial F: studytime after the stated measured covariates. This is not causal identification.
    reduced=fit_model(df,["failures","school","sex","age","Medu","Fedu","traveltime"])
    sse_full=np.sum(np.array(adjusted["residuals"])**2)
    sse_reduced=np.sum(np.array(reduced["residuals"])**2)
    partial_F=(sse_reduced-sse_full)/3/(sse_full/adjusted["df_resid"])
    adjusted["studytime_partial_F"]=float(partial_F)
    adjusted["studytime_partial_p"]=float(stats.f.sf(partial_F,3,adjusted["df_resid"]))
    positive=fit_model(df[df.G3>0],["studytime"])
    positive_fail=fit_model(df[df.G3>0],["failures"])
    result=dict(subject=label,n=len(df),columns=len(df.columns),missing=int(df.isna().sum().sum()),
                duplicate_rows=int(df.duplicated().sum()),zero_grades=int((df.G3==0).sum()),
                g3_mean=float(df.G3.mean()),g3_sd=float(df.G3.std(ddof=1)),
                study=main,failures=failure,study_numeric=numeric_study,failures_numeric=numeric_fail,
                famsup=famsup,groups=groups,failure_groups=fg,ranking=ranking,adjusted=adjusted,
                cv_study=cv_linear(df,["studytime"]),cv_failures=cv_linear(df,["failures"]),
                cv_study_numeric=cv_linear(df,["studytime"],("studytime",)),
                positive_sensitivity=dict(n=int((df.G3>0).sum()),study_r2=positive["r2"],
                                          study_p=positive["p"],failures_r2=positive_fail["r2"]),
                earlier_grades={x:fit_model(df,[x],(x,))["r2"] for x in ["G1","G2"]})
    if run_ml:
        Xdf=pd.get_dummies(df[predictors],columns=[c for c in predictors if c not in NUMERIC],dtype=float)
        X=Xdf.to_numpy(); y=df.G3.to_numpy(dtype=float)
        mapping={c:[j for j,encoded in enumerate(Xdf.columns) if encoded==c or encoded.startswith(c+"_")] for c in predictors}
        pred=np.zeros(len(y)); importances={c:[] for c in predictors}; fold_metrics=[]
        for fold,(train,test) in enumerate(KFold(5,shuffle=True,random_state=SEED).split(X)):
            model=RandomForestRegressor(n_estimators=150,max_depth=6,min_samples_leaf=5,
                                        max_features=1.0,random_state=SEED+fold,n_jobs=1)
            model.fit(X[train],y[train]); pred[test]=model.predict(X[test])
            score=r2_score(y[test],pred[test]); fold_metrics.append(float(score))
            rng=np.random.default_rng(1000+fold)
            for c,indices in mapping.items():
                drops=[]
                for repeat in range(5):
                    shuffled=X[test].copy(); perm=rng.permutation(len(test))
                    shuffled[:,indices]=X[test][perm][:,indices]
                    drops.append(score-r2_score(y[test],model.predict(shuffled)))
                importances[c].append(float(np.mean(drops)))
        importance=[dict(predictor=c,mean_drop_r2=float(np.mean(v)),fold_sd=float(np.std(v,ddof=1)),folds=v)
                    for c,v in importances.items()]
        importance.sort(key=lambda r:r["mean_drop_r2"],reverse=True)
        result["ml"]=dict(r2=float(r2_score(y,pred)),rmse=float(np.sqrt(mean_squared_error(y,pred))),
                          fold_r2=fold_metrics,importance=importance,predictions=pred.tolist(),
                          settings=dict(trees=150,max_depth=6,min_samples_leaf=5,folds=5,seed=42,permutations=5))
    return result
