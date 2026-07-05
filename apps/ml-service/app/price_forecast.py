"""§4.3 Price Volatility Forecasting — Holt-Winters exponential smoothing over
price_history, deliberately simpler/more stable than an LSTM on this little
data. Six weeks of history is too short for a seasonal model, so this uses
a simple additive-trend Holt's linear method (still "Holt-Winters" family)."""
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import numpy as np
from .db import get_conn

BUY_NOW_THRESHOLD = 0.08  # §4.3: buy_now flag if projected change > +8%


def forecast_price(material_id: str) -> dict:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'select week_index, price_index from price_history where material_id = %s order by week_index',
                (material_id,),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    if len(rows) < 3:
        return {'material_id': material_id, 'error': 'insufficient price history'}

    series = np.array([float(r['price_index']) for r in rows])
    model = ExponentialSmoothing(series, trend='add', seasonal=None, initialization_method='estimated')
    fit = model.fit()
    projection = fit.forecast(6)

    last_actual = series[-1]
    projected_end = projection[-1]
    pct_change = (projected_end - last_actual) / last_actual if last_actual else 0.0
    buy_now = pct_change > BUY_NOW_THRESHOLD

    return {
        'material_id': material_id,
        'last_actual': round(float(last_actual), 2),
        'projection': [round(float(p), 2) for p in projection],
        'pct_change': round(float(pct_change) * 100, 2),
        'buy_now': bool(buy_now),
    }
