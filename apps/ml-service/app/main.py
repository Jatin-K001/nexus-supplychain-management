from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .cascade import recalculate_cascade
from .price_forecast import forecast_price
from .critical_path import compute_critical_path
from .purchase_recommendations import generate_recommendations

app = FastAPI(title='Nexus ML Service')


@app.get('/health')
def health():
    return {'ok': True}


class CascadeRequest(BaseModel):
    project_id: str


@app.post('/cascade/recalculate')
def cascade_recalculate(req: CascadeRequest):
    try:
        return recalculate_cascade(req.project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/price/forecast/{material_id}')
def price_forecast(material_id: str):
    try:
        return forecast_price(material_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/critical-path/{project_id}')
def critical_path(project_id: str):
    try:
        return compute_critical_path(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/purchase-recommendations/generate')
def purchase_recommendations_generate():
    try:
        return {'created': generate_recommendations()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
